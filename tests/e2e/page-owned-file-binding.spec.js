/* eslint-env node */
/* global BigInt */
/**
 * Opt-in: binds an existing wiki image to a page-owned drawing on the dedicated
 * Layers_browser_acceptance owner, checks the page view, and restores the owner with an exact-base publication.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'a bound file embed shows the page-owned drawing over its exact file version', async ( { page, context } ) => {
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires an explicitly provisioned, seeded pilot automation owner' );
	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.port ).toBe( '8080' );
	expect( url.search + url.hash + url.username + url.password ).toBe( '' );
	const base = url.origin;
	const owner = 'Layers_browser_acceptance';
	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ? await context.request.post( base + '/api.php', { form: params } ) :
			await context.request.get( base + '/api.php', { params } );
		return response.json();
	};
	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( { action: 'login', lgname: config.username, lgpassword: config.password,
		lgtoken: loginToken }, true );
	expect( login.login.result ).toBe( 'Success' );
	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;
	const latest = async () => {
		const record = ( await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids|content',
			rvslots: 'main' } ) ).query.pages[ 0 ];
		return { pageId: record.pageid, revision: record.revisions[ 0 ].revid,
			text: record.revisions[ 0 ].slots.main.content };
	};

	// Any existing bitmap on the wiki; the test only reads it.
	const files = ( await api( { action: 'query', list: 'allimages', aimime: 'image/jpeg|image/png', ailimit: 1,
		aiprop: 'timestamp|sha1|size' } ) ).query.allimages;
	test.skip( !files.length, 'Requires at least one JPEG or PNG file on the wiki' );
	const file = files[ 0 ];
	expect( file.width ).toBeLessThanOrEqual( 4096 );
	expect( file.height ).toBeLessThanOrEqual( 4096 );

	const initial = await latest();
	const initialSnapshot = ( await api( { action: 'layersread', owner, revid: String( initial.revision ) } ) )
		.layersread.snapshot;
	const surfaceId = 'bound_file_acceptance';
	const binding = `v1:${ initial.pageId }:${ surfaceId }`;
	const snapshot = JSON.parse( JSON.stringify( initialSnapshot ) );
	snapshot.surfaces.push( {
		id: surfaceId, kind: 'image', label: 'Bound file acceptance',
		canvas: { width: file.width, height: file.height, backgroundColor: '#ffffff', backgroundVisible: true,
			backgroundOpacity: 1 },
		layers: [ { id: 'mark', type: 'rectangle', x: 20, y: 20, width: Math.round( file.width / 2 ),
			height: Math.round( file.height / 2 ), fill: '#ff0000', stroke: 'none' } ],
		readingOrder: [ 'mark' ],
		source: { repository: 'local', fileTitle: 'File:' + file.name,
			timestamp: file.timestamp.replace( /\D/g, '' ),
			sha1: BigInt( '0x' + file.sha1 ).toString( 36 ).padStart( 31, '0' ), page: 1 }
	} );

	let lastOwnedRevision = null;
	let publicationPending = false;
	try {
		publicationPending = true;
		const published = await api( { action: 'layerspublish', owner, baserevid: String( initial.revision ),
			data: JSON.stringify( snapshot ),
			maintext: `${ initial.text }\n\n[[File:${ file.name }|300px|layersbinding=${ binding }|Bound photo]]`,
			summary: 'Bound file acceptance: bind an image', token: csrfToken }, true );
		expect( published.layerspublish && published.layerspublish.result ).toBe( 'Success' );
		lastOwnedRevision = published.layerspublish.revid;
		publicationPending = false;

		const read = page.waitForResponse( ( r ) => r.url().includes( 'action=layersread' ) &&
			r.url().includes( 'binding=' ) );
		const response = await page.goto( `${ base }/index.php?title=${ owner }` );
		expect( await response.text() ).not.toContain( 'layersbinding' );
		const bundle = ( await ( await read ).json() ).layersread.bindings[ binding ];
		expect( bundle.revisionId ).toBe( lastOwnedRevision );
		expect( bundle.source.url ).toContain( encodeURIComponent( file.name ).replace( /%20/g, '_' ).split( '.' )[ 0 ] );

		// The canvas replaces core's image inside the same file link, at the same display width.
		const host = page.locator( 'a .layers-bound-file-view' );
		await expect( host ).toHaveCount( 1 );
		await expect( page.locator( 'img.layers-bound-file' ) ).toHaveCount( 0 );
		expect( await host.evaluate( ( el ) => el.style.width ) ).toBe( '300px' );
		const canvas = host.locator( 'canvas' );
		await expect( canvas ).toHaveAttribute( 'width', String( file.width ) );
		await expect( canvas ).toHaveAttribute( 'role', 'img' );
		await expect.poll( () => canvas.evaluate( ( element ) =>
			Array.from( element.getContext( '2d' ).getImageData( 30, 30, 1, 1 ).data ) ) ).toEqual( [ 255, 0, 0, 255 ] );
		// Outside the layer the pixels come from the file version itself.
		const photo = await canvas.evaluate( ( element ) => Array.from( element.getContext( '2d' )
			.getImageData( element.width - 5, element.height - 5, 1, 1 ).data ) );
		expect( photo[ 3 ] ).toBe( 255 );
		expect( photo.slice( 0, 3 ) ).not.toEqual( [ 255, 0, 0 ] );
		// Without thumb, core uses the caption as the image's alt text; the canvas keeps it as its name.
		await expect( canvas ).toHaveAttribute( 'aria-label', 'Bound photo' );
	} finally {
		const restore = async () => {
			if ( lastOwnedRevision === null ) {
				return;
			}
			if ( publicationPending ) {
				throw new Error( 'Bound file cleanup requires review: publication outcome is uncertain; no restore attempted' );
			}
			const current = await latest();
			if ( current.pageId !== initial.pageId || current.revision !== lastOwnedRevision ) {
				throw new Error( 'Bound file cleanup requires review: another edit intervened; no restore attempted' );
			}
			const restored = await api( { action: 'layerspublish', owner, baserevid: String( lastOwnedRevision ),
				data: JSON.stringify( initialSnapshot ), maintext: initial.text,
				summary: 'Bound file acceptance cleanup: restore automated owner state', token: csrfToken }, true );
			if ( !restored.layerspublish || restored.layerspublish.result !== 'Success' ) {
				throw new Error( 'Bound file cleanup failed; no retry or forced overwrite attempted' );
			}
			expect( ( await latest() ).text ).toBe( initial.text );
		};
		await restore();
	}
} );
