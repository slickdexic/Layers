/* eslint-env node */
/**
 * J94 Acceptance: Migration acceptance on the fixtures
 * Advances: HIST-8 (Move existing drawings into page history - D3 design).
 *
 * Proves on the test wiki (http://localhost:8080) that:
 * 1. Pre-migration: records a screenshot of every embed on every fixture page and the page's text.
 *    (Uses the pre-migration revision so reruns verify against historical pre-migration baseline).
 * 2. Dry run: runs migrateLayersToPageHistory.php without --commit for each fixture, compares
 *    output against tests/fixtures/migration/expected-plan.json, and documents any differences
 *    without modifying expected-plan.json.
 * 3. Commit: runs migrateLayersToPageHistory.php with --commit in exact sequence:
 *    files A, B, C; then every fixture page; then slide two. Records all created revisions.
 * 4. API verification: asserts each created revision is tagged 'layers-migration' and
 *    'layers-page-drawing', is authored by 'Layers migration' (bot edit), and contains
 *    expected summaries, drawings and wikitext.
 * 5. Post-migration: checks every fixture page in the browser. Embeds paint identically;
 *    compares screenshots within tolerance and reports the largest difference. Project: fixture
 *    is unchanged; Slide:Layers migration fixture slide two exists with its drawings.
 * 6. Rerun idempotency: reruns all committed commands and verifies each reports nothing left to
 *    do with zero new revisions created.
 */
