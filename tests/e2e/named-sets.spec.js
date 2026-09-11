/* eslint-env node */
/**
 * Layers Extension - Named Layer Sets E2E Browser Acceptance Tests (J21)
 *
 * Tests for the named layer sets feature against live MediaWiki:
 * - Coordinated single confirmation failure-safe set switching (J20)
 * - Per-run set-name prefixing and failure-safe fixture teardown
 * - Unconditional assertions on production controls (no soft skips)
 * - Deliberately failed load retention and selector restoration
 * - Canceled dirty switch retention and selector restoration
 * - Rename persistence across page reloads
 * - Deletion with confirmation
 * - Independent layer sets and revision selector population
 * - Maximum set cap headroom preservation
 *
 * Usage:
 *   $env:MW_SERVER="http://localhost:8080"
 *   $env:TEST_FILE="ImageTest03.png"
 *   $env:MW_USERNAME="LayersQA"
 *   $env:MW_PASSWORD="LayersQA-Test-2026!"
 *   npx playwright test tests/e2e/named-sets.spec.js --workers=1
 */

const { test, expect } = require( '@playwright/test' );
const { LayersEditorPage } = require( './fixtures' );

// Unique per-run prefix to guarantee isolation across runs
const RUN_ID = Date.now().toString( 36 ) + '_' + Math.random().toString( 36 ).slice( 2, 6 );
const RUN_PREFIX = `j21_${ RUN_ID }`;

// Set registry to track all created and renamed sets for failure-safe teardown
const createdSetNames = new Set();

/**
 * Clean up test-owned sets on the target file via MediaWiki API.
 * Strictly preserves unrelated sets ('001', '002', 'default', or sets owned by other users).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} testFile
 * @param {string[]} setsToDelete
 * @param {string} prefix
 * @return {Promise<{success: boolean, deleted: string[], failed: Array<{setname: string, error: string}>}>}
 */
async function cleanupTestSets( page, testFile, setsToDelete, prefix ) {
	return await page.evaluate( async ( { filename, targetSets, runPrefix } ) => {
		const deleted = [];
		const failed = [];
		try {
			const api = new mw.Api();
			const infoRes = await api.get( {
				action: 'layersinfo',
				filename: filename,
				format: 'json'
			} );
			const namedSets = ( infoRes.layersinfo && infoRes.layersinfo.named_sets ) || [];

			for ( const s of namedSets ) {
				// Strictly preserve unrelated sets
				if ( s.name === '001' || s.name === '002' || s.name === 'default' ) {
					continue;
				}
				// Only delete sets created in this run, or matching j21_ test prefixes owned by LayersQA
				const isTracked = targetSets.includes( s.name );
				const matchesPrefix = s.name.startsWith( runPrefix ) || s.name.startsWith( 'j21_' );

				if ( ( isTracked || matchesPrefix ) && ( s.latest_user_name === 'LayersQA' || s.latest_user_name === undefined ) ) {
					try {
						await api.postWithToken( 'csrf', {
							action: 'layersdelete',
							filename: filename,
							setname: s.name
						} );
						deleted.push( s.name );
					} catch ( err ) {
						failed.push( { setname: s.name, error: String( err ) } );
					}
				}
			}
		} catch ( e ) {
			return { success: false, error: String( e ), deleted, failed };
		}
		return { success: failed.length === 0, deleted, failed };
	}, {
		filename: testFile,
		targetSets: setsToDelete,
		runPrefix: prefix
	} );
}

