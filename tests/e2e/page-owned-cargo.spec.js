/* eslint-env node */
/**
 * J75 Cargo projection acceptance:
 * Proves on the original test wiki (http://localhost:8080) that page-owned
	 * layer text reaches real Cargo tables and stays current across layer-only
	 * edits, layer visibility changes, layer-set restoration, and template removal.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'page-owned layer-set data projects to both Cargo row modes and stays current', async ( { page, context } ) => {
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
	const layerRowsTemplateTitle = 'Template:Layers_cargo_layer_rows_acceptance';
	const cargoTable = 'Layers_cargo_acceptance';
	const layerRowsTable = 'Layers_cargo_layer_rows_acceptance';

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
	let lastOwnedRevision = initialRevId;
	let ownerWithTemplateText = initialMainText;

	// Isolation page state
	const initialIsoQuery = await api( {
		action: 'query',
		prop: 'info|revisions',
		titles: isolationPageTitle,
		rvprop: 'ids|content',
		rvslots: 'main'
	} );
	const initialIsoPage = initialIsoQuery.query.pages[ 0 ];
	expect( initialIsoPage.missing ).toBeUndefined();
	const isolationPageId = initialIsoPage.pageid;
	expect( isolationPageId ).toBe( 230 );
	const initialIsoText = initialIsoPage.revisions[ 0 ].slots.main.content;
	let lastIsolationRevision = initialIsoPage.revisions[ 0 ].revid;
	let isolationWithTemplatesText = initialIsoText;

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
	const queryLayerRows = async ( where ) => {
		const res = await api( {
			action: 'cargoquery',
			tables: layerRowsTable,
			fields: 'page=page,revision=revision,layer_set=layer_set,kind=kind,layer=layer,type=type,text=text,link_target=link_target',
			where
		} );
		if ( res.error ) {
			throw new Error( `cargoquery error: ${ JSON.stringify( res.error ) }` );
		}
		return ( res.cargoquery || [] ).map( ( item ) => ( {
			page: item.title.page,
			revision: item.title.revision,
			layer_set: item.title.layer_set,
			kind: item.title.kind,
			layer: item.title.layer,
			type: item.title.type,
			text: item.title.text,
			link_target: item.title.link_target
		} ) );
	};
	const recreateCargoTable = async ( title ) => {
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( title ) }` );
		const recreateTab = page.locator( 'a[href*="action=recreatedata"]' );
		if ( await recreateTab.isVisible() ) {
			await Promise.all( [
				page.waitForNavigation(),
				recreateTab.click()
			] );
		} else {
			await page.goto( `${ base }/index.php?title=${ encodeURIComponent( title ) }&action=recreatedata` );
		}

		await expect( page.locator( '#recreateDataCanvas' ) ).toBeVisible();
		const replacementCheckbox = page.locator( 'input[name="createReplacement"]' );
		if ( await replacementCheckbox.count() > 0 && await replacementCheckbox.isChecked() ) {
			await replacementCheckbox.uncheck();
		}
		const submitBtn = page.locator( '#cargoSubmit button, #cargoSubmit input, #cargoSubmit' ).first();
		await expect( submitBtn ).toBeVisible();
		await submitBtn.click();
		await expect( page.locator( '#recreateDataProgress' ) ).toContainText( 'View table', { timeout: 30000 } );
	};

	let templateAddedToOwner = false;
	let templateAddedToIsolation = false;

	try {
		// =========================================================================
		// Step 1: Keep the existing layer-set table and declare a separate opt-in
		//         layer-row table, then recreate both from their own templates.
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
		const layerRowsTemplateWikitext = '<noinclude>{{#cargo_declare:_table=Layers_cargo_layer_rows_acceptance\n' +
			' |page=String\n' +
			' |revision=Integer\n' +
			' |layer_set=String\n' +
			' |kind=String\n' +
			' |layer=String\n' +
			' |type=String\n' +
			' |text=Text\n' +
			' |link_target=Text}}</noinclude><includeonly>{{#layers_cargo_store:_table=Layers_cargo_layer_rows_acceptance|_rows=layers}}</includeonly>';
		const layerRowsTemplateQuery = ( await api( {
			action: 'query',
			prop: 'revisions',
			titles: layerRowsTemplateTitle,
			rvprop: 'content',
			rvslots: 'main'
		} ) ).query.pages[ 0 ];
		if ( layerRowsTemplateQuery.missing ||
			layerRowsTemplateQuery.revisions?.[ 0 ]?.slots?.main?.content !== layerRowsTemplateWikitext ) {
			const editRes = await api( {
				action: 'edit',
				title: layerRowsTemplateTitle,
				text: layerRowsTemplateWikitext,
				summary: 'J109: declare per-layer Cargo table',
				token: csrfToken
			}, true );
			expect( editRes.edit?.result ).toBe( 'Success' );
		}

		await recreateCargoTable( templateTitle );
		await recreateCargoTable( layerRowsTemplateTitle );

		// Confirm table exists by querying cargo (should be empty for now)
		const initialCargoCheck = await queryCargo( `_pageID=${ pageId }` );
		expect( initialCargoCheck ).toEqual( [] );
		expect( await queryLayerRows( `_pageID=${ pageId }` ) ).toEqual( [] );
		// Seed a link-only layer with an exact-base page-owned publication. The
		// original snapshot is retained for exact CAS cleanup below.
		const seededSnapshot = JSON.parse( JSON.stringify( initialSnapshot ) );
		const linkLayer = {
			id: 'cargo-link-only',
			type: 'rectangle',
			x: 320,
			y: 100,
			width: 120,
			height: 48,
			stroke: '#000000',
			strokeWidth: 1,
			fill: 'transparent',
			link: 'Operations/Intake#Procedure'
		};
		seededSnapshot.surfaces[ 0 ].layers.push( linkLayer );
		seededSnapshot.surfaces[ 0 ].readingOrder.push( linkLayer.id );
		// Arm cleanup before the write: the server could commit even if delivery or
		// the following assertion fails.
		templateAddedToOwner = true;
		const seedRes = await api( {
			action: 'layerspublish',
			owner,
			pageid: String( pageId ),
			baserevid: String( initialRevId ),
			data: JSON.stringify( seededSnapshot ),
			summary: 'J109: seed a linked layer for Cargo acceptance',
			token: csrfToken
		}, true );
		expect( seedRes.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = seedRes.layerspublish.revid;
		templateAddedToOwner = true;

		// =========================================================================
		// Step 2: Add template to owner by an ordinary edit; verify Cargo row
		// =========================================================================
		ownerWithTemplateText = `{{Layers_cargo_acceptance}}\n{{Layers_cargo_layer_rows_acceptance}}\n${ initialMainText }`;
		const addTemplateRes = await api( {
			action: 'edit',
			title: owner,
			baserevid: String( lastOwnedRevision ),
			text: ownerWithTemplateText,
			summary: 'J75: add cargo template to owner',
			token: csrfToken
		}, true );
		expect( addTemplateRes.edit?.result ).toBe( 'Success' );
		templateAddedToOwner = true;
		const postTemplateRevId = addTemplateRes.edit.newrevid;
		lastOwnedRevision = postTemplateRevId;

		// Verify one unchanged row per layer set and one row per text/link layer.
		await expect.poll( async () => ( await queryCargo( `_pageID=${ pageId }` ) ).length ).toBe( 1 );
		const step2Rows = await queryCargo( `_pageID=${ pageId }` );
		expect( step2Rows ).toHaveLength( 1 );
		expect( step2Rows[ 0 ]._pageID ).toBe( String( pageId ) );
		expect( step2Rows[ 0 ].surface_id ).toBe( 'presentation' );
		expect( step2Rows[ 0 ].surface_label ).toBe( 'Welcome Slide' );
		expect( step2Rows[ 0 ].surface_kind ).toBe( 'slide' );
		expect( step2Rows[ 0 ].drawing_text ).toBe( 'Visual ideas — 世界' );
		const initialTextLayer = initialSnapshot.surfaces[ 0 ].layers.find( ( layer ) =>
			layer.text === 'Visual ideas — 世界' );
		expect( initialTextLayer ).toBeTruthy();
		const expectedLayerRow = {
			page: owner,
			revision: String( postTemplateRevId ),
			layer_set: 'Welcome Slide',
			kind: 'slide',
			layer: initialTextLayer.id,
			type: initialTextLayer.type,
			text: 'Visual ideas — 世界',
			link_target: ''
		};
		const expectedLinkRow = {
			page: owner,
			revision: String( postTemplateRevId ),
			layer_set: 'Welcome Slide',
			kind: 'slide',
			layer: linkLayer.id,
			type: linkLayer.type,
			text: '',
			link_target: linkLayer.link
		};
		const sortedRows = ( rows ) => rows.sort( ( a, b ) => a.layer.localeCompare( b.layer ) );
		await expect.poll( async () => sortedRows( await queryLayerRows( `_pageID=${ pageId }` ) ) )
			.toEqual( sortedRows( [ expectedLayerRow, expectedLinkRow ] ) );

		// =========================================================================
		// Step 3: Change one text layer through the page-owned editor (layer-only save)
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
		lastOwnedRevision = postEditTextRevId;
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Cargo row must update to new text and omit old text
		await expect.poll( async () => ( await queryCargo( `_pageID=${ pageId }` ) ).map( ( r ) => r.drawing_text ) )
			.toEqual( [ updatedText ] );
		const step3Rows = await queryCargo( `_pageID=${ pageId }` );
		expect( step3Rows ).toHaveLength( 1 );
		expect( step3Rows[ 0 ].drawing_text ).toBe( updatedText );
		expect( step3Rows[ 0 ].drawing_text ).not.toContain( 'Visual ideas — 世界' );
		await expect.poll( async () => sortedRows( await queryLayerRows( `_pageID=${ pageId }` ) ) )
			.toEqual( sortedRows( [ {
				...expectedLayerRow,
				revision: String( postEditTextRevId ),
				text: updatedText
			}, {
				...expectedLinkRow,
				revision: String( postEditTextRevId )
			} ] ) );

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
		lastOwnedRevision = postHideRevId;
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Cargo row text must disappear
		await expect.poll( async () => ( await queryCargo( `_pageID=${ pageId }` ) ).map( ( r ) => r.drawing_text ) )
			.toEqual( [ '' ] );
		const step4Rows = await queryCargo( `_pageID=${ pageId }` );
		expect( step4Rows ).toHaveLength( 1 );
		expect( step4Rows[ 0 ].drawing_text ).toBe( '' );
		await expect.poll( async () => queryLayerRows( `_pageID=${ pageId }` ) ).toEqual( [ {
			...expectedLinkRow,
			revision: String( postHideRevId )
		} ] );

		// =========================================================================
		// Step 5: Restore the previous layer-set version: Cargo rows must follow
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
		const restoredOwnerQuery = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids'
		} );
		const restoredRevisionId = restoredOwnerQuery.query.pages[ 0 ].revisions[ 0 ].revid;
		lastOwnedRevision = restoredRevisionId;
		await expect.poll( async () => sortedRows( await queryLayerRows( `_pageID=${ pageId }` ) ) )
			.toEqual( sortedRows( [ {
				...expectedLayerRow,
				revision: String( restoredRevisionId ),
				text: updatedText
			}, {
				...expectedLinkRow,
				revision: String( restoredRevisionId )
			} ] ) );

		// =========================================================================
		// Step 6: Put both templates on the isolation page (owns no layer sets): stores no rows
		// =========================================================================
		isolationWithTemplatesText = `${ initialIsoText }\n{{Layers_cargo_acceptance}}\n{{Layers_cargo_layer_rows_acceptance}}`;
		// Arm cleanup before the write so an uncertain response is never ignored.
		templateAddedToIsolation = true;
		const isoAddRes = await api( {
			action: 'edit',
			title: isolationPageTitle,
			baserevid: String( lastIsolationRevision ),
			text: isolationWithTemplatesText,
			summary: 'J75: add cargo template to isolation page',
			token: csrfToken
		}, true );
		expect( isoAddRes.edit?.result ).toBe( 'Success' );
		templateAddedToIsolation = true;
		lastIsolationRevision = isoAddRes.edit.newrevid;

		// The isolation page owns no layer sets, so Cargo must store no rows for it.
		await expect.poll( async () => ( await queryCargo( `_pageID=${ isolationPageId }` ) ).length ).toBe( 0 );
		const step6Rows = await queryCargo( `_pageID=${ isolationPageId }` );
		expect( step6Rows ).toEqual( [] );
		expect( await queryLayerRows( `_pageID=${ isolationPageId }` ) ).toEqual( [] );

		// =========================================================================
		// Step 7: Remove template from both pages: both pages' rows must be gone.
		//         Restore owner with exact-base CAS cleanup; leave template & table.
		// =========================================================================
		// 7a. Remove from isolation page
		const isoCleanRes = await api( {
			action: 'edit',
			title: isolationPageTitle,
			baserevid: String( lastIsolationRevision ),
			text: initialIsoText,
			summary: 'J75 cleanup: restore isolation page',
			token: csrfToken
		}, true );
		expect( isoCleanRes.edit?.result ).toBe( 'Success' );
		templateAddedToIsolation = false;
		lastIsolationRevision = isoCleanRes.edit.newrevid;

		await expect.poll( async () => ( await queryCargo( `_pageID=${ isolationPageId }` ) ).length ).toBe( 0 );
		expect( await queryCargo( `_pageID=${ isolationPageId }` ) ).toEqual( [] );
		expect( await queryLayerRows( `_pageID=${ isolationPageId }` ) ).toEqual( [] );

		// 7b. Restore owner via exact-base CAS publication with baseline snapshot and text
		const latestOwnerQuery = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids'
		} );
		const latestOwnerRevId = latestOwnerQuery.query.pages[ 0 ].revisions[ 0 ].revid;
		expect( latestOwnerRevId ).toBe( lastOwnedRevision );

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
		lastOwnedRevision = ownerCleanRes.layerspublish.revid;

		// Both Cargo tables must be empty and the owner must exactly match its baseline.
		await expect.poll( async () => ( await queryCargo( `_pageID=${ pageId }` ) ).length ).toBe( 0 );
		expect( await queryCargo( `_pageID=${ pageId }` ) ).toEqual( [] );
		expect( await queryLayerRows( `_pageID=${ pageId }` ) ).toEqual( [] );
		const finalOwnerQuery = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|content',
			rvslots: 'main'
		} );
		const finalOwnerRevision = finalOwnerQuery.query.pages[ 0 ].revisions[ 0 ];
		expect( finalOwnerRevision.revid ).toBe( lastOwnedRevision );
		expect( finalOwnerRevision.slots.main.content ).toBe( initialMainText );
		const finalOwnerLayers = await api( {
			action: 'layersread',
			owner,
			revid: String( finalOwnerRevision.revid )
		} );
		expect( finalOwnerLayers.layersread.snapshot ).toEqual( initialSnapshot );
		templateAddedToOwner = false;
	} finally {
		// Guaranteed cleanup if test aborted prematurely
		if ( templateAddedToIsolation ) {
			const isolationState = ( await api( {
				action: 'query',
				prop: 'revisions',
				titles: isolationPageTitle,
				rvprop: 'ids|content|user',
				rvslots: 'main'
			} ) ).query.pages[ 0 ];
			expect( Boolean( isolationState && isolationState.revisions ),
				'Isolation page became unavailable during Cargo acceptance cleanup' ).toBe( true );
			const currentIsolation = isolationState.revisions[ 0 ];
			const isolationIsUnchanged = Number( currentIsolation.revid ) === Number( initialIsoPage.revisions[ 0 ].revid ) &&
				currentIsolation.slots.main.content === initialIsoText;
			if ( !isolationIsUnchanged ) {
				expect( currentIsolation.user === config.username &&
					currentIsolation.slots.main.content === isolationWithTemplatesText,
				'Isolation page changed during Cargo acceptance; cleanup stopped to preserve intervening edits' )
					.toBe( true );
				const restoreIsolation = await api( {
					action: 'edit',
					title: isolationPageTitle,
					baserevid: String( currentIsolation.revid ),
					text: initialIsoText,
					summary: 'J75 cleanup: restore isolation page in finally',
					token: csrfToken
				}, true );
				expect( restoreIsolation.edit?.result, 'Cargo acceptance could not restore the isolation page' ).toBe( 'Success' );
			}
		}
		if ( templateAddedToOwner ) {
			const ownerState = ( await api( {
				action: 'query',
				prop: 'revisions',
				titles: owner,
				rvprop: 'ids|content|user',
				rvslots: 'main'
			} ) ).query.pages[ 0 ];
			expect( Boolean( ownerState && !ownerState.missing && ownerState.revisions ),
				'Owner page became unavailable during Cargo acceptance cleanup' ).toBe( true );
			const curRev = ownerState.revisions[ 0 ];
			const currentLayers = await api( {
				action: 'layersread',
				owner,
				revid: String( curRev.revid )
			} );
			const ownerIsUnchanged = Number( curRev.revid ) === Number( initialRevId ) &&
				curRev.slots.main.content === initialMainText &&
				JSON.stringify( currentLayers.layersread.snapshot ) === JSON.stringify( initialSnapshot );
			if ( !ownerIsUnchanged ) {
				expect( Number( curRev.revid ) === Number( lastOwnedRevision ) &&
					curRev.user === config.username &&
					( curRev.slots.main.content === initialMainText ||
						curRev.slots.main.content === ownerWithTemplateText ),
				'Owner page changed during Cargo acceptance; cleanup stopped to preserve intervening edits' )
					.toBe( true );
				const restoreOwner = await api( {
					action: 'layerspublish',
					owner,
					pageid: String( pageId ),
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J75 cleanup: restore automated owner state in finally',
					token: csrfToken
				}, true );
				expect( restoreOwner.layerspublish?.result, 'Cargo acceptance could not restore the original owner state' )
					.toBe( 'Success' );
			}
			const restoredOwnerState = ( await api( {
				action: 'query',
				prop: 'revisions',
				titles: owner,
				rvprop: 'ids|content',
				rvslots: 'main'
			} ) ).query.pages[ 0 ].revisions[ 0 ];
			expect( restoredOwnerState.slots.main.content ).toBe( initialMainText );
			const restoredSnapshot = await api( {
				action: 'layersread',
				owner,
				revid: String( restoredOwnerState.revid )
			} );
			expect( restoredSnapshot.layersread.snapshot ).toEqual( initialSnapshot );
		}
	}
} );
