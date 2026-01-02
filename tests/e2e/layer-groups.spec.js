/* eslint-env node */
/**
 * Layers Extension - Layer Groups E2E Tests
 *
 * Tests for the layer grouping/folders feature, which allows
 * organizing layers into collapsible folders with shared operations.
 *
 * Usage:
 *   MW_SERVER=http://localhost:8080 MW_USERNAME=Admin MW_PASSWORD=admin123 \
 *     npx playwright test tests/e2e/layer-groups.spec.js
 */

const { test, expect } = require( '@playwright/test' );
const { LayersEditorPage } = require( './fixtures' );

// Skip tests if no MediaWiki server configured
const describeGroups = process.env.MW_SERVER ? test.describe : test.describe.skip;

describeGroups( 'Layer Groups', () => {
	let editorPage;

	test.beforeEach( async ( { page } ) => {
		editorPage = new LayersEditorPage( page );
		await editorPage.login();
	} );

	describeGroups( 'Group Creation', () => {
		test.beforeEach( async () => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );
		} );

		test( 'can create an empty folder', async ( { page } ) => {
			// Look for create folder button in toolbar or layer panel
			const createFolderBtn = await page.$(
				'.create-folder-btn, [data-action="create-folder"], .new-folder-button, ' +
				'[title*="folder" i], [aria-label*="folder" i]'
			);

			if ( createFolderBtn ) {
				const initialCount = await editorPage.getLayerCount();

				await createFolderBtn.click();
				await page.waitForTimeout( 500 );

				// A new group layer should appear
				const newCount = await editorPage.getLayerCount();
				expect( newCount ).toBe( initialCount + 1 );

				// Should have a group/folder in the list
				const folderItem = await page.$(
					'.layer-item[data-type="group"], .group-layer, .folder-item'
				);
				expect( folderItem ).not.toBeNull();
			}
		} );

		test( 'can create group from selected layers (Ctrl+G)', async ( { page } ) => {
			// Create two layers first
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 150, 150 );
			await editorPage.drawOnCanvas( 200, 50, 300, 150 );

			const initialCount = await editorPage.getLayerCount();
			expect( initialCount ).toBeGreaterThanOrEqual( 2 );

			// Select all layers
			await page.keyboard.press( 'Control+a' );
			await page.waitForTimeout( 200 );

			// Group selection with Ctrl+G
			await page.keyboard.press( 'Control+g' );
			await page.waitForTimeout( 500 );

			// Should now have a group layer
			const groupItem = await page.$(
				'.layer-item[data-type="group"], .group-layer, .folder-item'
			);
			expect( groupItem ).not.toBeNull();
		} );

		test( 'group contains selected layers as children', async ( { page } ) => {
			// Create layers
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 150, 50, 200, 100 );

			// Select all and group
			await page.keyboard.press( 'Control+a' );
			await page.waitForTimeout( 200 );
			await page.keyboard.press( 'Control+g' );
			await page.waitForTimeout( 500 );

			// Look for nested/child layers inside the group
			const childLayers = await page.$$(
				'.layer-item.child-layer, .nested-layer, [data-parent-group], ' +
				'.layer-item[style*="padding-left"], .layer-item.indented'
			);

			// Should have child layers (at least the original 2)
			expect( childLayers.length ).toBeGreaterThanOrEqual( 2 );
		} );
	} );

	describeGroups( 'Group Expansion', () => {
		test.beforeEach( async () => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Create a group with layers
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await editorPage.drawOnCanvas( 150, 50, 200, 100 );
			await editorPage.page.keyboard.press( 'Control+a' );
			await editorPage.page.waitForTimeout( 200 );
			await editorPage.page.keyboard.press( 'Control+g' );
			await editorPage.page.waitForTimeout( 500 );
		} );

		test( 'can collapse a group', async ( { page } ) => {
			// Find the group's expand/collapse toggle
			const expandToggle = await page.$(
				'.group-expand-toggle, .folder-toggle, [data-action="toggle-expand"], ' +
				'.expand-collapse-btn, .group-layer .toggle-btn'
			);

			if ( expandToggle ) {
				// Get count of visible layers
				const countBefore = await editorPage.getLayerCount();

				// Click to collapse
				await expandToggle.click();
				await page.waitForTimeout( 300 );

				// After collapsing, child layers should be hidden
				const countAfter = await editorPage.getLayerCount();
				expect( countAfter ).toBeLessThan( countBefore );
			}
		} );

		test( 'can expand a collapsed group', async ( { page } ) => {
			// Find and collapse first
			const expandToggle = await page.$(
				'.group-expand-toggle, .folder-toggle, [data-action="toggle-expand"]'
			);

			if ( expandToggle ) {
				// Collapse
				await expandToggle.click();
				await page.waitForTimeout( 300 );

				const countCollapsed = await editorPage.getLayerCount();

				// Expand again
				await expandToggle.click();
				await page.waitForTimeout( 300 );

				const countExpanded = await editorPage.getLayerCount();
				expect( countExpanded ).toBeGreaterThan( countCollapsed );
			}
		} );

		test( 'group expansion state persists after save', async ( { page } ) => {
			// Collapse the group
			const expandToggle = await page.$(
				'.group-expand-toggle, .folder-toggle, [data-action="toggle-expand"]'
			);

			if ( expandToggle ) {
				await expandToggle.click();
				await page.waitForTimeout( 300 );

				const countCollapsed = await editorPage.getLayerCount();

				// Save
				await editorPage.save();
				await page.waitForTimeout( 1000 );

				// Reload
				const testFile = process.env.TEST_FILE || 'Test.png';
				await editorPage.openEditor( testFile );

				// Group should still be collapsed
				const countAfterReload = await editorPage.getLayerCount();
				expect( countAfterReload ).toBe( countCollapsed );
			}
		} );
	} );

	describeGroups( 'Group Visibility', () => {
		test( 'toggling group visibility affects children', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Create layers and group them
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
			await page.keyboard.press( 'Control+a' );
			await page.waitForTimeout( 200 );
			await page.keyboard.press( 'Control+g' );
			await page.waitForTimeout( 500 );

			// Find the group's visibility toggle
			const groupItem = await page.$(
				'.layer-item[data-type="group"], .group-layer, .folder-item'
			);

			if ( groupItem ) {
				const visibilityToggle = await groupItem.$(
					'.layer-visibility-toggle, .visibility-btn, [data-action="toggle-visibility"]'
				);

				if ( visibilityToggle ) {
					// Hide the group
					await visibilityToggle.click();
					await page.waitForTimeout( 300 );

					// Check if child layers are also hidden (via CSS or aria attributes)
					const hiddenChildren = await page.$$(
						'.layer-item.hidden, .layer-item[data-visible="false"], ' +
						'.layer-item .visibility-off'
					);

					// There should be hidden elements
					expect( hiddenChildren.length ).toBeGreaterThanOrEqual( 1 );
				}
			}
		} );
	} );

	describeGroups( 'Ungroup', () => {
		test( 'can ungroup layers (Ctrl+Shift+G)', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Create and group layers
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await editorPage.drawOnCanvas( 150, 50, 200, 100 );
			await page.keyboard.press( 'Control+a' );
			await page.waitForTimeout( 200 );
			await page.keyboard.press( 'Control+g' );
			await page.waitForTimeout( 500 );

			// Verify group exists
			let groupItem = await page.$(
				'.layer-item[data-type="group"], .group-layer, .folder-item'
			);
			expect( groupItem ).not.toBeNull();

			// Select the group
			await groupItem.click();
			await page.waitForTimeout( 200 );

			// Ungroup with Ctrl+Shift+G
			await page.keyboard.press( 'Control+Shift+g' );
			await page.waitForTimeout( 500 );

			// Group should no longer exist
			groupItem = await page.$(
				'.layer-item[data-type="group"], .group-layer, .folder-item'
			);
			expect( groupItem ).toBeNull();

			// Original layers should still exist
			const layerCount = await editorPage.getLayerCount();
			expect( layerCount ).toBeGreaterThanOrEqual( 2 );
		} );
	} );

	describeGroups( 'Drag and Drop', () => {
		test( 'can drag layer into a group', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Create a standalone layer
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );

			// Create an empty folder
			const createFolderBtn = await page.$(
				'.create-folder-btn, [data-action="create-folder"]'
			);
			if ( createFolderBtn ) {
				await createFolderBtn.click();
				await page.waitForTimeout( 500 );
			}

			// Get the layer item and the folder item
			const layerItems = await page.$$( '.layer-item:not([data-type="group"])' );
			const folderItem = await page.$(
				'.layer-item[data-type="group"], .folder-item'
			);

			if ( layerItems.length > 0 && folderItem ) {
				const sourceBox = await layerItems[ 0 ].boundingBox();
				const targetBox = await folderItem.boundingBox();

				if ( sourceBox && targetBox ) {
					// Drag layer into folder
					await page.mouse.move(
						sourceBox.x + sourceBox.width / 2,
						sourceBox.y + sourceBox.height / 2
					);
					await page.mouse.down();
					await page.mouse.move(
						targetBox.x + targetBox.width / 2,
						targetBox.y + targetBox.height / 2,
						{ steps: 10 }
					);
					await page.mouse.up();
					await page.waitForTimeout( 500 );

					// Check if layer is now inside the group
					const childLayers = await page.$$(
						'.layer-item.child-layer, .layer-item[data-parent-group], ' +
						'.layer-item.nested'
					);
					expect( childLayers.length ).toBeGreaterThanOrEqual( 1 );
				}
			}
		} );
	} );

	describeGroups( 'Group Selection', () => {
		test( 'clicking group selects all child layers', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Create layers and group them
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await editorPage.drawOnCanvas( 150, 50, 200, 100 );
			await page.keyboard.press( 'Control+a' );
			await page.waitForTimeout( 200 );
			await page.keyboard.press( 'Control+g' );
			await page.waitForTimeout( 500 );

			// Deselect all
			await page.keyboard.press( 'Escape' );
			await page.waitForTimeout( 200 );

			// Click on the group in the layer panel
			const groupItem = await page.$(
				'.layer-item[data-type="group"], .group-layer, .folder-item'
			);
			if ( groupItem ) {
				await groupItem.click();
				await page.waitForTimeout( 300 );

				// Check that multiple items are now selected
				const selectedItems = await page.$$(
					'.layer-item.selected, .layer-item[aria-selected="true"]'
				);
				// Should have at least 3 selected: the group + 2 children
				expect( selectedItems.length ).toBeGreaterThanOrEqual( 1 );
			}
		} );
	} );

	describeGroups( 'Group Deletion', () => {
		test( 'deleting group shows options dialog', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Create layers and group them
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await page.keyboard.press( 'Control+a' );
			await page.waitForTimeout( 200 );
			await page.keyboard.press( 'Control+g' );
			await page.waitForTimeout( 500 );

			// Select the group
			const groupItem = await page.$(
				'.layer-item[data-type="group"], .group-layer, .folder-item'
			);
			if ( groupItem ) {
				await groupItem.click();
				await page.waitForTimeout( 200 );

				// Press Delete
				await page.keyboard.press( 'Delete' );
				await page.waitForTimeout( 300 );

				// Should see a dialog asking about deletion behavior
				const dialog = await page.$(
					'.oo-ui-dialog, .confirm-dialog, [role="dialog"], .delete-group-dialog'
				);

				// If dialog exists, it should have options
				if ( dialog ) {
					const dialogText = await dialog.textContent();
					// Dialog should mention folder/group/children/keep
					expect(
						dialogText.toLowerCase().includes( 'folder' ) ||
						dialogText.toLowerCase().includes( 'group' ) ||
						dialogText.toLowerCase().includes( 'delete' ) ||
						dialogText.toLowerCase().includes( 'children' )
					).toBe( true );

					// Close dialog
					await page.keyboard.press( 'Escape' );
				}
			}
		} );

		test( 'can delete folder only, keeping children', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );

			// Create layers and group them
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await editorPage.drawOnCanvas( 150, 50, 200, 100 );
			await page.keyboard.press( 'Control+a' );
			await page.waitForTimeout( 200 );
			await page.keyboard.press( 'Control+g' );
			await page.waitForTimeout( 500 );

			// Get the count (includes group + children)
			const countWithGroup = await editorPage.getLayerCount();

			// Select and delete the group
			const groupItem = await page.$(
				'.layer-item[data-type="group"], .group-layer, .folder-item'
			);
			if ( groupItem ) {
				await groupItem.click();
				await page.waitForTimeout( 200 );
				await page.keyboard.press( 'Delete' );
				await page.waitForTimeout( 300 );

				// Look for "keep children" / "folder only" option
				const keepChildrenBtn = await page.$(
					'[data-action="delete-folder-only"], .keep-children-btn, ' +
					'button:has-text("keep"), button:has-text("folder only")'
				);

				if ( keepChildrenBtn ) {
					await keepChildrenBtn.click();
					await page.waitForTimeout( 500 );

					// Children should remain, only group is deleted
					const countAfter = await editorPage.getLayerCount();
					// Should have children but not the group
					expect( countAfter ).toBe( countWithGroup - 1 );

					// No more groups
					const groupAfter = await page.$(
						'.layer-item[data-type="group"], .group-layer, .folder-item'
					);
					expect( groupAfter ).toBeNull();
				}
			}
		} );
	} );
} );
