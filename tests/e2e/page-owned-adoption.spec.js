/* eslint-env node */
/**
 * Opt-in: copies a shared legacy slide into the dedicated Layers_browser_acceptance owner through
 * Special:AdoptLayersDrawing, then restores the owner's text and drawings with an exact-base publication.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'an editor makes a shared slide owned by the page only after confirming it', async ( { page, context } ) => {
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires an explicitly provisioned, seeded pilot automation owner' );
	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	expect( url.port ).toBe( '8080' );
	expect( [ '', '/' ] ).toContain( url.pathname );
	expect( url.search + url.hash + url.username + url.password ).toBe( '' );
	const base = url.origin;
	const owner = 'Layers_browser_acceptance';
	const slide = 'LayersAdoptionAcceptance';
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
		const result = await api( { action: 'query', prop: 'revisions', titles: owner,
			rvprop: 'ids|content|tags', rvslots: 'main' } );
		const record = result.query.pages[ 0 ];
		return { pageId: record.pageid, revision: record.revisions[ 0 ].revid,
			text: record.revisions[ 0 ].slots.main.content, tags: record.revisions[ 0 ].tags };
	};
	const initial = await latest();
	const initialSnapshot = ( await api( { action: 'layersread', owner, revid: String( initial.revision ) } ) )
		.layersread.snapshot;

	// The shared original: an ordinary legacy slide set, drawn in a colour nothing else on the page uses.
	const saved = await api( { action: 'layerssave', slidename: slide, token: csrfToken, data: JSON.stringify( {
		canvasWidth: 800, canvasHeight: 600, backgroundColor: '#ffffff', layers: [
			{ id: 'adopt_rect', type: 'rectangle', x: 100, y: 100, width: 300, height: 200,
				fill: '#00c000', stroke: 'none' },
			{ id: 'adopt_text', type: 'text', x: 120, y: 340, text: 'Adoption acceptance drawing',
				fontSize: 20, color: '#000000' }
		] } ) }, true );
	expect( saved.layerssave && saved.layerssave.success ).toBeTruthy();
	const sharedBefore = ( await api( { action: 'layersinfo', filename: 'Slide:' + slide } ) ).layersinfo.layerset;
	expect( sharedBefore ).toBeTruthy();

	let lastOwnedRevision = null;
	let publicationPending = false;
	try {
		const embed = `{{#Slide:${ slide }|width=400}}`;
		const withShared = `${ initial.text }\n\n${ embed }`;
		publicationPending = true;
		const seeded = await api( { action: 'layerspublish', owner, baserevid: String( initial.revision ),
			data: JSON.stringify( initialSnapshot ), maintext: withShared,
			summary: 'Adoption acceptance: embed a shared slide', token: csrfToken }, true );
		expect( seeded.layerspublish && seeded.layerspublish.result ).toBe( 'Success' );
		lastOwnedRevision = seeded.layerspublish.revid;
		publicationPending = false;

		// The page offers the shared slide to its editor; nothing is written by looking.
		await page.goto( `${ base }/index.php?title=${ owner }` );
		const adopt = page.locator( '.layers-page-adopt-link' );
		await expect( adopt ).toHaveCount( 1 );
		await expect( adopt ).toContainText( slide );
		const confirmation = new URL( await adopt.getAttribute( 'href' ), base ).href;
		await adopt.click();
		await expect( page.locator( '#mw-content-text' ) ).toContainText( slide );
		await expect( page.locator( '#mw-content-text' ) ).toContainText( sharedBefore.name );
		expect( ( await latest() ).revision ).toBe( lastOwnedRevision );

		// Confirming publishes exactly one page revision whose drawing is a copy of the shared set.
		publicationPending = true;
		await Promise.all( [
			page.waitForURL( ( target ) => target.searchParams.get( 'title' ) === owner ||
				target.pathname.endsWith( '/' + owner ) ),
			page.locator( '.mw-htmlform-submit button, button[type=submit]' ).first().click()
		] );
		const adopted = await latest();
		expect( adopted.revision ).toBeGreaterThan( lastOwnedRevision );
		lastOwnedRevision = adopted.revision;
		publicationPending = false;
		expect( adopted.tags ).toContain( 'layers-page-drawing' );
		const binding = adopted.text.match( new RegExp( `\\{\\{#Slide:${ slide }\\|width=400\\|layersbinding=` +
			`(v1:${ initial.pageId }:[A-Za-z0-9_]+)\\}\\}$` ) );
		expect( binding ).not.toBeNull();
		expect( adopted.text.slice( 0, withShared.length - embed.length ) ).toBe( initial.text + '\n\n' );
		const snapshot = ( await api( { action: 'layersread', owner, revid: String( adopted.revision ) } ) )
			.layersread.snapshot;
		expect( snapshot.surfaces.length ).toBe( initialSnapshot.surfaces.length + 1 );
		const surface = snapshot.surfaces.find( ( s ) => binding[ 1 ].endsWith( ':' + s.id ) );
		expect( surface.layers.map( ( l ) => l.id ) ).toEqual( [ 'adopt_rect', 'adopt_text' ] );

		// The page now draws its own copy and no longer offers adoption; the shared original is unchanged.
		await expect( page.locator( '.layers-page-adopt-link' ) ).toHaveCount( 0 );
		await expect( page.locator( `.layers-bound-slide[data-layers-binding="${ binding[ 1 ] }"] canvas` ) )
			.toBeVisible();
		const sharedAfter = ( await api( { action: 'layersinfo', filename: 'Slide:' + slide } ) ).layersinfo.layerset;
		expect( [ sharedAfter.id, sharedAfter.revision ] ).toEqual( [ sharedBefore.id, sharedBefore.revision ] );

		// Returning to the same confirmation is refused rather than adopting twice.
		await page.goto( confirmation );
		await expect( page.locator( '.mw-htmlform-submit' ) ).toHaveCount( 0 );
		expect( ( await latest() ).revision ).toBe( lastOwnedRevision );
	} finally {
		const restore = async () => {
			if ( lastOwnedRevision !== null ) {
				if ( publicationPending ) {
					throw new Error( 'Adoption cleanup requires review: publication outcome is uncertain; no restore attempted' );
				}
				const current = await latest();
				if ( current.pageId !== initial.pageId || current.revision !== lastOwnedRevision ) {
					throw new Error( 'Adoption cleanup requires review: another edit intervened; no restore attempted' );
				}
				const restored = await api( { action: 'layerspublish', owner, baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ), maintext: initial.text,
					summary: 'Adoption acceptance cleanup: restore automated owner state', token: csrfToken }, true );
				if ( !restored.layerspublish || restored.layerspublish.result !== 'Success' ) {
					throw new Error( 'Adoption cleanup failed; no retry or forced overwrite attempted' );
				}
				const verify = await api( { action: 'layersread', owner,
					revid: String( restored.layerspublish.revid ) } );
				expect( verify.layersread.snapshot ).toEqual( initialSnapshot );
				expect( ( await latest() ).text ).toBe( initial.text );
			}
		};
		await restore();
	}
} );
