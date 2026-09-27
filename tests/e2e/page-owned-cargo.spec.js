/* eslint-env node */
/**
 * J75 Cargo projection acceptance:
 * Proves on the original test wiki (http://localhost:8080) that page-owned
 * drawing text reaches a real Cargo table and stays current across drawing-only
 * edits, layer visibility changes, drawing version restoration, and template removal.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'page-owned drawing text projects to Cargo table and stays current', async ( { page, context } ) => {
	test.setTimeout( 360000 );
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires an explicitly provisioned, seeded pilot automation owner' );

	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	expect( url.port ).toBe( '8080' );
	expect( url.search + url.hash + url.username + url.password ).toBe( '' );
	const base = url.origin;

	if ( ( url.pathname && url.pathname !== '/' && url.pathname !== '/index.php' ) ||
		config.base.includes( '/tmp/' ) || config.base.includes( 'browser-' )
	) {
		throw new Error( 'Acceptance configuration must target the original wiki root' );
	}

	const owner = 'Layers_browser_acceptance';
	const isolationPageTitle = 'Layers_browser_acceptance_isolation';
	const templateTitle = 'Template:Layers_cargo_acceptance';
	const cargoTable = 'Layers_cargo_acceptance';

	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ?
			await context.request.post( base + '/api.php', { form: params } ) :
			await context.request.get( base + '/api.php', { params } );
		return response.json();
	};

	// Authenticate as the QA actor
	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( {
		action: 'login',
		lgname: config.username,
		lgpassword: config.password,
		lgtoken: loginToken
	}, true );
	expect( login.login.result ).toBe( 'Success' );
	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;

	// Check test account rights: requires recreatecargodata and runcargoqueries
	const userinfo = ( await api( { action: 'query', meta: 'userinfo', uiprop: 'rights' } ) ).query.userinfo;
	const hasRecreateCargoData = userinfo.rights.includes( 'recreatecargodata' );
	const hasRunCargoQueries = userinfo.rights.includes( 'runcargoqueries' );
	test.skip( !hasRecreateCargoData || !hasRunCargoQueries, 'Test account requires recreatecargodata and runcargoqueries rights for Cargo acceptance' );

	// Ten-minute rule: verify owner has not changed in the last 10 minutes
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
	expect( pageId ).toBe( 228 );

	const initialRev = initialPageData.revisions[ 0 ];
	const initialRevId = initialRev.revid;
	const initialMainText = initialRev.slots.main.content;
	const diffMinutes = ( serverTime - new Date( initialRev.timestamp ).getTime() ) / 60000;
	const isPrecedingTestCleanup = initialRev.user === config.username &&
		initialMainText === 'Dedicated automated Layers history acceptance page.';
	if ( diffMinutes < 10 && !isPrecedingTestCleanup ) {
		throw new Error( `Owner ${ owner } was modified ${ diffMinutes.toFixed( 1 ) } minutes ago (within last 10 minutes); stopping per J75 wiki rules` );
	}

	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;
	expect( initialSnapshot.surfaces ).toHaveLength( 1 );
	expect( initialSnapshot.surfaces[ 0 ].id ).toBe( 'presentation' );

	// Isolation page state
	const initialIsoQuery = await api( {
		action: 'query',
		prop: 'info|revisions',
		titles: isolationPageTitle,
		rvprop: 'content',
		rvslots: 'main'
	} );
	const initialIsoPage = initialIsoQuery.query.pages[ 0 ];
	expect( initialIsoPage.missing ).toBeUndefined();
	const isolationPageId = initialIsoPage.pageid;
	expect( isolationPageId ).toBe( 230 );
	const initialIsoText = initialIsoPage.revisions[ 0 ].slots.main.content;

	const queryCargo = async ( where ) => {
		const res = await api( {
			action: 'cargoquery',
			tables: cargoTable,
			fields: '_pageID=pageID,surface_id=surface_id,surface_label=surface_label,surface_kind=surface_kind,drawing_text=drawing_text',
			where
		} );
		if ( res.error ) {
			throw new Error( `cargoquery error: ${ JSON.stringify( res.error ) }` );
		}
		return ( res.cargoquery || [] ).map( ( item ) => ( {
			_pageID: item.title.pageID,
			surface_id: item.title.surface_id,
			surface_label: item.title.surface_label,
			surface_kind: item.title.surface_kind,
			drawing_text: item.title.drawing_text
		} ) );
	};

	let templateAddedToOwner = false;
	let templateAddedToIsolation = false;

	try {
		// =========================================================================
		// Step 1: Create template with #cargo_declare and {{#layers_cargo_store:}}
		//         and create/recreate Cargo table via template's recreate data action
		// =========================================================================
		const templateWikitext = '<noinclude>{{#cargo_declare:_table=Layers_cargo_acceptance\n' +
			' |surface_id=String\n' +
			' |surface_label=String\n' +
			' |surface_kind=String\n' +
			' |source_file=Page\n' +
			' |source_page=Integer\n' +
			' |drawing_text=Text}}</noinclude><includeonly>{{#layers_cargo_store:}}</includeonly>';

		const templateQuery = ( await api( {
			action: 'query',
			prop: 'revisions',
			titles: templateTitle,
			rvprop: 'content',
			rvslots: 'main'
		} ) ).query.pages[ 0 ];

		if ( templateQuery.missing || templateQuery.revisions?.[ 0 ]?.slots?.main?.content !== templateWikitext ) {
			const editRes = await api( {
				action: 'edit',
				title: templateTitle,
				text: templateWikitext,
				summary: 'J75: declare Layers_cargo_acceptance table',
				token: csrfToken
			}, true );
			expect( editRes.edit?.result ).toBe( 'Success' );
		}

		// Navigate to the template page's recreate data action
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( templateTitle ) }` );
		const recreateTab = page.locator( 'a[href*="action=recreatedata"]' );
		if ( await recreateTab.isVisible() ) {
			await Promise.all( [
				page.waitForNavigation(),
				recreateTab.click()
			] );
		} else {
			await page.goto( `${ base }/index.php?title=${ encodeURIComponent( templateTitle ) }&action=recreatedata` );
		}

		await expect( page.locator( '#recreateDataCanvas' ) ).toBeVisible();

		// If createReplacement checkbox exists and is checked, uncheck it to operate directly on the table
		const replacementCheckbox = page.locator( 'input[name="createReplacement"]' );
		if ( await replacementCheckbox.count() > 0 && await replacementCheckbox.isChecked() ) {
			await replacementCheckbox.uncheck();
		}

		// Click the submit button to create/recreate table
		const submitBtn = page.locator( '#cargoSubmit button, #cargoSubmit input, #cargoSubmit' ).first();
		await expect( submitBtn ).toBeVisible();
		await submitBtn.click();

		// Wait for recreate data job completion
		await expect( page.locator( '#recreateDataProgress' ) ).toContainText( 'View table', { timeout: 30000 } );

		// Confirm table exists by querying cargo (should be empty for now)
		const initialCargoCheck = await queryCargo( `_pageID=${ pageId }` );
		expect( initialCargoCheck ).toEqual( [] );

		// =========================================================================
		// Step 2: Add template to owner by an ordinary edit; verify Cargo row
		// =========================================================================
		const ownerWithTemplateText = `{{Layers_cargo_acceptance}}\n${ initialMainText }`;
		const addTemplateRes = await api( {
			action: 'edit',
			title: owner,
			text: ownerWithTemplateText,
			summary: 'J75: add cargo template to owner',
			token: csrfToken
		}, true );
		expect( addTemplateRes.edit?.result ).toBe( 'Success' );
		templateAddedToOwner = true;
		const postTemplateRevId = addTemplateRes.edit.newrevid;

		// Verify Cargo row: 1 row per drawing of current revision with expected values
		await expect.poll( async () => ( await queryCargo( `_pageID=${ pageId }` ) ).length ).toBe( 1 );
		const step2Rows = await queryCargo( `_pageID=${ pageId }` );
		expect( step2Rows ).toHaveLength( 1 );
		expect( step2Rows[ 0 ]._pageID ).toBe( String( pageId ) );
		expect( step2Rows[ 0 ].surface_id ).toBe( 'presentation' );
		expect( step2Rows[ 0 ].surface_label ).toBe( 'Welcome Slide' );
		expect( step2Rows[ 0 ].surface_kind ).toBe( 'slide' );
		expect( step2Rows[ 0 ].drawing_text ).toBe( 'Visual ideas — 世界' );

		// =========================================================================
		// Step 3: Change one text layer through the page-owned editor (drawing-only save)
		// =========================================================================
		await page.goto( `${ base }/index.php?${ new URLSearchParams( {
			title: 'Special:EditLayersPage',
			owner,
			revid: String( postTemplateRevId ),
			surface: 'presentation'
		} ) }` );

		await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 );

		// Select text layer
		await page.locator( '.layer-item:not(.background-layer-item)' ).first().click();

		const updatedText = 'Cargo acceptance updated text';
		const textInput = page.locator( '.property-field' ).filter( { hasText: 'Text' } ).locator( 'input' );
		if ( await textInput.count() > 0 ) {
			await textInput.fill( updatedText );
		} else {
			await page.evaluate( ( textVal ) => {
				const layers = window.layersEditorInstance.stateManager.get( 'layers' );
				window.layersEditorInstance.updateLayer( layers[ 0 ].id, { text: textVal } );
			}, updatedText );
		}
		await expect.poll( () => page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' )[ 0 ].text ) )
			.toBe( updatedText );

		// Save via editor
		const step3SavePromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const step3SaveRes = await ( await step3SavePromise ).json();
		expect( step3SaveRes.layerspublish?.result ).toBe( 'Success' );
		const postEditTextRevId = step3SaveRes.layerspublish.revid;
		expect( postEditTextRevId ).toBeGreaterThan( postTemplateRevId );
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Cargo row must update to new text and omit old text
		await expect.poll( async () => ( await queryCargo( `_pageID=${ pageId }` ) ).map( ( r ) => r.drawing_text ) )
			.toEqual( [ updatedText ] );
		const step3Rows = await queryCargo( `_pageID=${ pageId }` );
		expect( step3Rows ).toHaveLength( 1 );
		expect( step3Rows[ 0 ].drawing_text ).toBe( updatedText );
		expect( step3Rows[ 0 ].drawing_text ).not.toContain( 'Visual ideas — 世界' );

		// =========================================================================
		// Step 4: Hide that layer and save: text must disappear from row
		// =========================================================================
		await page.locator( '.layer-item:not(.background-layer-item) .layer-visibility' ).first().click();
		await expect.poll( () => page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' )[ 0 ].visible ) )
			.toBe( false );

		const step4SavePromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const step4SaveRes = await ( await step4SavePromise ).json();
		expect( step4SaveRes.layerspublish?.result ).toBe( 'Success' );
		const postHideRevId = step4SaveRes.layerspublish.revid;
		expect( postHideRevId ).toBeGreaterThan( postEditTextRevId );
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Cargo row text must disappear
		await expect.poll( async () => ( await queryCargo( `_pageID=${ pageId }` ) ).map( ( r ) => r.drawing_text ) )
			.toEqual( [ '' ] );
		const step4Rows = await queryCargo( `_pageID=${ pageId }` );
		expect( step4Rows ).toHaveLength( 1 );
		expect( step4Rows[ 0 ].drawing_text ).toBe( '' );

		// =========================================================================
		// Step 5: Restore the previous drawing version: Cargo row must follow
		// =========================================================================
		await page.goto( `${ base }/index.php?${ new URLSearchParams( {
			title: 'Special:ViewLayersPage',
			owner,
			revid: String( postEditTextRevId ),
			surface: 'presentation'
		} ) }` );

		await expect( page.locator( '.ext-layers-historical-canvas' ) ).toBeVisible();
		const restoreBtn = page.locator( '.mw-htmlform-submit button, button[type=submit]' ).first();
		await expect( restoreBtn ).toBeVisible();
		await expect( restoreBtn ).toContainText( 'Restore this version' );

		await Promise.all( [
			page.waitForURL( ( u ) => u.searchParams.get( 'title' ) === owner || u.pathname.endsWith( '/' + owner ) ),
			restoreBtn.click()
		] );

		// Cargo row must follow restored drawing version
		await expect.poll( async () => ( await queryCargo( `_pageID=${ pageId }` ) ).map( ( r ) => r.drawing_text ) )
			.toEqual( [ updatedText ] );
		const step5Rows = await queryCargo( `_pageID=${ pageId }` );
		expect( step5Rows ).toHaveLength( 1 );
		expect( step5Rows[ 0 ].drawing_text ).toBe( updatedText );

		// =========================================================================
		// Step 6: Put template on isolation page (owns no drawings): stores no rows
		// =========================================================================
		const isoWithTemplateText = `${ initialIsoText }\n{{Layers_cargo_acceptance}}`;
		const isoAddRes = await api( {
			action: 'edit',
			title: isolationPageTitle,
			text: isoWithTemplateText,
			summary: 'J75: add cargo template to isolation page',
			token: csrfToken
		}, true );
		expect( isoAddRes.edit?.result ).toBe( 'Success' );
		templateAddedToIsolation = true;

		// Isolation page owns no drawings, so Cargo must store no rows for it
		await expect.poll( async () => ( await queryCargo( `_pageID=${ isolationPageId }` ) ).length ).toBe( 0 );
		const step6Rows = await queryCargo( `_pageID=${ isolationPageId }` );
		expect( step6Rows ).toEqual( [] );

		// =========================================================================
		// Step 7: Remove template from both pages: both pages' rows must be gone.
		//         Restore owner with exact-base CAS cleanup; leave template & table.
		// =========================================================================
		// 7a. Remove from isolation page
		const isoCleanRes = await api( {
			action: 'edit',
			title: isolationPageTitle,
			text: initialIsoText,
			summary: 'J75 cleanup: restore isolation page',
			token: csrfToken
		}, true );
		expect( isoCleanRes.edit?.result ).toBe( 'Success' );
		templateAddedToIsolation = false;

		await expect.poll( async () => ( await queryCargo( `_pageID=${ isolationPageId }` ) ).length ).toBe( 0 );
		expect( await queryCargo( `_pageID=${ isolationPageId }` ) ).toEqual( [] );

		// 7b. Restore owner via exact-base CAS publication with baseline snapshot and text
		const latestOwnerQuery = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids'
		} );
		const latestOwnerRevId = latestOwnerQuery.query.pages[ 0 ].revisions[ 0 ].revid;

		const ownerCleanRes = await api( {
			action: 'layerspublish',
			owner,
			pageid: String( pageId ),
			baserevid: String( latestOwnerRevId ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J75 cleanup: restore automated owner state',
			token: csrfToken
		}, true );
		expect( ownerCleanRes.layerspublish?.result ).toBe( 'Success' );
		templateAddedToOwner = false;

		// Cargo row for owner must be gone
		await expect.poll( async () => ( await queryCargo( `_pageID=${ pageId }` ) ).length ).toBe( 0 );
		expect( await queryCargo( `_pageID=${ pageId }` ) ).toEqual( [] );
	} finally {
		// Guaranteed cleanup if test aborted prematurely
		if ( templateAddedToIsolation ) {
			await api( {
				action: 'edit',
				title: isolationPageTitle,
				text: initialIsoText,
				summary: 'J75 cleanup: restore isolation page in finally',
				token: csrfToken
			}, true );
		}
		if ( templateAddedToOwner ) {
			const checkCurrent = ( await api( {
				action: 'query',
				prop: 'revisions',
				titles: owner,
				rvprop: 'ids|content',
				rvslots: 'main'
			} ) ).query.pages[ 0 ];
			if ( checkCurrent && !checkCurrent.missing && checkCurrent.revisions ) {
				const curRev = checkCurrent.revisions[ 0 ];
				if ( curRev.slots.main.content !== initialMainText ) {
					await api( {
						action: 'layerspublish',
						owner,
						pageid: String( pageId ),
						baserevid: String( curRev.revid ),
						data: JSON.stringify( initialSnapshot ),
						maintext: initialMainText,
						summary: 'J75 cleanup: restore automated owner state in finally',
						token: csrfToken
					}, true );
				}
			}
		}
	}
} );
