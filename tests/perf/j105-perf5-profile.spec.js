/* eslint-env node */
/* global BigInt */
/** J105/PERF-5: five serial 100-layer publication and old-revision view samples. */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );
const assert = require( 'assert' );

test.describe.configure( { mode: 'serial' } );

test( 'J105 PERF-5 server profile: five 100-layer saves and old-revision views', async ( { page, context } ) => {
	test.setTimeout( 600000 );
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires the original test wiki automation session' );

	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const configuredUrl = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( configuredUrl.hostname );
	expect( configuredUrl.protocol ).toBe( 'http:' );
	expect( configuredUrl.port ).toBe( '8080' );
	const base = configuredUrl.origin;
	const owner = 'Layers_browser_acceptance';
	const surfaceId = 'perf5_profile_image';
	const expectedMainText = 'Dedicated automated Layers history acceptance page.';
	const expectedBaseline = {
		schemaVersion: 1,
		surfaces: [ {
			canvas: {
				backgroundColor: '#ffffff', backgroundOpacity: 1, backgroundVisible: true,
				height: 600, width: 800
			},
			id: 'presentation',
			kind: 'slide',
			label: 'Welcome Slide',
			layers: [ {
				color: '#000000', fontSize: 24, id: 'title', text: 'Visual ideas — 世界', type: 'text',
				visible: true, x: 99, y: 60
			} ],
			readingOrder: [ 'title' ]
		} ]
	};

	const api = async ( params, post = false, headers = {} ) => {
		const requestParams = { ...params, format: 'json', formatversion: '2' };
		const response = post ?
			await context.request.post( `${ base }/api.php`, { form: requestParams, headers } ) :
			await context.request.get( `${ base }/api.php`, { params: requestParams, headers } );
			if ( !response.ok() ) {
				throw new Error( `Test wiki API returned HTTP ${ response.status() }` );
			}
		const result = await response.json();
		if ( result.error ) {
			throw new Error( `Test wiki API rejected the request: ${ result.error.code || 'unknown' }` );
		}
		return result;
	};
	const ownerState = async () => {
		const result = await api( {
			action: 'query', prop: 'info|revisions', titles: owner,
			rvprop: 'ids|timestamp|user|content', rvslots: 'main'
		} );
		return result.query.pages[ 0 ];
	};
	const readSnapshot = async ( revisionId ) => {
		const result = await api( { action: 'layersread', owner, revid: String( revisionId ) } );
		return result.layersread.snapshot;
	};
	const snapshotsEqual = ( left, right ) => {
		try {
			assert.deepStrictEqual( left, right );
			return true;
		} catch ( error ) {
			return false;
		}
	};
	const publish = async ( snapshot, baseRevisionId, csrfToken, summary, probeCase = null ) => {
		const started = process.hrtime.bigint();
		const result = await api( {
			action: 'layerspublish', owner, pageid: pageId, baserevid: String( baseRevisionId ),
			data: JSON.stringify( snapshot ), summary, token: csrfToken
		}, true, probeCase ? { 'X-Layers-Perf5': probeCase } : {} );
		return {
			revisionId: result.layerspublish?.revid,
			totalMs: Number( ( Number( process.hrtime.bigint() - started ) / 1e6 ).toFixed( 2 ) )
		};
	};

	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( {
		action: 'login', lgname: config.username, lgpassword: config.password, lgtoken: loginToken
	}, true );
	expect( login.login?.result ).toBe( 'Success' );
	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;

	const initialPage = await ownerState();
	expect( initialPage.missing ).toBeUndefined();
	const pageId = initialPage.pageid;
	expect( Number.isInteger( pageId ) ).toBe( true );
	const initialRevision = initialPage.revisions[ 0 ];
	const initialRevisionId = initialRevision.revid;
	const initialMainText = initialRevision.slots.main.content;
	const initialSnapshot = await readSnapshot( initialRevisionId );
	assert.strictEqual( initialMainText, expectedMainText );
	assert.deepStrictEqual( initialSnapshot, expectedBaseline );
	const ownerModifiedMinutesAgo = ( Date.now() - new Date( initialRevision.timestamp ).getTime() ) / 60000;
	const isPriorAutomationCleanup = initialRevision.user === config.username && initialMainText === expectedMainText;
	if ( ownerModifiedMinutesAgo < 10 && !isPriorAutomationCleanup ) {
		throw new Error( 'The dedicated test owner changed recently; refusing to overwrite it' );
	}

	const fileList = ( await api( {
		action: 'query', list: 'allimages', aimime: 'image/jpeg|image/png', ailimit: 1,
		aiprop: 'timestamp|sha1|size'
	} ) ).query.allimages;
	expect( fileList.length ).toBeGreaterThan( 0 );
	const file = fileList[ 0 ];
	expect( file.sha1 ).toMatch( /^[0-9a-f]{40}$/i );
	const fileTimestamp = file.timestamp.replace( /\D/g, '' );
	expect( fileTimestamp ).toMatch( /^[0-9]{14}$/ );

	const layers = [];
	for ( let i = 0; i < 99; i++ ) {
		layers.push( {
			id: `perf5_rect_${ i }`, type: 'rectangle',
			x: ( i % 10 ) * 70 + 20, y: Math.floor( i / 10 ) * 50 + 20,
			width: 50, height: 35, fill: i % 2 === 0 ? '#ff5500' : '#00aa55',
			strokeWidth: 1, stroke: '#000000'
		} );
	}
	layers.push( {
		id: 'perf5_text', type: 'textbox', x: 500, y: 40, width: 220, height: 80, text: '',
		fontSize: 16, fontFamily: 'Arial, sans-serif', color: '#000000', textAlign: 'left',
		verticalAlign: 'top', lineHeight: 1.2, stroke: 'transparent', strokeWidth: 0,
		fill: '#ffffff', cornerRadius: 0, padding: 8
	} );
	const profileSurface = {
		id: surfaceId, kind: 'image', label: 'PERF-5 image layer set',
		canvas: { width: 800, height: 600, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
		layers,
		readingOrder: layers.map( ( layer ) => layer.id ),
		source: {
			repository: 'local', fileTitle: `File:${ file.name }`, timestamp: fileTimestamp,
			sha1: BigInt( `0x${ file.sha1 }` ).toString( 36 ).padStart( 31, '0' ), page: 1
		}
	};
	let workingSnapshot = JSON.parse( JSON.stringify( initialSnapshot ) );
	workingSnapshot.surfaces.push( profileSurface );

	let lastOwnedRevision = initialRevisionId;
	let needsRestore = false;
	const cases = [];
	const ownedSnapshots = [ initialSnapshot ];
	const restoreBaseline = async () => {
		if ( !needsRestore ) {
			return;
		}
		const current = await ownerState();
		if ( current.pageid !== pageId ) {
			throw new Error( 'The test owner advanced outside this run; exact-base cleanup stopped safely' );
		}
		const currentSnapshot = await readSnapshot( current.revisions[ 0 ].revid );
		if ( current.revisions[ 0 ].slots.main.content === initialMainText &&
			snapshotsEqual( currentSnapshot, initialSnapshot ) ) {
			lastOwnedRevision = current.revisions[ 0 ].revid;
			needsRestore = false;
			return;
		}
		if ( current.revisions[ 0 ].revid !== lastOwnedRevision ) {
			const matchesOwnedSnapshot = ownedSnapshots.some( ( snapshot ) =>
				snapshotsEqual( currentSnapshot, snapshot ) );
			const belongsToThisRun = current.revisions[ 0 ].user === config.username &&
				current.revisions[ 0 ].slots.main.content === initialMainText &&
				matchesOwnedSnapshot;
			if ( !belongsToThisRun ) {
				throw new Error( 'The test owner advanced outside this run; exact-base cleanup stopped safely' );
			}
			lastOwnedRevision = current.revisions[ 0 ].revid;
		}
		const restored = await publish( initialSnapshot, lastOwnedRevision, csrfToken,
			'PERF-5 profile: restore original test owner state' );
		expect( restored.revisionId ).toBeGreaterThan( lastOwnedRevision );
		lastOwnedRevision = restored.revisionId;
		needsRestore = false;
		const verifiedPage = await ownerState();
		const verifiedSnapshot = await readSnapshot( verifiedPage.revisions[ 0 ].revid );
		assert.strictEqual( verifiedPage.pageid, pageId );
		assert.strictEqual( verifiedPage.revisions[ 0 ].slots.main.content, initialMainText );
		assert.deepStrictEqual( verifiedSnapshot, initialSnapshot );
	};

	try {
		needsRestore = true;
		ownedSnapshots.push( workingSnapshot );
		const seeded = await publish( workingSnapshot, lastOwnedRevision, csrfToken,
			'PERF-5 profile: seed 100-layer image layer set' );
		expect( seeded.revisionId ).toBeGreaterThan( lastOwnedRevision );
		lastOwnedRevision = seeded.revisionId;

		for ( let run = 1; run <= 5; run++ ) {
			const previousRevisionId = lastOwnedRevision;
			const changedSnapshot = JSON.parse( JSON.stringify( workingSnapshot ) );
			const target = changedSnapshot.surfaces.find( ( surface ) => surface.id === surfaceId );
			target.layers[ 0 ].strokeWidth = run + 1;
			ownedSnapshots.push( changedSnapshot );
			const publication = await publish( changedSnapshot, previousRevisionId, csrfToken,
				`PERF-5 profile: one-property edit run ${ run }`, `publish-run${ run }` );
			expect( publication.revisionId ).toBeGreaterThan( previousRevisionId );
			lastOwnedRevision = publication.revisionId;
			workingSnapshot = changedSnapshot;

			const viewUrl = `${ base }/index.php?title=Special:ViewLayersPage&owner=${ encodeURIComponent( owner ) }` +
				`&revid=${ previousRevisionId }&surface=${ encodeURIComponent( surfaceId ) }`;
			const routeMatcher = ( rawUrl ) => {
				const candidate = new URL( rawUrl );
				return candidate.origin === base && candidate.pathname.endsWith( '/index.php' ) &&
					candidate.searchParams.get( 'title' ) === 'Special:ViewLayersPage' &&
					candidate.searchParams.get( 'owner' ) === owner &&
					candidate.searchParams.get( 'revid' ) === String( previousRevisionId ) &&
					candidate.searchParams.get( 'surface' ) === surfaceId;
			};
			const routeHandler = async ( route ) => {
				const headers = route.request().headers();
				headers['x-layers-perf5'] = `view-run${ run }`;
				await route.continue( { headers } );
			};
			await page.route( routeMatcher, routeHandler );
			const viewStarted = process.hrtime.bigint();
			try {
				const response = await page.goto( viewUrl, { waitUntil: 'domcontentloaded' } );
				expect( response ).not.toBeNull();
				expect( response.status() ).toBe( 200 );
				await expect( page.locator( '#layers-history-container canvas' ) ).toBeVisible( { timeout: 30000 } );
				const timing = response.request().timing();
				cases.push( {
					run,
					cachePhase: run === 1 ? 'first sample; cache not forcibly cleared' : 'repeat sample',
					publishClientTotalMs: publication.totalMs,
					viewResponseTtfbMs: Number( timing.responseStart.toFixed( 2 ) ),
					viewResponseBodyMs: Number( ( timing.responseEnd - timing.responseStart ).toFixed( 2 ) ),
					viewCanvasReadyMs: Number( ( Number( process.hrtime.bigint() - viewStarted ) / 1e6 ).toFixed( 2 ) ),
					oldRevisionId: previousRevisionId,
					newRevisionId: publication.revisionId
				} );
				console.log( `[J105] ${ JSON.stringify( cases[ cases.length - 1 ] ) }` );
			} finally {
				await page.unroute( routeMatcher, routeHandler );
			}
		}

		await restoreBaseline();
	} finally {
		if ( needsRestore ) {
			await restoreBaseline();
		}
	}

	const finalPage = await ownerState();
	const finalSnapshot = await readSnapshot( finalPage.revisions[ 0 ].revid );
	assert.strictEqual( finalPage.pageid, pageId );
	assert.strictEqual( finalPage.revisions[ 0 ].slots.main.content, initialMainText );
	assert.deepStrictEqual( finalSnapshot, initialSnapshot );
	expect( cases ).toHaveLength( 5 );
	console.log( `[J105] cleanup verified: page ${ pageId }, latest revision ${ finalPage.revisions[ 0 ].revid }, original main text and snapshot restored.` );
} );
