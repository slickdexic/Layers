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

test( 'shared-slide adoption presentation verifies notices, confirmation page, refusal states, keyboard navigation and dark mode', async ( { page, context } ) => {
	test.setTimeout( 120000 );
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires an explicitly provisioned, seeded pilot automation owner' );
	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const base = new URL( config.base ).origin;
	const owner = 'Layers_browser_acceptance';
	const slide = 'LayersAdoptionJ64Slide';
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

	// Save valid adoptable slide
	const saved = await api( { action: 'layerssave', slidename: slide, token: csrfToken, data: JSON.stringify( {
		canvasWidth: 800, canvasHeight: 600, backgroundColor: '#ffffff', layers: [
			{ id: 'j64_rect', type: 'rectangle', x: 50, y: 50, width: 200, height: 150,
				fill: '#0088cc', stroke: 'none' },
			{ id: 'j64_text', type: 'text', x: 60, y: 220, text: 'J64 presentation test',
				fontSize: 18, color: '#111111' }
		] } ) }, true );
	expect( saved.layerssave && saved.layerssave.success ).toBeTruthy();

	let lastOwnedRevision = null;
	let publicationPending = false;
	try {
		const embed = `{{#Slide:${ slide }|width=400}}`;
		const withShared = `${ initial.text }\n\n${ embed }`;
		publicationPending = true;
		const seeded = await api( { action: 'layerspublish', owner, baserevid: String( initial.revision ),
			data: JSON.stringify( initialSnapshot ), maintext: withShared,
			summary: 'J64 review: seed shared slide for presentation checks', token: csrfToken }, true );
		expect( seeded.layerspublish && seeded.layerspublish.result ).toBe( 'Success' );
		lastOwnedRevision = seeded.layerspublish.revid;
		publicationPending = false;

		// 1. Shared-slide notice and adoption links presentation on owner page
		await page.goto( `${ base }/index.php?title=${ owner }` );
		const controls = page.locator( '.layers-page-edit-controls' );
		await expect( controls ).toHaveCount( 1 );
		await expect( controls ).toHaveAttribute( 'aria-labelledby', 'layers-page-edit-controls-heading' );

		const heading = controls.locator( '#layers-page-edit-controls-heading' );
		await expect( heading ).toHaveText( 'Drawings on this page' );
		await expect( heading ).toHaveAttribute( 'role', 'heading' );
		await expect( heading ).toHaveAttribute( 'aria-level', '2' );

		const notice = controls.locator( '.layers-page-edit-controls__notice' );
		await expect( notice ).toContainText( 'Some drawings on this page are shared' );
		await expect( notice ).toContainText( 'shared original is not changed' );

		const adoptLink = controls.locator( '.layers-page-adopt-link' );
		await expect( adoptLink ).toHaveCount( 1 );
		await expect( adoptLink ).toHaveText( `Make “${ slide }” owned by this page` );

		// Keyboard focus on link
		await adoptLink.focus();
		const isLinkFocused = await adoptLink.evaluate( ( el ) => el === document.activeElement );
		expect( isLinkFocused ).toBe( true );

		// Dark mode presentation on owner page (Vector 2022): colours must follow the theme and stay readable.
		// Read settled colours: Codex animates colour changes, so a theme switch is otherwise read mid-transition.
		const noTransitions = '*, *::before, *::after { transition: none !important; }';
		const themeColours = async ( theme ) => {
			await page.goto( `${ base }/index.php?title=${ owner }&useskin=vector-2022` );
			await page.addStyleTag( { content: noTransitions } );
			return page.evaluate( ( t ) => {
				const html = document.documentElement;
				html.classList.remove( 'skin-theme-clientpref-day', 'skin-theme-clientpref-night',
					'skin-theme-clientpref-os' );
				html.classList.add( 'skin-theme-clientpref-' + t );
				const rgb = ( value ) => value.match( /[\d.]+/g ).slice( 0, 3 ).map( Number );
				const luminance = ( value ) => {
					const [ r, g, b ] = rgb( value ).map( ( c ) => {
						const s = c / 255;
						return s <= 0.03928 ? s / 12.92 : Math.pow( ( s + 0.055 ) / 1.055, 2.4 );
					} );
					return 0.2126 * r + 0.7152 * g + 0.0722 * b;
				};
				const contrast = ( a, b ) => {
					const [ hi, lo ] = [ luminance( a ), luminance( b ) ].sort( ( x, y ) => y - x );
					return ( hi + 0.05 ) / ( lo + 0.05 );
				};
				const style = ( selector ) => window.getComputedStyle( document.querySelector( selector ) );
				const background = style( '.layers-page-edit-controls' ).backgroundColor;
				return { background, contrasts: [ '.layers-page-edit-controls__heading',
					'.layers-page-edit-controls__notice', '.layers-page-adopt-link' ]
					.map( ( selector ) => contrast( style( selector ).color, background ) ) };
			}, theme );
		};
		const day = await themeColours( 'day' );
		const night = await themeColours( 'night' );
		expect( night.background ).not.toBe( day.background );
		for ( const ratio of [ ...day.contrasts, ...night.contrasts ] ) {
			expect( ratio ).toBeGreaterThanOrEqual( 4.5 );
		}

		// 2. Confirmation page presentation (Special:AdoptLayersDrawing - GET Preview)
		const confirmationUrl = new URL( await adoptLink.getAttribute( 'href' ), base ).href;
		await page.goto( confirmationUrl );
		await expect( page.locator( '#firstHeading' ) ).toHaveText( 'Make a shared drawing owned by a page' );
		await expect( page.locator( 'meta[name="robots"]' ) ).toHaveAttribute( 'content', /noindex,nofollow/ );

		const introParagraph = page.locator( '.mw-htmlform-ooui-wrapper p, #mw-content-text p' ).first();
		await expect( introParagraph ).toContainText( slide );
		await expect( introParagraph ).toContainText( 'default' );
		await expect( introParagraph.locator( 'a' ) ).toHaveText( 'Layers browser acceptance' );

		// OOUI Form structure and labels
		const form = page.locator( '.mw-htmlform' );
		await expect( form ).toHaveCount( 1 );
		const summaryLabel = form.locator( 'label' ).first();
		await expect( summaryLabel ).toHaveText( 'Summary:' );
		const summaryInput = form.locator( 'input[name="wpsummary"]' );
		await expect( summaryInput ).toHaveValue( `Made the drawing “${ slide }” owned by this page` );
		await expect( summaryInput ).toHaveAttribute( 'maxlength', '500' );

		const submitButton = form.locator( 'button[type="submit"]' );
		await expect( submitButton ).toHaveText( 'Make it owned by the page' );

		const cancelButton = form.locator( '.mw-htmlform-submit-buttons a[role="button"]' );
		await expect( cancelButton ).toHaveCount( 1 );
		await expect( cancelButton ).toHaveText( 'Cancel' );
		await expect( cancelButton ).toHaveAttribute( 'href', /\/Layers_browser_acceptance$/ );

		// Keyboard focus navigation on confirmation page: Summary input -> Submit -> Cancel
		await summaryInput.focus();
		expect( await summaryInput.evaluate( ( el ) => el === document.activeElement ) ).toBe( true );
		await page.keyboard.press( 'Tab' );
		expect( await submitButton.evaluate( ( el ) => el === document.activeElement ) ).toBe( true );
		await page.keyboard.press( 'Tab' );
		expect( await cancelButton.evaluate( ( el ) => el === document.activeElement ) ).toBe( true );

		// Dark mode on confirmation page: OOUI follows the theme.
		await page.goto( `${ confirmationUrl }&useskin=vector-2022` );
		await page.addStyleTag( { content: noTransitions } );
		const inputColours = async ( theme ) => page.evaluate( ( t ) => {
			const html = document.documentElement;
			html.classList.remove( 'skin-theme-clientpref-day', 'skin-theme-clientpref-night',
				'skin-theme-clientpref-os' );
			html.classList.add( 'skin-theme-clientpref-' + t );
			const style = window.getComputedStyle( document.querySelector( 'input[name="wpsummary"]' ) );
			return style.color + '/' + style.backgroundColor;
		}, theme );
		expect( await inputColours( 'night' ) ).not.toBe( await inputColours( 'day' ) );

		// 3. Refusal messages
		// 3a. Malformed request refusal
		await page.goto( `${ base }/index.php?title=Special:AdoptLayersDrawing&pageid=invalid` );
		await expect( page.locator( '#mw-content-text' ) )
			.toContainText( 'This drawing cannot be made owned by its page right now. Nothing was saved.' );
		await expect( page.locator( '.mw-htmlform' ) ).toHaveCount( 0 );
		await expect( page.locator( 'button[type="submit"]' ) ).toHaveCount( 0 );

		// 3b. A marker drawing, which page history once refused, is now offered like any other drawing
		const unrenderableSlide = 'LayersAdoptionJ64Unrenderable';
		await api( { action: 'layerssave', slidename: unrenderableSlide, token: csrfToken, data: JSON.stringify( {
			canvasWidth: 800, canvasHeight: 600, backgroundColor: '#ffffff', layers: [
				{ id: 'bad_marker', type: 'marker', x: 10, y: 10, text: 'M1' }
			] } ) }, true );
		const unrenderableEmbed = `{{#Slide:${ unrenderableSlide }|width=400}}`;
		publicationPending = true;
		const seededUnrenderable = await api( { action: 'layerspublish', owner, baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ), maintext: `${ initial.text }\n\n${ unrenderableEmbed }`,
			summary: 'J64 review: seed unrenderable slide', token: csrfToken }, true );
		expect( seededUnrenderable.layerspublish && seededUnrenderable.layerspublish.result ).toBe( 'Success' );
		lastOwnedRevision = seededUnrenderable.layerspublish.revid;
		publicationPending = false;

		await page.goto( `${ base }/index.php?title=${ owner }` );
		const unrenderableAdoptLink = page.locator( '.layers-page-adopt-link' );
		await expect( unrenderableAdoptLink ).toHaveCount( 1 );
		const unrenderableUrl = new URL( await unrenderableAdoptLink.getAttribute( 'href' ), base ).href;
		await page.goto( unrenderableUrl );
		await expect( page.locator( '.mw-htmlform' ) ).toHaveCount( 1 );
		await expect( page.locator( '#mw-content-text' ) ).not.toContainText( 'cannot display' );
		await expect( page.locator( 'button[type="submit"]' ).first() ).toContainText( 'Make it owned by the page' );

		// 3c. Edit conflict refusal on POST
		// Reseed owner with valid adoptable slide
		publicationPending = true;
		const seededConflict = await api( { action: 'layerspublish', owner, baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ), maintext: `${ initial.text }\n\n${ embed }`,
			summary: 'J64 review: seed for conflict test', token: csrfToken }, true );
		expect( seededConflict.layerspublish && seededConflict.layerspublish.result ).toBe( 'Success' );
		lastOwnedRevision = seededConflict.layerspublish.revid;
		publicationPending = false;

		await page.goto( `${ base }/index.php?title=${ owner }` );
		const conflictUrl = new URL( await page.locator( '.layers-page-adopt-link' ).getAttribute( 'href' ), base ).href;
		await page.goto( conflictUrl );
		await expect( page.locator( 'button[type="submit"]' ) ).toHaveCount( 1 );

		// Intervene on owner page to advance base
		const intervening = await api( { action: 'edit', title: owner,
			text: `${ initial.text }\n\n${ embed }\n\nIntervening text`,
			summary: 'J64 review: intervening edit to create conflict', token: csrfToken }, true );
		expect( intervening.edit && intervening.edit.result ).toBe( 'Success' );
		lastOwnedRevision = intervening.edit.newrevid;

		// Submit the stale confirmation
		await page.locator( 'button[type="submit"]' ).click();
		await expect( page.locator( '#mw-content-text' ) )
			.toContainText( 'has changed since this confirmation was opened, so nothing was saved.' );
		await expect( page.locator( '#mw-content-text' ) )
			.toContainText( 'Return to Layers browser acceptance.' );
		await expect( page.locator( '.mw-htmlform' ) ).toHaveCount( 0 );
		await expect( page.locator( 'button[type="submit"]' ) ).toHaveCount( 0 );
	} finally {
		const restore = async () => {
			if ( lastOwnedRevision !== null ) {
				if ( publicationPending ) {
					throw new Error( 'J64 cleanup requires review: publication outcome is uncertain; no restore attempted' );
				}
				const current = await latest();
				if ( current.pageId !== initial.pageId || current.revision !== lastOwnedRevision ) {
					throw new Error( 'J64 cleanup requires review: another edit intervened; no restore attempted' );
				}
				const restored = await api( { action: 'layerspublish', owner, baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ), maintext: initial.text,
					summary: 'J64 review cleanup: restore automated owner state', token: csrfToken }, true );
				if ( !restored.layerspublish || restored.layerspublish.result !== 'Success' ) {
					throw new Error( 'J64 cleanup failed; no retry or forced overwrite attempted' );
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