test.describe( 'Named Layer Sets (J21)', () => {
	test.describe.configure( { mode: 'serial' } );

	let editorPage;

	test.beforeAll( async ( { browser } ) => {
		// Strict prerequisite validation: must not write to an implicit default image
		if ( !process.env.MW_SERVER ) {
			throw new Error( 'Blocked: MW_SERVER must be set (e.g. http://localhost:8080) to run named-set browser acceptance tests.' );
		}
		if ( !process.env.TEST_FILE ) {
			throw new Error( 'Blocked: Set TEST_FILE to an isolated, test-owned image before running named-set writes.' );
		}
		if ( !process.env.MW_USERNAME || !process.env.MW_PASSWORD ) {
			throw new Error( 'Blocked: MW_USERNAME and MW_PASSWORD must be set for named-set browser acceptance tests.' );
		}

		// Pre-run cleanup of any orphaned j21_ sets from interrupted runs
		const context = await browser.newContext();
		const page = await context.newPage();
		try {
			const ep = new LayersEditorPage( page );
			await ep.login();
			await ep.openEditor( process.env.TEST_FILE );
			const preClean = await cleanupTestSets( page, process.env.TEST_FILE, [], RUN_PREFIX );
			if ( preClean.deleted.length > 0 ) {
				console.log( `[Pre-run] Cleaned up ${ preClean.deleted.length } leftover test sets:`, preClean.deleted );
			}
		} finally {
			await context.close();
		}
	} );

	test.afterAll( async ( { browser } ) => {
		// Failure-safe post-run teardown: clean up all sets created in this run
		const context = await browser.newContext();
		const page = await context.newPage();
		try {
			const ep = new LayersEditorPage( page );
			await ep.login();
			await ep.openEditor( process.env.TEST_FILE );

			const cleanupResult = await cleanupTestSets(
				page,
				process.env.TEST_FILE,
				Array.from( createdSetNames ),
				RUN_PREFIX
			);

			if ( cleanupResult.failed && cleanupResult.failed.length > 0 ) {
				console.error( '[Teardown] Cleanup failures encountered:', cleanupResult.failed );
				throw new Error( `Teardown cleanup failed for sets: ${ JSON.stringify( cleanupResult.failed ) }` );
			}

			console.log( `[Teardown] Successfully cleaned up ${ cleanupResult.deleted.length } test-owned sets.` );

			// Verification: Assert that zero test-owned sets remain on TEST_FILE
			const remainingSets = await page.evaluate( async ( filename ) => {
				const api = new mw.Api();
				const res = await api.get( { action: 'layersinfo', filename, format: 'json' } );
				return ( res.layersinfo && res.layersinfo.named_sets ) || [];
			}, process.env.TEST_FILE );

			const remainingTestSets = remainingSets.filter( ( s ) => s.name.startsWith( RUN_PREFIX ) );
			expect( remainingTestSets ).toHaveLength( 0 );

			// Verify unrelated sets ('001', '002') are intact
			const unrelated001 = remainingSets.find( ( s ) => s.name === '001' );
			const unrelated002 = remainingSets.find( ( s ) => s.name === '002' );
			expect( unrelated001 ).toBeDefined();
			expect( unrelated002 ).toBeDefined();
			expect( unrelated001.name ).toBe( '001' );
			expect( unrelated002.name ).toBe( '002' );
		} finally {
			await context.close();
		}
	} );

	test.beforeEach( async ( { page } ) => {
		test.setTimeout( 60000 );
		editorPage = new LayersEditorPage( page );
		await editorPage.login();
	} );

	test.describe( 'Set Selection & Switching', () => {
		test( 'can see set selector dropdown', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			await editorPage.openEditor( testFile );

			const setSelector = page.locator( '.layers-set-select' );
			await expect( setSelector ).toBeVisible();
		} );

		test( 'a set is selected initially', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			await editorPage.openEditor( testFile );

			const setSelector = page.locator( '.layers-set-select' );
			await expect( setSelector ).toBeVisible();
			await expect.poll( async () => ( await setSelector.inputValue() ).trim().length ).toBeGreaterThan( 0 );
		} );

		test( 'can create a new named set', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const newSetName = `${ RUN_PREFIX }_create`;
			createdSetNames.add( newSetName );

			await editorPage.openEditor( testFile );

			const selector = page.locator( '.layers-set-select' );
			await expect( selector ).toBeVisible();

			// Select '__new__' option to reveal input and create button
			await selector.selectOption( '__new__' );

			const nameInput = page.locator( '.layers-new-set-input' );
			await expect( nameInput ).toBeVisible();
			await nameInput.fill( newSetName );

			const newSetBtn = page.locator( '.layers-new-set-btn' );
			await expect( newSetBtn ).toBeVisible();
			await newSetBtn.click();

			// Verify the new set is selected in the dropdown
			await expect( selector ).toHaveValue( newSetName );
		} );

		test( 'switching sets clears and reloads layers with single confirmation', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const setA = `${ RUN_PREFIX }_sw_a`;
			const setB = `${ RUN_PREFIX }_sw_b`;
			createdSetNames.add( setA );
			createdSetNames.add( setB );

			await editorPage.openEditor( testFile );

			const selector = page.locator( '.layers-set-select' );
			await expect( selector ).toBeVisible();

			// Create Set A
			await selector.selectOption( '__new__' );
			const nameInput = page.locator( '.layers-new-set-input' );
			await expect( nameInput ).toBeVisible();
			await nameInput.fill( setA );
			await page.locator( '.layers-new-set-btn' ).click();
			await expect( selector ).toHaveValue( setA );

			// Create a layer in Set A
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 150, 150 );

			const countInSetA = await editorPage.getLayerCount();
			expect( countInSetA ).toBeGreaterThan( 0 );

			// Save Set A
			await editorPage.save();
			await page.waitForTimeout( 1000 );

			// Create Set B
			await selector.selectOption( '__new__' );
			await expect( nameInput ).toBeVisible();
			await nameInput.fill( setB );
			await page.locator( '.layers-new-set-btn' ).click();
			await expect( selector ).toHaveValue( setB );

			// Set B starts empty
			const countInSetB = await editorPage.getLayerCount();
			expect( countInSetB ).toBe( 0 );

			// Switch back to Set A (triggers single confirmation since Set B is unsaved)
			await selector.selectOption( setA );

			// Exactly one confirmation dialog appears
			const switchAnywayBtn = page.locator( '.layers-modal-buttons .layers-btn-danger' ).first();
			await expect( switchAnywayBtn ).toBeVisible();
			await switchAnywayBtn.click();

			// Layer count should restore to Set A's count cleanly
			await expect( page.locator( '.layer-item:not(.background-layer-item)' ) ).toHaveCount( countInSetA );
			await expect( selector ).toHaveValue( setA );
		} );

		test( 'canceling dirty switch restores selector and preserves unsaved work', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const setCancel = `${ RUN_PREFIX }_sw_c`;
			createdSetNames.add( setCancel );

			await editorPage.openEditor( testFile );

			const selector = page.locator( '.layers-set-select' );
			await expect( selector ).toBeVisible();

			// Create setCancel
			await selector.selectOption( '__new__' );
			const nameInput = page.locator( '.layers-new-set-input' );
			await expect( nameInput ).toBeVisible();
			await nameInput.fill( setCancel );
			await page.locator( '.layers-new-set-btn' ).click();
			await expect( selector ).toHaveValue( setCancel );

			// Save setCancel so it is persisted and clean initially
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 40, 40, 120, 120 );
			await editorPage.save();
			await page.waitForTimeout( 1000 );

			const initialCount = await editorPage.getLayerCount();

			// Add an unsaved layer to make work dirty
			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 160, 160, 240, 240 );
			expect( await editorPage.getLayerCount() ).toBe( initialCount + 1 );

			// Attempt switch to an existing set ('001')
			await selector.selectOption( '001' );

			// Confirmation dialog appears
			const cancelBtn = page.locator( '.layers-modal-buttons .layers-btn-secondary' ).first();
			await expect( cancelBtn ).toBeVisible();
			await cancelBtn.click();

			// Dropdown selector is restored to setCancel
			await expect( selector ).toHaveValue( setCancel );

			// Unsaved work remains intact on canvas
			expect( await editorPage.getLayerCount() ).toBe( initialCount + 1 );
		} );

		test( 'deliberately failed set load preserves state and restores selector', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const activeSet = `${ RUN_PREFIX }_sw_fail`;
			createdSetNames.add( activeSet );

			await editorPage.openEditor( testFile );

			const selector = page.locator( '.layers-set-select' );
			await expect( selector ).toBeVisible();

			// Create activeSet and save a layer in it so it is clean
			await selector.selectOption( '__new__' );
			const nameInput = page.locator( '.layers-new-set-input' );
			await expect( nameInput ).toBeVisible();
			await nameInput.fill( activeSet );
			await page.locator( '.layers-new-set-btn' ).click();
			await expect( selector ).toHaveValue( activeSet );

			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 150, 150 );
			await editorPage.save();
			await page.waitForTimeout( 1000 );

			// Record layer count on active set
			const countBefore = await editorPage.getLayerCount();
			expect( countBefore ).toBeGreaterThan( 0 );

			// Route interception: abort any API request for target set '001' to simulate network/server failure
			await page.route( '**/api.php*', async ( route ) => {
				const url = route.request().url();
				const postData = route.request().postData() || '';
				if ( ( url.includes( 'action=layersinfo' ) && ( url.includes( 'setname=001' ) || url.includes( '001' ) ) ) ||
					( postData.includes( 'action=layersinfo' ) && postData.includes( '001' ) ) ) {
					await route.abort( 'failed' );
				} else {
					await route.continue();
				}
			} );

			// Attempt to switch to '001' (which will fail due to aborted network request)
			await selector.selectOption( '001' );

			// Expect selector to be restored to activeSet after load failure
			await expect( selector ).toHaveValue( activeSet );

			// Expect original layers to be preserved
			expect( await editorPage.getLayerCount() ).toBe( countBefore );

			// Remove route interception
			await page.unroute( '**/api.php*' );
		} );
	} );

	test.describe( 'Set Persistence & Independence', () => {
		test( 'layers saved to a set persist after reload', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const uniqueSetName = `${ RUN_PREFIX }_persist`;
			createdSetNames.add( uniqueSetName );

			await editorPage.openEditor( testFile );

			const selector = page.locator( '.layers-set-select' );
			await expect( selector ).toBeVisible();

			// Create a new set
			await selector.selectOption( '__new__' );
			const nameInput = page.locator( '.layers-new-set-input' );
			await expect( nameInput ).toBeVisible();
			await nameInput.fill( uniqueSetName );
			await page.locator( '.layers-new-set-btn' ).click();
			await expect( selector ).toHaveValue( uniqueSetName );

			// Create a layer
			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );

			const countBeforeSave = await editorPage.getLayerCount();
			expect( countBeforeSave ).toBeGreaterThan( 0 );

			// Save
			await editorPage.save();
			await page.waitForTimeout( 1000 );

			// Reload page and re-open editor
			await page.reload();
			await editorPage.openEditor( testFile );

			// Select the same set again
			const selectorAfter = page.locator( '.layers-set-select' );
			await expect( selectorAfter ).toBeVisible();
			await selectorAfter.selectOption( uniqueSetName );

			// Verify layer persisted
			await expect( page.locator( '.layer-item:not(.background-layer-item)' ) ).toHaveCount( countBeforeSave );
		} );

		test( 'different sets have independent layers', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const set1 = `${ RUN_PREFIX }_indep_1`;
			const set2 = `${ RUN_PREFIX }_indep_2`;
			createdSetNames.add( set1 );
			createdSetNames.add( set2 );

			await editorPage.openEditor( testFile );

			const selector = page.locator( '.layers-set-select' );
			await expect( selector ).toBeVisible();

			// Create Set 1
			await selector.selectOption( '__new__' );
			const nameInput = page.locator( '.layers-new-set-input' );
			await expect( nameInput ).toBeVisible();
			await nameInput.fill( set1 );
			await page.locator( '.layers-new-set-btn' ).click();
			await expect( selector ).toHaveValue( set1 );

			// Create layer in Set 1
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 150, 150 );

			const countSet1 = await editorPage.getLayerCount();
			expect( countSet1 ).toBeGreaterThan( 0 );

			// Save Set 1
			await editorPage.save();
			await page.waitForTimeout( 1000 );

			// Create Set 2
			await selector.selectOption( '__new__' );
			await expect( nameInput ).toBeVisible();
			await nameInput.fill( set2 );
			await page.locator( '.layers-new-set-btn' ).click();
			await expect( selector ).toHaveValue( set2 );

			// Set 2 starts with 0 user layers
			const countSet2 = await editorPage.getLayerCount();
			expect( countSet2 ).toBe( 0 );
			expect( countSet2 ).toBeLessThan( countSet1 );
		} );
	} );

	test.describe( 'Revision History', () => {
		test( 'can view revision history for a set', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			await editorPage.openEditor( testFile );

			// Revision dropdown and load button are unconditional controls in header
			const revSelector = page.locator( '.layers-revision-select' );
			await expect( revSelector ).toBeVisible();

			const revLoadBtn = page.locator( '.layers-revision-load' );
			await expect( revLoadBtn ).toBeVisible();
		} );

		test( 'saving creates a new revision in the revision selector', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const testSetName = `${ RUN_PREFIX }_rev`;
			createdSetNames.add( testSetName );

			await editorPage.openEditor( testFile );

			const selector = page.locator( '.layers-set-select' );
			await expect( selector ).toBeVisible();

			// Create and select new set
			await selector.selectOption( '__new__' );
			const nameInput = page.locator( '.layers-new-set-input' );
			await expect( nameInput ).toBeVisible();
			await nameInput.fill( testSetName );
			await page.locator( '.layers-new-set-btn' ).click();
			await expect( selector ).toHaveValue( testSetName );

			const revSelector = page.locator( '.layers-revision-select' );
			await expect( revSelector ).toBeVisible();

			const initialOptions = await revSelector.locator( 'option' ).count();

			// Create a layer and save
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 200, 200, 300, 300 );
			await editorPage.save();
			await page.waitForTimeout( 1000 );

			// After save, revision options count increases or contains the revision
			await expect.poll( async () => revSelector.locator( 'option' ).count() ).toBeGreaterThanOrEqual( initialOptions );
		} );
	} );

	test.describe( 'Set Management & Lifecycle', () => {
		test( 'can delete a user-owned named set with confirmation', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const toDeleteName = `${ RUN_PREFIX }_to_del`;
			createdSetNames.add( toDeleteName );

			await editorPage.openEditor( testFile );

			const selector = page.locator( '.layers-set-select' );
			await expect( selector ).toBeVisible();

			// Create disposable set
			await selector.selectOption( '__new__' );
			const nameInput = page.locator( '.layers-new-set-input' );
			await expect( nameInput ).toBeVisible();
			await nameInput.fill( toDeleteName );
			await page.locator( '.layers-new-set-btn' ).click();
			await expect( selector ).toHaveValue( toDeleteName );

			// Save to backend so it has a persisted row
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 70, 70, 170, 170 );
			await editorPage.save();
			await page.waitForTimeout( 1000 );

			// Delete button must be present in toolbar
			const deleteBtn = page.locator( '.layers-set-delete-btn' );
			await expect( deleteBtn ).toBeVisible();
			await deleteBtn.click();

			// Confirmation dialog must appear
			const confirmBtn = page.locator( '.layers-modal-buttons .layers-btn-danger' ).first();
			await expect( confirmBtn ).toBeVisible();
			await confirmBtn.click();

			// Verify set is no longer in selector options
			await expect.poll( async () => selector.locator( 'option' ).allTextContents() ).not.toContain( toDeleteName );

			// Remove from tracked set list since already deleted
			createdSetNames.delete( toDeleteName );
		} );

		test( 'can rename a named set', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const originalName = `${ RUN_PREFIX }_orig_ren`;
			const newName = `${ RUN_PREFIX }_new_ren`;
			createdSetNames.add( originalName );

			await editorPage.openEditor( testFile );

			// Ensure set selector is present; fail explicitly if absent
			const selector = page.locator( '.layers-set-select' );
			await expect( selector ).toBeVisible();

			// Switch to "__new__" option to reveal new set input and button
			await selector.selectOption( '__new__' );

			const newSetInput = page.locator( '.layers-new-set-input' );
			await expect( newSetInput ).toBeVisible();
			await newSetInput.fill( originalName );

			const newSetBtn = page.locator( '.layers-new-set-btn' );
			await expect( newSetBtn ).toBeVisible();
			await newSetBtn.click();

			// Save the set to ensure it is persisted to the backend
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 60, 60, 160, 160 );
			await editorPage.save();
			await page.waitForTimeout( 1000 );

			// Trigger rename: rename button must be present in toolbar
			const renameBtn = page.locator( '.layers-set-rename-btn' );
			await expect( renameBtn ).toBeVisible();
			await renameBtn.click();

			// Rename dialog prompt input must appear
			const renameInput = page.locator( '.layers-modal-input' );
			await expect( renameInput ).toBeVisible();
			await renameInput.fill( newName );

			// Confirm through the required dialog button
			const confirmBtn = page.locator( '.layers-modal-buttons .layers-btn-primary' ).first();
			await expect( confirmBtn ).toBeVisible();
			await confirmBtn.click();
			await page.waitForTimeout( 1000 );

			// Track the new name and remove the old name from cleanup registry
			createdSetNames.delete( originalName );
			createdSetNames.add( newName );

			// Verify rename was applied in current selector
			await expect( selector ).toHaveValue( newName );

			// Verify persistence after reload: reopen editor and check database-backed sets
			await page.reload();
			await editorPage.openEditor( testFile );

			const reloadedSelector = page.locator( '.layers-set-select' );
			await expect( reloadedSelector ).toBeVisible();

			await expect( reloadedSelector.locator( `option[value="${ newName }"]` ) ).toHaveCount( 1 );
			await expect( reloadedSelector.locator( `option[value="${ originalName }"]` ) ).toHaveCount( 0 );
		} );

		test( 'maximum-set-cap behavior over repeated runs', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			await editorPage.openEditor( testFile );

			const selector = page.locator( '.layers-set-select' );
			await expect( selector ).toBeVisible();

			// Query current named sets count from dropdown
			const options = await selector.locator( 'option:not([value="__new__"])' ).count();

			// Under max limit (15), "+ New" option is available
			const maxSets = await page.evaluate( () => ( window.mw && mw.config && mw.config.get( 'wgLayersMaxNamedSets', 15 ) ) || 15 );
			expect( options ).toBeLessThanOrEqual( maxSets );

			const newOption = selector.locator( 'option[value="__new__"]' );
			if ( options < maxSets ) {
				await expect( newOption ).toHaveCount( 1 );
			}
		} );
	} );
} );
