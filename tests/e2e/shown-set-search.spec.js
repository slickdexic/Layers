/* eslint-env node */
/**
 * J80 Acceptance: Search finds a page by the shared drawing it shows
 * Proves in real Chromium on the test wiki (http://localhost:8080) that:
 * 1. Special:Search finds a page by words that exist only in a shared layer set or slide the page shows.
 * 2. Special:Search shows the drawing text as the snippet with the search word highlighted (.searchmatch).
 * 3. Saving a new revision of the shared set updates search results without editing the owner page.
 * 4. Deleting the slide (layersdelete) stops finding the owner for the slide word.
 * 5. Restoring the owner and deleting the shared set stops finding the owner for the revised set word.
 * 6. Exact-base CAS cleanup restores baseline wikitext and initial snapshot.
 * The file's File: page follows its set's text too. Special:Search looks only in the main
 * namespace by default, so every search here also asks for the File namespace (ns6).
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );
const { isWikiMigrated } = require( './helpers/migration' );

test.describe.configure( { mode: 'serial' } );

test( 'search finds a page by words in a shared layer set and slide it shows, and updates on set change or deletion', async ( { page, context } ) => {
	test.setTimeout( 240000 );
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires an explicitly provisioned, seeded pilot automation owner' );
	test.skip( await isWikiMigrated( { request: context.request } ), 'shared sets are read-only after the migration' );

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
	expect( pageId ).toBe( 228 );

	const initialRev = initialPageData.revisions[ 0 ];
	const initialRevId = initialRev.revid;
	const initialMainText = initialRev.slots.main.content;
	const diffMinutes = ( serverTime - new Date( initialRev.timestamp ).getTime() ) / 60000;
	const isPrecedingTestCleanup = initialRev.user === config.username &&
		initialMainText === 'Dedicated automated Layers history acceptance page.';
	if ( diffMinutes < 10 && !isPrecedingTestCleanup ) {
		throw new Error( `Owner ${ owner } was modified ${ diffMinutes.toFixed( 1 ) } minutes ago (within last 10 minutes); stopping per J65 wiki rules` );
	}

	// Record initial snapshot (must be restored in cleanup, never an empty one)
	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;

	// Discover first JPEG or PNG fixture
	const imageFiles = ( await api( {
		action: 'query',
		list: 'allimages',
		aimime: 'image/jpeg|image/png',
		ailimit: 1,
		aiprop: 'timestamp|sha1|size'
	} ) ).query.allimages;
	test.skip( !imageFiles.length, 'Requires at least one JPEG or PNG file on the wiki' );
	const imageFile = imageFiles[ 0 ];

	const setName = 'j80-search-probe';
	const filePage = 'File:' + imageFile.name;
	const slide = 'J80_Search_Probe';

	// Tracking state for safe exact-base CAS cleanup
	let lastOwnedRevision = null;
	let needsRestore = false;
	let fileSetCreated = false;
	let slideCreated = false;
	let slideSetName = null;

	// Generate three distinct random words: letters only, at least ten characters long
	const randomWord = ( prefix ) => {
		const chars = 'abcdefghijklmnopqrstuvwxyz';
		let res = prefix;
		while ( res.length < 14 ) {
			res += chars.charAt( Math.floor( Math.random() * chars.length ) );
		}
		return res;
	};

	const word1 = randomWord( 'probefile' );
	const word2 = randomWord( 'probeslide' );
	const word3 = randomWord( 'proberev' );

	// Helper: search Special:Search in Chromium and poll up to maxWaitMs until result matches or clears
	const searchUntil = async ( word, targetTitle, expectFound = true, maxWaitMs = 60000 ) => {
		const startTime = Date.now();
		const searchUrl = `${ base }/index.php?title=Special:Search&search=${ encodeURIComponent( word ) }&fulltext=1&ns0=1&ns6=1`;
		while ( Date.now() - startTime < maxWaitMs ) {
			await page.goto( searchUrl );
			// A missing target only counts on a page where the search ran
			await expect( page.locator( '.searchresults' ) ).toHaveCount( 1 );
			const results = page.locator( '.mw-search-result' );
			const count = await results.count();
			let foundTarget = null;
			for ( let i = 0; i < count; i++ ) {
				const item = results.nth( i );
				const heading = await item.locator( '.mw-search-result-heading a' ).textContent();
				const cleanHeading = heading ? heading.trim().replace( /_/g, ' ' ) : '';
				if ( cleanHeading === targetTitle.replace( /_/g, ' ' ) ) {
					foundTarget = item;
					break;
				}
			}
			if ( expectFound && foundTarget ) {
				const elapsedSeconds = Number( ( ( Date.now() - startTime ) / 1000 ).toFixed( 1 ) );
				const snippet = ( await foundTarget.locator( '.searchresult' ).allTextContents() ).join( ' ' );
				const highlighted = ( await foundTarget.locator( '.searchresult .searchmatch' ).allTextContents() ).join( ' ' );
				return { found: true, elapsedSeconds, snippet, highlighted, count, item: foundTarget };
			}
			if ( !expectFound && !foundTarget ) {
				const elapsedSeconds = Number( ( ( Date.now() - startTime ) / 1000 ).toFixed( 1 ) );
				return { found: false, elapsedSeconds, count };
			}
			await page.waitForTimeout( 1000 );
		}
		throw new Error( `Timed out waiting for search "${ word }" (expectFound=${ expectFound }, target="${ targetTitle }") after ${ maxWaitMs / 1000 }s` );
	};

	try {
		// =========================================================================
		// Step 1: Make three words (letters only, >=10 long, random).
		//         Check that Special:Search finds nothing for each.
		//         Record owner's current revision, main text and snapshot.
		// =========================================================================
		expect( word1.length ).toBeGreaterThanOrEqual( 10 );
		expect( word2.length ).toBeGreaterThanOrEqual( 10 );
		expect( word3.length ).toBeGreaterThanOrEqual( 10 );
		expect( /^[a-z]+$/.test( word1 ) ).toBe( true );
		expect( /^[a-z]+$/.test( word2 ) ).toBe( true );
		expect( /^[a-z]+$/.test( word3 ) ).toBe( true );

		for ( const w of [ word1, word2, word3 ] ) {
			await page.goto( `${ base }/index.php?title=Special:Search&search=${ encodeURIComponent( w ) }&fulltext=1&ns0=1&ns6=1` );
			await expect( page.locator( '.searchresults' ) ).toHaveCount( 1 );
			const resultCount = await page.locator( '.mw-search-result' ).count();
			expect( resultCount ).toBe( 0 );
		}

		// =========================================================================
		// Step 2: Save set j80-search-probe with text layer containing word 1,
		//         and slide J80_Search_Probe with text layer containing word 2.
		//         Publish owner main text plus embeds via exact-base publication.
		// =========================================================================
		needsRestore = true;

		// Save shared set j80-search-probe on first JPEG or PNG
		const savedFileSet = await api( {
			action: 'layerssave',
			filename: imageFile.name,
			setname: setName,
			data: JSON.stringify( [ {
				id: 'text_word1',
				type: 'text',
				x: 20,
				y: 20,
				fontSize: 20,
				fontFamily: 'Arial',
				color: '#000000',
				text: `Shared label with ${ word1 }`,
				visible: true
			} ] ),
			token: csrfToken
		}, true );
		expect( savedFileSet.layerssave?.success ).toBeTruthy();
		fileSetCreated = true;

		// Save slide J80_Search_Probe with word 2
		const savedSlide = await api( {
			action: 'layerssave',
			slidename: slide,
			data: JSON.stringify( {
				canvasWidth: 800,
				canvasHeight: 600,
				layers: [ {
					id: 'text_word2',
					type: 'text',
					x: 20,
					y: 20,
					fontSize: 20,
					fontFamily: 'Arial',
					color: '#000000',
					text: `Slide note with ${ word2 }`,
					visible: true
				} ]
			} ),
			token: csrfToken
		}, true );
		expect( savedSlide.layerssave?.success ).toBeTruthy();
		slideCreated = true;
		const slideSet = ( await api( { action: 'layersinfo', filename: 'Slide:' + slide } ) ).layersinfo.layerset;
		expect( slideSet ).toBeTruthy();
		slideSetName = slideSet.name;

		// Publish owner's main text plus embeds by exact-base publication, snapshot unchanged
		const seededMainText = `${ initialMainText }\n\n[[File:${ imageFile.name }|layerset=${ setName }|200px]]\n\n{{#Slide:${ slide }}}`;
		const pubSeed = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( initialSnapshot ),
			maintext: seededMainText,
			summary: 'J80: embed shared set and slide for search acceptance',
			token: csrfToken
		}, true );
		expect( pubSeed.layerspublish?.result ).toBe( 'Success' );
		const seedRevId = pubSeed.layerspublish.revid;
		expect( seedRevId ).toBeGreaterThan( initialRevId );
		lastOwnedRevision = seedRevId;

		// =========================================================================
		// Step 3: In Chromium, open Special:Search with fulltext=1 for words 1 & 2:
		//         Owner is a result, snippet contains word highlighted (.searchmatch).
		//         Record how long indexing took (up to 60s reload).
		//         Record whether file's File: page is also a result for word 1.
		// =========================================================================
		const search1 = await searchUntil( word1, owner, true, 60000 );
		expect( search1.found ).toBe( true );
		expect( search1.snippet ).toContain( word1 );
		expect( search1.highlighted ).toContain( word1 );

		// eslint-disable-next-line no-console
		console.log( `[J80] Word 1 ("${ word1 }") indexed on owner in ${ search1.elapsedSeconds }s` );

		// The file's own page is found by its set's text (it has no drawing snippet, a known limit)
		expect( ( await searchUntil( word1, filePage, true, 60000 ) ).found ).toBe( true );

		const search2 = await searchUntil( word2, owner, true, 60000 );
		expect( search2.found ).toBe( true );
		expect( search2.snippet ).toContain( word2 );
		expect( search2.highlighted ).toContain( word2 );
		// eslint-disable-next-line no-console
		console.log( `[J80] Word 2 ("${ word2 }") indexed on owner in ${ search2.elapsedSeconds }s` );

		// =========================================================================
		// Step 4: Save new revision of the set, replacing word 1 with word 3,
		//         without editing the owner. Word 3 finds owner; word 1 no longer does.
		// =========================================================================
		const saveSetRev2 = await api( {
			action: 'layerssave',
			filename: imageFile.name,
			setname: setName,
			data: JSON.stringify( [ {
				id: 'text_word1',
				type: 'text',
				x: 20,
				y: 20,
				fontSize: 20,
				fontFamily: 'Arial',
				color: '#000000',
				text: `Shared label with ${ word3 }`,
				visible: true
			} ] ),
			token: csrfToken
		}, true );
		expect( saveSetRev2.layerssave?.success ).toBeTruthy();

		// Check owner revision was not edited
		const ownerRevCheck = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		expect( ownerRevCheck.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( seedRevId );

		// Word 3 finds the owner
		const search3 = await searchUntil( word3, owner, true, 60000 );
		expect( search3.found ).toBe( true );
		expect( search3.snippet ).toContain( word3 );
		expect( search3.highlighted ).toContain( word3 );
		// eslint-disable-next-line no-console
		console.log( `[J80] Word 3 ("${ word3 }") found owner after set revision in ${ search3.elapsedSeconds }s` );

		// Word 1 no longer finds the owner or the file
		const search1No = await searchUntil( word1, owner, false, 60000 );
		expect( search1No.found ).toBe( false );
		expect( ( await searchUntil( word3, filePage, true, 60000 ) ).found ).toBe( true );
		expect( ( await searchUntil( word1, filePage, false, 60000 ) ).found ).toBe( false );
		// eslint-disable-next-line no-console
		console.log( `[J80] Word 1 ("${ word1 }") cleared from owner search in ${ search1No.elapsedSeconds }s` );

		// =========================================================================
		// Step 5: Delete the slide with layersdelete. Word 2 no longer finds owner.
		// =========================================================================
		const delSlide = await api( {
			action: 'layersdelete',
			slidename: slide,
			setname: slideSetName,
			token: csrfToken
		}, true );
		expect( delSlide.layersdelete?.success ).toBeTruthy();
		slideCreated = false;

		// Word 2 no longer finds the owner
		const search2No = await searchUntil( word2, owner, false, 60000 );
		expect( search2No.found ).toBe( false );
		// eslint-disable-next-line no-console
		console.log( `[J80] Word 2 ("${ word2 }") cleared from owner search after slide deletion in ${ search2No.elapsedSeconds }s` );

		// =========================================================================
		// Step 6: Restore owner to text and snapshot recorded in step 1 with
		//         exact-base cleanup, then delete the set. Word 3 no longer finds owner.
		// =========================================================================
		const restoreOwner = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J80: restore owner baseline text and snapshot',
			token: csrfToken
		}, true );
		expect( restoreOwner.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = restoreOwner.layerspublish.revid;
		needsRestore = false;

		const delSet = await api( {
			action: 'layersdelete',
			filename: imageFile.name,
			setname: setName,
			token: csrfToken
		}, true );
		expect( delSet.layersdelete?.success ).toBeTruthy();
		fileSetCreated = false;

		// Word 3 no longer finds the owner or the file
		const search3No = await searchUntil( word3, owner, false, 60000 );
		expect( search3No.found ).toBe( false );
		expect( ( await searchUntil( word3, filePage, false, 60000 ) ).found ).toBe( false );
		// eslint-disable-next-line no-console
		console.log( `[J80] Word 3 ("${ word3 }") cleared from owner search after cleanup in ${ search3No.elapsedSeconds }s` );

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
		// Cleanup safety net: whatever happened, restore recorded snapshot and delete set and slide
		if ( needsRestore && lastOwnedRevision ) {
			try {
				await api( {
					action: 'layerspublish',
					owner,
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J80 cleanup: restore automated owner state',
					token: csrfToken
				}, true );
			} catch ( cleanupErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error restoring owner in finally:', cleanupErr.message );
			}
		}

		if ( fileSetCreated ) {
			try {
				await api( {
					action: 'layersdelete',
					filename: imageFile.name,
					setname: setName,
					token: csrfToken
				}, true );
			} catch ( delSetErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error deleting set in finally:', delSetErr.message );
			}
		}

		if ( slideCreated && slideSetName ) {
			try {
				await api( {
					action: 'layersdelete',
					slidename: slide,
					setname: slideSetName,
					token: csrfToken
				}, true );
			} catch ( delSlideErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error deleting slide in finally:', delSlideErr.message );
			}
		}
	}
} );
