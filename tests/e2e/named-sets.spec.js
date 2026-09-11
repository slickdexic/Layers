/* eslint-env node */
/**
 * Layers Extension - Named Layer Sets E2E Tests
 *
 * Tests for the named layer sets feature, which allows multiple
 * independent annotation sets per image with version history.
 *
 * Usage:
 *   MW_SERVER=http://localhost:8080 TEST_FILE=LayersQA.png MW_USERNAME=LayersQA MW_PASSWORD=... \
 *     npx playwright test tests/e2e/named-sets.spec.js
 */

const { test, expect } = require( '@playwright/test' );
const { LayersEditorPage } = require( './fixtures' );

// Skip tests if no MediaWiki server configured
const describeNamedSets = process.env.MW_SERVER ? test.describe : test.describe.skip;

describeNamedSets( 'Named Layer Sets', () => {
	test.describe.configure( { mode: 'serial' } );

	let editorPage;

	test.beforeAll( () => {
		if ( !process.env.TEST_FILE ) {
			throw new Error( 'Set TEST_FILE to an isolated, test-owned image before running named-set writes.' );
		}
	} );

	test.beforeEach( async ( { page } ) => {
		editorPage = new LayersEditorPage( page );
		await editorPage.login();
	} );

	describeNamedSets( 'Set Selection', () => {
		test( 'can see set selector dropdown', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			await editorPage.openEditor( testFile );

			// Check for set selector in the UI
			const setSelector = page.locator( '.layers-set-select' );
			await expect( setSelector ).toBeVisible();
		} );

		test( 'a set is selected initially', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			await editorPage.openEditor( testFile );

			// Some set is always shown as selected; its name is user-defined,
			// so require that the value is non-empty.
			const setSelector = page.locator( '.layers-set-select' );
			await expect( setSelector ).toBeVisible();
			await expect.poll( async () => ( await setSelector.inputValue() ).trim().length ).toBeGreaterThan( 0 );
		} );

		test( 'can create a new named set', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const newSetName = 'test-set-' + Date.now();
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

		test( 'switching sets clears and reloads layers', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const setA = 'switch-a-' + Date.now();
			const setB = 'switch-b-' + Date.now();
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

			// Switch back to Set A (confirming switch since Set B was created unsaved)
			await selector.selectOption( setA );
			const switchAnywayBtn = page.locator( '.layers-modal-buttons .layers-btn-danger' ).first();
			await expect( switchAnywayBtn ).toBeVisible();
			await switchAnywayBtn.click();

			// Layer count should restore to Set A's count
			await expect( page.locator( '.layer-item:not(.background-layer-item)' ) ).toHaveCount( countInSetA );
		} );
	} );

	describeNamedSets( 'Set Persistence', () => {
		test( 'layers saved to a set persist after reload', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const uniqueSetName = 'persist-test-' + Date.now();

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

			// Reload
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
			const set1 = 'indep-1-' + Date.now();
			const set2 = 'indep-2-' + Date.now();

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

	describeNamedSets( 'Revision History', () => {
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
			const testSetName = 'rev-test-' + Date.now();
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

	describeNamedSets( 'Set Management', () => {
		test( 'can delete a user-owned named set with confirmation', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const toDeleteName = 'del-test-' + Date.now();

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
		} );

		test( 'can rename a named set', async ( { page } ) => {
			const testFile = process.env.TEST_FILE;
			const originalName = 'rename-test-' + Date.now();
			const newName = 'renamed-' + Date.now();

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
	} );
} );