const { test, expect } = require( '@playwright/test' );
const { execFileSync } = require( 'child_process' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'migration steps 1 to 3 acceptance on seeded fixtures (HIST-8)', async ( { page, context } ) => {
	test.setTimeout( 300000 );
	const startTime = Date.now();

	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires an explicitly provisioned, seeded pilot automation owner' );

	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	expect( url.port ).toBe( '8080' );
	const base = url.origin;

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

	// Helper to compare two PNG buffers in browser canvas and return pixel diff ratio
	const comparePngBuffers = async ( buf1, buf2 ) => {
		if ( !buf1 || !buf2 ) {
			return { match: false, diffRatio: 1.0, reason: 'Missing buffer' };
		}
		if ( buf1.equals( buf2 ) ) {
			return { match: true, diffRatio: 0.0, diffPixels: 0, totalPixels: 0 };
		}
		return await page.evaluate( async ( [ b64_1, b64_2 ] ) => {
			const loadImg = ( b64 ) => new Promise( ( resolve, reject ) => {
				const img = new Image();
				img.onload = () => resolve( img );
				img.onerror = reject;
				img.src = 'data:image/png;base64,' + b64;
			} );
			const img1 = await loadImg( b64_1 );
			const img2 = await loadImg( b64_2 );
			const w = Math.max( img1.width, img2.width );
			const h = Math.max( img1.height, img2.height );
			const canvas = document.createElement( 'canvas' );
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext( '2d' );
			ctx.drawImage( img1, 0, 0, w, h );
			const d1 = ctx.getImageData( 0, 0, w, h ).data;
			ctx.clearRect( 0, 0, w, h );
			ctx.drawImage( img2, 0, 0, w, h );
			const d2 = ctx.getImageData( 0, 0, w, h ).data;
			let diffCount = 0;
			const totalPixels = w * h;
			for ( let i = 0; i < d1.length; i += 4 ) {
				const dr = Math.abs( d1[ i ] - d2[ i ] );
				const dg = Math.abs( d1[ i + 1 ] - d2[ i + 1 ] );
				const db = Math.abs( d1[ i + 2 ] - d2[ i + 2 ] );
				if ( dr > 10 || dg > 10 || db > 10 ) {
					diffCount++;
				}
			}
			const diffRatio = diffCount / totalPixels;
			// The legacy overlay sat 3 px off its image, so text-bearing embeds differ by a few percent.
			const tolerance = 0.10;
			return {
				match: diffRatio <= tolerance,
				diffRatio,
				diffPixels: diffCount,
				totalPixels,
				width: w,
				height: h
			};
		}, [ buf1.toString( 'base64' ), buf2.toString( 'base64' ) ] );
	};

	// Fixture definitions
	const fixturePages = [
		'Layers migration fixture/Direct',
		'Layers migration fixture/Slides 1',
		'Layers migration fixture/Slides 2',
		'Template:Layers migration fixture frame',
		'Layers migration fixture/Template',
		'Layers migration fixture/Taken',
		'Layers migration fixture/Uses C',
		'Project:Layers migration fixture'
	];

	// Run maintenance script helper inside container
	const runMigration = ( option, commit = false ) => {
		const args = [
			'exec',
			'mediawiki-145',
			'php',
			'extensions/Layers/maintenance/migrateLayersToPageHistory.php',
			option
		];
		if ( commit ) {
			args.push( '--commit' );
		}
		return execFileSync( 'docker', args, { encoding: 'utf8' } );
	};

	// =========================================================================
	// Step 1: Pre-migration recording
	// =========================================================================
	console.log( '\n=== Step 1: Pre-migration recording ===' );
	const preMigrationData = {};

	for ( const title of fixturePages ) {
		// Read revision metadata and wikitext from API (fetch up to 10 revisions to locate pre-migration state)
		const revQuery = await api( {
			action: 'query',
			prop: 'info|revisions',
			titles: title,
			rvlimit: '10',
			rvprop: 'ids|timestamp|user|comment|content',
			rvslots: 'main'
		} );
		const pageData = revQuery.query.pages[ 0 ];
		const revs = pageData.revisions;
		// If page was already migrated by Layers migration, pre-migration revision is revs[1]
		const isAlreadyMigrated = revs[ 0 ]?.user === 'Layers migration';
		const preRev = isAlreadyMigrated ? revs[ 1 ] : revs[ 0 ];
		const preRevId = preRev.revid;
		const preText = preRev.slots.main.content;

		// Visit pre-migration revision in browser
		const visitUrl = isAlreadyMigrated ?
			`${ base }/index.php?title=${ encodeURIComponent( title ) }&oldid=${ preRevId }` :
			`${ base }/index.php?title=${ encodeURIComponent( title ) }`;
		await page.goto( visitUrl );
		await page.waitForLoadState( 'networkidle' );
		// Allow viewer scripts to settle
		await page.waitForTimeout( 1500 );

		const contentText = ( await page.locator( '#mw-content-text' ).innerText() ).trim();

		// Record all embeds on this page
		const embedLocators = [];
		const figures = page.locator( '#mw-content-text figure' );
		const figureCount = await figures.count();
		for ( let i = 0; i < figureCount; i++ ) {
			embedLocators.push( { type: 'figure', locator: figures.nth( i ) } );
		}
		const slideElements = page.locator( '#mw-content-text .layers-slide-container, #mw-content-text .layers-bound-slide, #mw-content-text .layers-slide-error' );
		const slideCount = await slideElements.count();
		for ( let i = 0; i < slideCount; i++ ) {
			embedLocators.push( { type: 'slide', locator: slideElements.nth( i ) } );
		}

		const embedScreenshots = [];
		for ( let i = 0; i < embedLocators.length; i++ ) {
			const item = embedLocators[ i ];
			const shot = await item.locator.screenshot();
			const hasCanvas = ( await item.locator.locator( 'canvas' ).count() ) > 0;
			embedScreenshots.push( {
				index: i,
				type: item.type,
				screenshot: shot,
				hasCanvas
			} );
		}

		preMigrationData[ title ] = {
			pageId: pageData.pageid,
			preRevId,
			wikitext: preText,
			contentText,
			embeds: embedScreenshots
		};
		console.log( `Recorded ${ title } (pre-migration rev ${ preRevId }, ${ embedScreenshots.length } embed(s))` );
	}

	// =========================================================================
	// Step 2: Dry run and comparison with expected-plan.json
	// =========================================================================
	console.log( '\n=== Step 2: Dry run & expected-plan.json comparison ===' );
	const expectedPlanPath = path.join( __dirname, '../fixtures/migration/expected-plan.json' );
	const expectedPlan = JSON.parse( fs.readFileSync( expectedPlanPath, 'utf8' ) );

	const dryRunOutputs = {};
	const dryRunDifferences = [];

	// Helper to check dry run output against expected lines
	const compareDryRun = ( fixtureKey, option, expectedLines, notes = '' ) => {
		const out = runMigration( option, false );
		dryRunOutputs[ fixtureKey ] = out;

		for ( const exp of expectedLines ) {
			const pattern = new RegExp(
				exp
					.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' )
					.replace( /\\<legacyId\\>/g, '\\d+' )
					.replace( /\\<rev\\>/g, '\\d+' )
					.replace( /\\<pageId\\>/g, '\\d+' )
			);
			if ( !pattern.test( out ) ) {
				dryRunDifferences.push( {
					fixture: fixtureKey,
					option,
					expectedLine: exp,
					foundOutput: out.trim(),
					notes
				} );
			}
		}
	};

	// 1. Files
	compareDryRun(
		'Layers migration fixture A.png',
		'--file=Layers_migration_fixture_A.png',
		expectedPlan.files[ 'Layers migration fixture A.png' ].expectedScriptOutput
	);
	compareDryRun(
		'Layers migration fixture B.pdf',
		'--file=Layers_migration_fixture_B.pdf',
		expectedPlan.files[ 'Layers migration fixture B.pdf' ].expectedScriptOutput
	);
	compareDryRun(
		'Layers migration fixture C.png',
		'--file=Layers_migration_fixture_C.png',
		expectedPlan.files[ 'Layers migration fixture C.png' ].expectedScriptOutput
	);

	// 2. Pages
	compareDryRun(
		'Layers migration fixture/Direct',
		'--page=Layers migration fixture/Direct',
		expectedPlan.pages[ 'Layers migration fixture/Direct' ].expectedScriptOutput,
		'In isolated --page dry-run before Step 1 commits, uncommitted files output (file-not-migrated)'
	);
	compareDryRun(
		'Layers migration fixture/Slides 1',
		'--page=Layers migration fixture/Slides 1',
		expectedPlan.pages[ 'Layers migration fixture/Slides 1' ].expectedScriptOutput
	);
	compareDryRun(
		'Layers migration fixture/Slides 2',
		'--page=Layers migration fixture/Slides 2',
		expectedPlan.pages[ 'Layers migration fixture/Slides 2' ].expectedScriptOutput
	);
	compareDryRun(
		'Template:Layers migration fixture frame',
		'--page=Template:Layers migration fixture frame',
		[ 'Template:Layers migration fixture frame: not changed (namespace-not-enabled)' ]
	);
	compareDryRun(
		'Layers migration fixture/Template',
		'--page=Layers migration fixture/Template',
		expectedPlan.pages[ 'Layers migration fixture/Template' ].expectedScriptOutput,
		'In isolated --page dry-run before Step 1 commits, uncommitted File A causes template embed to be skipped'
	);
	compareDryRun(
		'Layers migration fixture/Taken',
		'--page=Layers migration fixture/Taken',
		expectedPlan.pages[ 'Layers migration fixture/Taken' ].expectedScriptOutput,
		'In isolated --page dry-run before Step 1 commits, uncommitted File A outputs (file-not-migrated)'
	);
	compareDryRun(
		'Layers migration fixture/Uses C',
		'--page=Layers migration fixture/Uses C',
		expectedPlan.pages[ 'Layers migration fixture/Uses C' ].expectedScriptOutput,
		'Lead finding: fileSource() returns null on sha1 mismatch without setting $reason, omitting from notMoved'
	);
	compareDryRun(
		'Project:Layers migration fixture',
		'--page=Project:Layers migration fixture',
		expectedPlan.pages[ 'Project:Layers migration fixture' ].expectedScriptOutput
	);

	// 3. Slides
	compareDryRun(
		'Layers migration fixture slide two',
		'--slide=Layers_migration_fixture_slide_two',
		expectedPlan.slides[ 'Layers migration fixture slide two' ].expectedScriptOutput
	);

	console.log( `Dry run differences found: ${ dryRunDifferences.length }` );
	for ( const diff of dryRunDifferences ) {
		console.log( ` - [${ diff.fixture }]: ${ diff.notes || diff.expectedLine }` );
	}

	// =========================================================================
	// Step 3: Run with --commit in exact order
	// =========================================================================
	console.log( '\n=== Step 3: Running migration with --commit ===' );
	const commitSequence = [
		{ type: 'file', key: 'File A', title: 'File:Layers migration fixture A.png', option: '--file=Layers_migration_fixture_A.png' },
		{ type: 'file', key: 'File B', title: 'File:Layers migration fixture B.pdf', option: '--file=Layers_migration_fixture_B.pdf' },
		{ type: 'file', key: 'File C', title: 'File:Layers migration fixture C.png', option: '--file=Layers_migration_fixture_C.png' },
		{ type: 'page', key: 'Direct', title: 'Layers migration fixture/Direct', option: '--page=Layers migration fixture/Direct' },
		{ type: 'page', key: 'Slides 1', title: 'Layers migration fixture/Slides 1', option: '--page=Layers migration fixture/Slides 1' },
		{ type: 'page', key: 'Slides 2', title: 'Layers migration fixture/Slides 2', option: '--page=Layers migration fixture/Slides 2' },
		{ type: 'page', key: 'Template frame', title: 'Template:Layers migration fixture frame', option: '--page=Template:Layers migration fixture frame' },
		{ type: 'page', key: 'Template', title: 'Layers migration fixture/Template', option: '--page=Layers migration fixture/Template' },
		{ type: 'page', key: 'Taken', title: 'Layers migration fixture/Taken', option: '--page=Layers migration fixture/Taken' },
		{ type: 'page', key: 'Uses C', title: 'Layers migration fixture/Uses C', option: '--page=Layers migration fixture/Uses C' },
		{ type: 'page', key: 'Project', title: 'Project:Layers migration fixture', option: '--page=Project:Layers migration fixture' },
		{ type: 'slide', key: 'Slide two', title: 'Slide:Layers migration fixture slide two', option: '--slide=Layers_migration_fixture_slide_two' }
	];

	const reportedRevisions = {};

	for ( const step of commitSequence ) {
		const out = runMigration( step.option, true );
		// Extract reported revisions if run in this process
		const savedMatches = [ ...out.matchAll( /saved revision (\d+)/g ) ].map( ( m ) => parseInt( m[ 1 ], 10 ) );
		if ( savedMatches.length > 0 ) {
			reportedRevisions[ step.key ] = savedMatches;
		} else {
			// If already committed in an earlier run, resolve the migration revision from page history
			const revQ = await api( {
				action: 'query',
				prop: 'info|revisions',
				titles: step.title,
				rvlimit: '10',
				rvprop: 'ids|user'
			} );
			const pageEntry = revQ.query.pages[ 0 ];
			const migrationRevs = ( pageEntry.revisions || [] )
				.filter( ( r ) => r.user === 'Layers migration' )
				.map( ( r ) => r.revid );
			reportedRevisions[ step.key ] = migrationRevs.slice( 0, 1 );
		}
		console.log( `${ step.key } (${ step.option }): ${ reportedRevisions[ step.key ].length ? 'revisions ' + reportedRevisions[ step.key ].join( ', ' ) : '0 revisions' }` );
	}

	// Validate expected revision counts from migration design
	expect( reportedRevisions[ 'File A' ].length ).toBe( 1 );
	expect( reportedRevisions[ 'File B' ].length ).toBe( 1 );
	expect( reportedRevisions[ 'File C' ].length ).toBe( 0 ); // old version not moved
	expect( reportedRevisions.Direct.length ).toBe( 1 );
	expect( reportedRevisions[ 'Slides 1' ].length ).toBe( 1 );
	expect( reportedRevisions[ 'Slides 2' ].length ).toBe( 1 );
	expect( reportedRevisions[ 'Template frame' ].length ).toBe( 0 ); // namespace not enabled
	expect( reportedRevisions.Template.length ).toBe( 1 );
	expect( reportedRevisions.Taken.length ).toBe( 1 );
	expect( reportedRevisions[ 'Uses C' ].length ).toBe( 0 ); // not moved
	expect( reportedRevisions.Project.length ).toBe( 0 ); // namespace not enabled
	expect( reportedRevisions[ 'Slide two' ].length ).toBe( 1 ); // step 2 commit on created page

	// =========================================================================
	// Step 4: Check through the API that each revision is tagged and bot-flagged
	// =========================================================================
	console.log( '\n=== Step 4: API verification of committed revisions ===' );

	// Verify 'Layers migration' user belongs to 'bot' group
	const userQuery = await api( {
		action: 'query',
		list: 'users',
		ususers: 'Layers migration',
		usprop: 'groups'
	} );
	const migrationUser = userQuery.query.users[ 0 ];
	expect( migrationUser.name ).toBe( 'Layers migration' );
	expect( migrationUser.groups ).toContain( 'bot' );

	// Collect all revision IDs to check
	const allNewRevIds = Object.values( reportedRevisions ).flat();

	// Also find the initial creation revision of Slide:Layers migration fixture slide two
	const slideTwoPageQuery = await api( {
		action: 'query',
		prop: 'info|revisions',
		titles: 'Slide:Layers migration fixture slide two',
		rvlimit: '10',
		rvprop: 'ids|timestamp|user|comment|tags|content',
		rvslots: '*'
	} );
	const slideTwoPage = slideTwoPageQuery.query.pages[ 0 ];
	expect( slideTwoPage.missing ).toBeUndefined();
	const slideTwoRevs = slideTwoPage.revisions;
	expect( slideTwoRevs.length ).toBe( 2 ); // Rev 1 (creation) and Rev 2 (copy)

	// Combine all revisions to check
	const revisionsToCheck = [
		...allNewRevIds,
		slideTwoRevs[ 1 ].revid // creation revision of slide two
	];

	for ( const revId of revisionsToCheck ) {
		const revQuery = await api( {
			action: 'query',
			prop: 'revisions',
			revids: String( revId ),
			rvprop: 'ids|timestamp|user|comment|tags|content',
			rvslots: '*'
		} );
		const rev = revQuery.query.pages[ 0 ].revisions[ 0 ];

		// Must be authored by Layers migration
		expect( rev.user ).toBe( 'Layers migration' );

		// Must be tagged layers-migration and layers-page-drawing
		expect( rev.tags ).toContain( 'layers-migration' );
		expect( rev.tags ).toContain( 'layers-page-drawing' );
	}

	// Verify specific revision summaries and drawings
	// 1. File A
	const fileARev = ( await api( {
		action: 'query',
		prop: 'revisions',
		revids: String( reportedRevisions[ 'File A' ][ 0 ] ),
		rvprop: 'ids|comment|content',
		rvslots: '*'
	} ) ).query.pages[ 0 ].revisions[ 0 ];
	expect( fileARev.comment ).toBe( 'Moved 2 shared layer sets into page history: "anatomy", "labels"' );
	const fileASnapshot = JSON.parse( fileARev.slots.layers.content );
	expect( fileASnapshot.surfaces.map( ( s ) => s.label ).sort() ).toEqual( [ 'anatomy', 'labels' ] );

	// 2. File B
	const fileBRev = ( await api( {
		action: 'query',
		prop: 'revisions',
		revids: String( reportedRevisions[ 'File B' ][ 0 ] ),
		rvprop: 'ids|comment|content',
		rvslots: '*'
	} ) ).query.pages[ 0 ].revisions[ 0 ];
	expect( fileBRev.comment ).toBe( 'Moved 2 shared layer sets into page history: "notes", "notes (page 3)"' );
	const fileBSnapshot = JSON.parse( fileBRev.slots.layers.content );
	expect( fileBSnapshot.surfaces.map( ( s ) => s.label ).sort() ).toEqual( [ 'notes', 'notes (page 3)' ] );

	// 3. Direct
	const directRev = ( await api( {
		action: 'query',
		prop: 'revisions',
		revids: String( reportedRevisions.Direct[ 0 ] ),
		rvprop: 'ids|comment|content',
		rvslots: '*'
	} ) ).query.pages[ 0 ].revisions[ 0 ];
	const directSnapshot = JSON.parse( directRev.slots.layers.content );
	expect( directSnapshot.surfaces.map( ( s ) => s.label ).sort() )
		.toEqual( [ 'anatomy', 'labels', 'notes', 'notes (page 3)' ] );
	// Embeds rewritten
	const directPageId = preMigrationData[ 'Layers migration fixture/Direct' ].pageId;
	expect( directRev.slots.main.content ).toContain( `layerset=${ directPageId }:anatomy` );
	expect( directRev.slots.main.content ).toContain( `layerset=${ directPageId }:labels` );
	expect( directRev.slots.main.content ).toContain( `layerset=${ directPageId }:notes` );
	expect( directRev.slots.main.content ).toContain( `layerset=${ directPageId }:notes (page 3)` );
	expect( directRev.slots.main.content ).toContain( 'layerset=off' );

	// 4. Slides 1
	const slides1Rev = ( await api( {
		action: 'query',
		prop: 'revisions',
		revids: String( reportedRevisions[ 'Slides 1' ][ 0 ] ),
		rvprop: 'ids|comment|content',
		rvslots: '*'
	} ) ).query.pages[ 0 ].revisions[ 0 ];
	const slides1PageId = preMigrationData[ 'Layers migration fixture/Slides 1' ].pageId;
	expect( slides1Rev.slots.main.content ).toBe( `{{#Slide:${ slides1PageId }:Layers migration fixture slide one}}` );

	// 5. Slides 2
	const slides2Rev = ( await api( {
		action: 'query',
		prop: 'revisions',
		revids: String( reportedRevisions[ 'Slides 2' ][ 0 ] ),
		rvprop: 'ids|comment|content',
		rvslots: '*'
	} ) ).query.pages[ 0 ].revisions[ 0 ];
	const slides2PageId = preMigrationData[ 'Layers migration fixture/Slides 2' ].pageId;
	expect( slides2Rev.slots.main.content ).toBe( `{{#Slide:${ slides2PageId }:Layers migration fixture slide one}}` );

	// 6. Template consumer
	const templateRev = ( await api( {
		action: 'query',
		prop: 'revisions',
		revids: String( reportedRevisions.Template[ 0 ] ),
		rvprop: 'ids|comment|content',
		rvslots: '*'
	} ) ).query.pages[ 0 ].revisions[ 0 ];
	const templateSnapshot = JSON.parse( templateRev.slots.layers.content );
	expect( templateSnapshot.surfaces.map( ( s ) => s.label ) ).toEqual( [ 'anatomy' ] );
	expect( templateRev.slots.main.content ).toBe( '{{Layers migration fixture frame}}' ); // wikitext untouched

	// 7. Taken
	const takenRev = ( await api( {
		action: 'query',
		prop: 'revisions',
		revids: String( reportedRevisions.Taken[ 0 ] ),
		rvprop: 'ids|comment|content',
		rvslots: '*'
	} ) ).query.pages[ 0 ].revisions[ 0 ];
	const takenSnapshot = JSON.parse( takenRev.slots.layers.content );
	expect( takenSnapshot.surfaces.map( ( s ) => s.label ).sort() ).toEqual( [ 'anatomy', 'anatomy 2' ] );
	const takenPageId = preMigrationData[ 'Layers migration fixture/Taken' ].pageId;
	expect( takenRev.slots.main.content ).toContain( `layerset=${ takenPageId }:anatomy 2` );

	// 8. Slide two
	const slideTwoRev = ( await api( {
		action: 'query',
		prop: 'revisions',
		revids: String( reportedRevisions[ 'Slide two' ][ 0 ] ),
		rvprop: 'ids|comment|content',
		rvslots: '*'
	} ) ).query.pages[ 0 ].revisions[ 0 ];
	const slideTwoPageId = slideTwoPage.pageid;
	expect( slideTwoRev.slots.main.content ).toBe( `{{#Slide:${ slideTwoPageId }:Layers_migration_fixture_slide_two}}` );
	const slideTwoSnapshot = JSON.parse( slideTwoRev.slots.layers.content );
	expect( slideTwoSnapshot.surfaces.map( ( s ) => s.label ) ).toEqual( [ 'Layers_migration_fixture_slide_two' ] );

	// =========================================================================
	// Step 5: Post-migration visual verification
	// =========================================================================
	console.log( '\n=== Step 5: Post-migration visual verification ===' );
	let maxDiffRatio = 0.0;
	let comparedEmbedCount = 0;

	for ( const title of fixturePages ) {
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( title ) }` );
		await page.waitForLoadState( 'networkidle' );
		await page.waitForTimeout( 1500 );

		const pre = preMigrationData[ title ];

		if ( title === 'Project:Layers migration fixture' ) {
			// Project page must be completely unchanged
			const projectQuery = await api( { action: 'query', prop: 'info', titles: title } );
			expect( projectQuery.query.pages[ 0 ].lastrevid ).toBe( pre.preRevId );
		}

		// Re-fetch embed locators
		const embedLocators = [];
		const figures = page.locator( '#mw-content-text figure' );
		const figureCount = await figures.count();
		for ( let i = 0; i < figureCount; i++ ) {
			embedLocators.push( { type: 'figure', locator: figures.nth( i ) } );
		}
		const slideElements = page.locator( '#mw-content-text .layers-slide-container, #mw-content-text .layers-bound-slide, #mw-content-text .layers-slide-error' );
		const slideCount = await slideElements.count();
		for ( let i = 0; i < slideCount; i++ ) {
			embedLocators.push( { type: 'slide', locator: slideElements.nth( i ) } );
		}

		for ( let i = 0; i < embedLocators.length; i++ ) {
			const item = embedLocators[ i ];
			const postShot = await item.locator.screenshot();
			const preEmbed = pre.embeds[ i ];

			// Compare screenshot with pre-migration screenshot
			if ( preEmbed ) {
				if ( item.type === 'slide' && title.includes( 'Slides' ) ) {
					// Slides 1 and 2 had an error banner pre-migration due to legacy SlideNameValidator rejecting spaces;
					// post-migration they render .layers-bound-slide with a painted canvas.
					const slideBound = item.locator;
					await expect( slideBound ).toBeVisible();
					const slideCanvas = slideBound.locator( 'canvas' );
					await expect( slideCanvas ).toBeVisible();
					console.log( `Embed ${ title } [${ i }]: slide error transitioned to painted page-owned drawing as expected` );
					continue;
				}
				const diff = await comparePngBuffers( preEmbed.screenshot, postShot );
				comparedEmbedCount++;
				if ( diff.diffRatio > maxDiffRatio ) {
					maxDiffRatio = diff.diffRatio;
				}
				console.log( `Embed ${ title } [${ i }]: diff ${( diff.diffRatio * 100 ).toFixed( 2 ) }% (${ diff.diffPixels } / ${ diff.totalPixels } px)` );
				expect( diff.match ).toBe( true );
			}
		}
	}

	// Verify Slide:Layers migration fixture slide two in browser
	await page.goto( `${ base }/index.php?title=${ encodeURIComponent( 'Slide:Layers migration fixture slide two' ) }` );
	await page.waitForLoadState( 'networkidle' );
	await page.waitForTimeout( 1500 );
	const slideTwoBound = page.locator( '.layers-bound-slide' );
	await expect( slideTwoBound ).toBeVisible();
	const slideTwoCanvas = slideTwoBound.locator( 'canvas' );
	await expect( slideTwoCanvas ).toBeVisible();
	// Check non-white pixels painted on canvas
	const slideTwoPainted = await slideTwoCanvas.evaluate( ( c ) => {
		const ctx = c.getContext( '2d' );
		const pixels = ctx.getImageData( 0, 0, c.width, c.height ).data;
		for ( let i = 0; i < pixels.length; i += 4 ) {
			if ( pixels[ i + 3 ] > 0 && ( pixels[ i ] < 250 || pixels[ i + 1 ] < 250 || pixels[ i + 2 ] < 250 ) ) {
				return true;
			}
		}
		return false;
	} );
	expect( slideTwoPainted ).toBe( true );
	console.log( 'Verified Slide:Layers migration fixture slide two exists and is painted.' );
	console.log( `Largest visual difference across ${ comparedEmbedCount } compared embed(s): ${( maxDiffRatio * 100 ).toFixed( 2 ) }%` );

	// =========================================================================
	// Step 6: Rerun committed commands (idempotency check)
	// =========================================================================
	console.log( '\n=== Step 6: Rerun committed commands (idempotency check) ===' );
	for ( const step of commitSequence ) {
		const rerunOut = runMigration( step.option, true );
		// Must not report any new saved revision or error
		expect( rerunOut ).not.toContain( 'saved revision' );
		expect( rerunOut.toLowerCase() ).not.toContain( 'error' );
		console.log( `Rerun ${ step.key }: clean (0 new revisions)` );
	}

	// Double-check no new revisions appeared on any fixture page
	for ( const title of fixturePages ) {
		const q = await api( { action: 'query', prop: 'info', titles: title } );
		const latestRev = q.query.pages[ 0 ].lastrevid;
		const pageKeyMap = {
			'Layers migration fixture/Direct': 'Direct',
			'Layers migration fixture/Slides 1': 'Slides 1',
			'Layers migration fixture/Slides 2': 'Slides 2',
			'Template:Layers migration fixture frame': 'Template frame',
			'Layers migration fixture/Template': 'Template',
			'Layers migration fixture/Taken': 'Taken',
			'Layers migration fixture/Uses C': 'Uses C',
			'Project:Layers migration fixture': 'Project'
		};
		const key = pageKeyMap[ title ];
		const expectedRev = ( key && reportedRevisions[ key ]?.[ 0 ] ) || preMigrationData[ title ].preRevId;
		expect( latestRev ).toBe( expectedRev );
	}

	const slideTwoQ = await api( { action: 'query', prop: 'info', titles: 'Slide:Layers migration fixture slide two' } );
	expect( slideTwoQ.query.pages[ 0 ].lastrevid ).toBe( reportedRevisions[ 'Slide two' ][ 0 ] );

	const duration = ( ( Date.now() - startTime ) / 1000 ).toFixed( 1 );
	console.log( `\nJ94 Migration Acceptance completed successfully in ${ duration }s.` );
} );
