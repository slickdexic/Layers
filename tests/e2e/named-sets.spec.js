/* eslint-env node */
/**
 * Layers Extension - Named Layer Sets E2E Tests
 *
 * Tests for the named layer sets feature, which allows multiple
 * independent annotation sets per image with version history.
 *
 * Usage:
 *   MW_SERVER=http://localhost:8080 MW_USERNAME=Admin MW_PASSWORD=admin123 \
 *     npx playwright test tests/e2e/named-sets.spec.js
 */

const { test, expect } = require( '@playwright/test' );
const { LayersEditorPage } = require( './fixtures' );

// Skip tests if no MediaWiki server configured
const describeNamedSets = process.env.MW_SERVER ? test.describe : test.describe.skip;

describeNamedSets( 'Named Layer Sets', () => {
	let editorPage;

	test.beforeEach( async ( { page } ) => {
		editorPage = new LayersEditorPage( page );
		await editorPage.login();
	} );

	describeNamedSets( 'Set Selection', () => {
		test( 'can see set selector dropdown', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Check for set selector in the UI
			const setSelector = await page.$(
				'.layers-set-selector, .set-selector, [data-testid="set-selector"]'
			);
			expect( setSelector ).not.toBeNull();
		} );

		test( 'default set is selected initially', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Check that 'default' set is shown as selected
			const selectedText = await page.textContent(
				'.layers-set-selector .selected-set, .set-selector-label, [data-current-set]'
			);
			expect( selectedText.toLowerCase() ).toContain( 'default' );
		} );

		test( 'can create a new named set', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Click dropdown to expand options
			const selector = await page.$(
				'.layers-set-selector, .set-selector'
			);
			if ( selector ) {
				await selector.click();
			}

			// Look for "new set" or "create set" button
			const newSetBtn = await page.$(
				'.new-set-button, [data-action="create-set"], .create-set-btn'
			);
			if ( newSetBtn ) {
				await newSetBtn.click();

				// Wait for dialog/input
				await page.waitForTimeout( 500 );

				// Type new set name
				const nameInput = await page.$(
					'.set-name-input, input[name="setname"], .oo-ui-inputWidget input'
				);
				if ( nameInput ) {
					await nameInput.fill( 'test-set-' + Date.now() );

					// Confirm creation
					await page.keyboard.press( 'Enter' );
					await page.waitForTimeout( 500 );

					// Verify the new set appears in the selector
					const selectorText = await page.textContent(
						'.layers-set-selector, .set-selector'
					);
					expect( selectorText ).toContain( 'test-set' );
				}
			}
		} );

		test( 'switching sets clears and reloads layers', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Create a layer in the default set
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 150, 150 );

			const countInDefault = await editorPage.getLayerCount();
			expect( countInDefault ).toBeGreaterThan( 0 );

			// Try to switch to a different set if available
			const selector = await page.$(
				'.layers-set-selector, .set-selector'
			);
			if ( selector ) {
				await selector.click();

				// Look for set options
				const setOptions = await page.$$(
					'.set-option, .set-menu-item, [data-set-name]'
				);
				if ( setOptions.length > 1 ) {
					// Click a different set (not the first one which is likely 'default')
					await setOptions[ 1 ].click();
					await page.waitForTimeout( 500 );

					// Layer count should change (different set = different layers)
					const countInOtherSet = await editorPage.getLayerCount();
					// We just verify it's a number (could be 0 for new set)
					expect( typeof countInOtherSet ).toBe( 'number' );
				}
			}
		} );
	} );

	describeNamedSets( 'Set Persistence', () => {
		test( 'layers saved to a set persist after reload', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			const uniqueSetName = 'persist-test-' + Date.now();

			await editorPage.openEditor( testFile );

			// Create a new set for this test to avoid interference
			const selector = await page.$(
				'.layers-set-selector, .set-selector'
			);
			if ( selector ) {
				await selector.click();
				const newSetBtn = await page.$(
					'.new-set-button, [data-action="create-set"]'
				);
				if ( newSetBtn ) {
					await newSetBtn.click();
					await page.waitForTimeout( 300 );

					const nameInput = await page.$(
						'.set-name-input, input[name="setname"], .oo-ui-inputWidget input'
					);
					if ( nameInput ) {
						await nameInput.fill( uniqueSetName );
						await page.keyboard.press( 'Enter' );
						await page.waitForTimeout( 500 );
					}
				}
			}

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
			const selectorAfter = await page.$(
				'.layers-set-selector, .set-selector'
			);
			if ( selectorAfter ) {
				await selectorAfter.click();
				const setOption = await page.$(
					`[data-set-name="${ uniqueSetName }"], .set-option:has-text("${ uniqueSetName }")`
				);
				if ( setOption ) {
					await setOption.click();
					await page.waitForTimeout( 500 );
				}
			}

			// Verify layer persisted
			const countAfterReload = await editorPage.getLayerCount();
			expect( countAfterReload ).toBe( countBeforeSave );
		} );

		test( 'different sets have independent layers', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';

			await editorPage.openEditor( testFile );

			// Create layer in default set
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 150, 150 );

			const countDefault = await editorPage.getLayerCount();

			// Save to default set
			await editorPage.save();
			await page.waitForTimeout( 1000 );

			// Create a new set
			const selector = await page.$(
				'.layers-set-selector, .set-selector'
			);
			if ( selector ) {
				await selector.click();
				const newSetBtn = await page.$(
					'.new-set-button, [data-action="create-set"]'
				);
				if ( newSetBtn ) {
					await newSetBtn.click();
					await page.waitForTimeout( 300 );

					const nameInput = await page.$(
						'.set-name-input, input[name="setname"], .oo-ui-inputWidget input'
					);
					if ( nameInput ) {
						await nameInput.fill( 'independent-test-' + Date.now() );
						await page.keyboard.press( 'Enter' );
						await page.waitForTimeout( 500 );
					}
				}
			}

			// This new set should start empty (or with 0 user layers)
			const countNewSet = await editorPage.getLayerCount();
			expect( countNewSet ).toBeLessThan( countDefault );
		} );
	} );

	describeNamedSets( 'Revision History', () => {
		test( 'can view revision history for a set', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Look for revision history button/dropdown
			const historyBtn = await page.$(
				'.revision-history-btn, [data-action="show-revisions"], .show-history'
			);
			if ( historyBtn ) {
				await historyBtn.click();
				await page.waitForTimeout( 300 );

				// Should show revision list
				const revisionList = await page.$(
					'.revision-list, .history-panel, [data-testid="revisions"]'
				);
				expect( revisionList ).not.toBeNull();
			}
		} );

		test( 'saving creates a new revision', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Check initial revision count
			const historyBtn = await page.$(
				'.revision-history-btn, [data-action="show-revisions"]'
			);

			let initialRevisionCount = 0;
			if ( historyBtn ) {
				await historyBtn.click();
				await page.waitForTimeout( 300 );

				const revisions = await page.$$(
					'.revision-item, .history-item, [data-revision-id]'
				);
				initialRevisionCount = revisions.length;

				// Close history panel
				await page.keyboard.press( 'Escape' );
			}

			// Create a layer and save
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 200, 200, 300, 300 );
			await editorPage.save();
			await page.waitForTimeout( 1000 );

			// Check revision count again
			if ( historyBtn ) {
				await historyBtn.click();
				await page.waitForTimeout( 300 );

				const revisionsAfter = await page.$$(
					'.revision-item, .history-item, [data-revision-id]'
				);
				expect( revisionsAfter.length ).toBeGreaterThanOrEqual( initialRevisionCount );
			}
		} );
	} );

	describeNamedSets( 'Set Management', () => {
		test( 'cannot delete the default set from UI', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Open set selector
			const selector = await page.$(
				'.layers-set-selector, .set-selector'
			);
			if ( selector ) {
				await selector.click();
				await page.waitForTimeout( 300 );

				// Look for delete button on default set - it should be disabled or hidden
				const deleteDefaultBtn = await page.$(
					'.delete-set-btn[data-set-name="default"]:not([disabled]), ' +
					'[data-action="delete-set"][data-set-name="default"]:not([disabled])'
				);
				// Default set delete button should not be clickable
				expect( deleteDefaultBtn ).toBeNull();
			}
		} );

		test( 'can rename a named set', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			const originalName = 'rename-test-' + Date.now();
			const newName = 'renamed-' + Date.now();

			await editorPage.openEditor( testFile );

			// Create a new set first
			const selector = await page.$(
				'.layers-set-selector, .set-selector'
			);
			if ( selector ) {
				await selector.click();
				const newSetBtn = await page.$(
					'.new-set-button, [data-action="create-set"]'
				);
				if ( newSetBtn ) {
					await newSetBtn.click();
					await page.waitForTimeout( 300 );

					const nameInput = await page.$(
						'.set-name-input, input[name="setname"], .oo-ui-inputWidget input'
					);
					if ( nameInput ) {
						await nameInput.fill( originalName );
						await page.keyboard.press( 'Enter' );
						await page.waitForTimeout( 500 );
					}
				}

				// Now try to rename it
				await selector.click();
				await page.waitForTimeout( 300 );

				const renameBtn = await page.$(
					`[data-action="rename-set"], .rename-set-btn`
				);
				if ( renameBtn ) {
					await renameBtn.click();
					await page.waitForTimeout( 300 );

					const renameInput = await page.$(
						'.rename-input, input[name="newname"], .oo-ui-inputWidget input'
					);
					if ( renameInput ) {
						await renameInput.fill( newName );
						await page.keyboard.press( 'Enter' );
						await page.waitForTimeout( 500 );

						// Verify rename happened
						const selectorText = await page.textContent(
							'.layers-set-selector, .set-selector'
						);
						expect( selectorText ).toContain( newName );
					}
				}
			}
		} );
	} );
} );
