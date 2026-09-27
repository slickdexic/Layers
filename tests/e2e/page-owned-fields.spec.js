/* eslint-env node */
/** Opt-in: a page-owned drawing shows values the page gives through {{#layers_fields:}}. */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test( 'a bound drawing shows the page\'s layers_fields values in place of its {{name}} tokens', async ( { page, context } ) => {
	test.setTimeout( 240000 );
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

	// Ten-minute rule, unless the last change is another run's cleanup by the QA actor.
	const serverTime = new Date( ( await api( { action: 'query', meta: 'siteinfo', siprop: 'general' } ) )
		.query.general.time ).getTime();
	const record = ( await api( { action: 'query', prop: 'revisions', titles: owner,
		rvprop: 'ids|timestamp|user|content', rvslots: 'main' } ) ).query.pages[ 0 ];
	const initial = record.revisions[ 0 ];
	const initialText = initial.slots.main.content;
	if ( ( serverTime - new Date( initial.timestamp ).getTime() ) / 60000 < 10 &&
		!( initial.user === config.username && initialText === 'Dedicated automated Layers history acceptance page.' )
	) {
		throw new Error( `Owner ${ owner } changed within the last 10 minutes; stopping per J65 wiki rules` );
	}
	const initialSnapshot = ( await api( { action: 'layersread', owner, revid: String( initial.revid ) } ) )
		.layersread.snapshot;

	const surfaceId = 'slide_fields_probe';
	const text = ( id, y, value ) => ( { id, type: 'text', x: 40, y, text: value, fontSize: 48,
		fontFamily: 'Arial', color: '#000000' } );
	const snapshot = { schemaVersion: 1, surfaces: initialSnapshot.surfaces.concat( [ {
		id: surfaceId, kind: 'slide', label: 'Fields probe',
		canvas: { width: 800, height: 600, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
		// The literal row and the token row must look identical once the page fills the token.
		layers: [ text( 'literal', 150, 'Pressure 12 bar' ), text( 'token', 400, 'Pressure {{pressure}}' ) ]
	} ] ) };
	const mainText = `${ initialText }\n\n{{#Slide:FieldsProbe|layersbinding=v1:${ record.pageid }:${ surfaceId }}}\n` +
		`{{#layers_fields:${ surfaceId }|pressure = 12 [[bar]]}}`;

	let lastOwnedRevision = null;
	let publicationPending = false;
	try {
		publicationPending = true;
		const seeded = await api( { action: 'layerspublish', owner, baserevid: String( initial.revid ),
			data: JSON.stringify( snapshot ), maintext: mainText, summary: 'Fields acceptance: seed a drawing with a token',
			token: csrfToken }, true );
		expect( seeded.layerspublish && seeded.layerspublish.result ).toBe( 'Success' );
		lastOwnedRevision = seeded.layerspublish.revid;
		publicationPending = false;

		// Horizontal extent of dark pixels in a band of rows.
		const inkExtent = ( selector, top, bottom ) => page.locator( selector ).first().evaluate( ( canvas, band ) => {
			const data = canvas.getContext( '2d' ).getImageData( 0, band[ 0 ], canvas.width, band[ 1 ] - band[ 0 ] ).data;
			let min = Infinity;
			let max = -1;
			for ( let i = 0; i < data.length; i += 4 ) {
				if ( data[ i + 3 ] > 0 && data[ i ] < 128 ) {
					const x = ( i / 4 ) % canvas.width;
					min = Math.min( min, x );
					max = Math.max( max, x );
				}
			}
			return [ min, max ];
		}, [ top, bottom ] );

		await page.goto( `${ base }/index.php?title=${ owner }` );
		expect( await page.evaluate( () => Object.keys( mw.config.get( 'wgLayersDrawingFields' ) ).map( JSON.parse ) ) )
			.toEqual( [ [ surfaceId, 'pressure', '12 bar' ] ] );
		await expect( page.locator( `.layers-bound-slide[data-layers-binding$=":${ surfaceId }"] canvas` ) ).toBeVisible();
		const onPage = `.layers-bound-slide[data-layers-binding$=":${ surfaceId }"] canvas`;
		await expect.poll( () => inkExtent( onPage, 90, 260 ) ).not.toEqual( [ Infinity, -1 ] );
		const literal = await inkExtent( onPage, 90, 260 );
		await expect.poll( () => inkExtent( onPage, 340, 510 ) ).toEqual( literal );

		// The history viewer shows the drawing as saved, token included, so the token row is wider there.
		await page.goto( `${ base }/index.php?title=Special:ViewLayersPage&owner=${ owner }&revid=${ lastOwnedRevision }` +
			`&surface=${ surfaceId }` );
		const viewer = '#layers-history-container canvas';
		await expect( page.locator( viewer ) ).toBeVisible();
		await expect.poll( () => inkExtent( viewer, 90, 260 ) ).toEqual( literal );
		const saved = await inkExtent( viewer, 340, 510 );
		expect( saved[ 1 ] ).toBeGreaterThan( literal[ 1 ] + 20 );
	} finally {
		const restore = async () => {
			if ( publicationPending ) {
				throw new Error( 'Fields cleanup requires review: publication outcome is uncertain; no restore attempted' );
			}
			if ( lastOwnedRevision ) {
				const latest = ( await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids' } ) )
					.query.pages[ 0 ].revisions[ 0 ].revid;
				if ( latest !== lastOwnedRevision ) {
					throw new Error( 'Fields cleanup requires review: another edit intervened; no restore attempted' );
				}
				const restored = await api( { action: 'layerspublish', owner, baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ), maintext: initialText,
					summary: 'Fields acceptance cleanup: restore automated owner state', token: csrfToken }, true );
				expect( restored.layerspublish && restored.layerspublish.result ).toBe( 'Success' );
				const check = await api( { action: 'layersread', owner, revid: String( restored.layerspublish.revid ) } );
				expect( check.layersread.snapshot ).toEqual( initialSnapshot );
			}
		};
		await restore();
	}
} );
