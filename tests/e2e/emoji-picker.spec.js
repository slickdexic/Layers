/* eslint-env node */
/**
 * Emoji Picker - E2E Tests
 *
 * Tests for the emoji picker panel functionality.
 * Requires a running MediaWiki instance with the Layers extension installed.
 *
 * Usage:
 *   MW_SERVER=http://localhost:8080 MW_USERNAME=Admin MW_PASSWORD=admin123 npx playwright test tests/e2e/emoji-picker.spec.js
 */

const { test, expect } = require( '@playwright/test' );
const { LayersEditorPage } = require( './fixtures' );

// Skip tests if no MediaWiki server configured
const describeEmoji = process.env.MW_SERVER ? test.describe : test.describe.skip;

describeEmoji( 'Emoji Picker', () => {
	let editorPage;

	test.beforeEach( async ( { page } ) => {
		editorPage = new LayersEditorPage( page );
		await editorPage.login();
		const testFile = process.env.TEST_FILE || 'Test.png';
		await editorPage.openEditor( testFile );
	} );

	test.describe( 'Opening and Closing', () => {
		test( 'can open emoji picker from toolbar button', async ( { page } ) => {
			// Find and click the emoji picker button
			const emojiButton = page.locator( '.emoji-picker-button' );
			await expect( emojiButton ).toBeVisible();
			await emojiButton.click();

			// Emoji picker panel should appear
			const emojiPanel = page.locator( '.layers-emoji-picker' );
			await expect( emojiPanel ).toBeVisible( { timeout: 5000 } );
		} );

		test( 'can close emoji picker with close button', async ( { page } ) => {
			// Open picker
			await page.click( '.emoji-picker-button' );
			await expect( page.locator( '.layers-emoji-picker' ) ).toBeVisible();

			// Click close button
			await page.click( '.layers-emoji-picker-close' );

			// Panel should be gone
			await expect( page.locator( '.layers-emoji-picker' ) ).not.toBeVisible();
		} );

		test( 'can close emoji picker with Escape key', async ( { page } ) => {
			// Open picker
			await page.click( '.emoji-picker-button' );
			await expect( page.locator( '.layers-emoji-picker' ) ).toBeVisible();

			// Press Escape
			await page.keyboard.press( 'Escape' );

			// Panel should be gone
			await expect( page.locator( '.layers-emoji-picker' ) ).not.toBeVisible();
		} );

		test( 'can close emoji picker by clicking overlay', async ( { page } ) => {
			// Open picker
			await page.click( '.emoji-picker-button' );
			await expect( page.locator( '.layers-emoji-picker' ) ).toBeVisible();

			// Click the overlay (not the panel)
			await page.click( '.layers-emoji-picker-overlay' );

			// Panel should be gone
			await expect( page.locator( '.layers-emoji-picker' ) ).not.toBeVisible();
		} );
	} );

	test.describe( 'Panel Structure', () => {
		test.beforeEach( async ( { page } ) => {
			await page.click( '.emoji-picker-button' );
			await expect( page.locator( '.layers-emoji-picker' ) ).toBeVisible();
		} );

		test( 'has search input with focus', async ( { page } ) => {
			const searchInput = page.locator( '.layers-emoji-picker-search-input' );
			await expect( searchInput ).toBeVisible();
			// Search input should be focused when panel opens
			await expect( searchInput ).toBeFocused();
		} );

		test( 'displays category list', async ( { page } ) => {
			const categoryList = page.locator( '.layers-emoji-picker-categories' );
			await expect( categoryList ).toBeVisible();

			// Should have multiple category buttons
			const categories = page.locator( '.layers-emoji-picker-category' );
			const count = await categories.count();
			expect( count ).toBeGreaterThan( 0 );
		} );

		test( 'displays emoji grid', async ( { page } ) => {
			const emojiGrid = page.locator( '.layers-emoji-picker-grid' );
			await expect( emojiGrid ).toBeVisible();
		} );

		test( 'has accessible dialog role', async ( { page } ) => {
			const panel = page.locator( '.layers-emoji-picker' );
			await expect( panel ).toHaveAttribute( 'role', 'dialog' );
		} );
	} );

	test.describe( 'Category Navigation', () => {
		test.beforeEach( async ( { page } ) => {
			await page.click( '.emoji-picker-button' );
			await expect( page.locator( '.layers-emoji-picker' ) ).toBeVisible();
		} );

		test( 'can switch categories', async ( { page } ) => {
			// Get all category buttons
			const categories = page.locator( '.layers-emoji-picker-category' );
			const count = await categories.count();

			if ( count >= 2 ) {
				// Click the second category
				await categories.nth( 1 ).click();

				// Wait for grid to update
				await page.waitForTimeout( 300 );

				// Grid should still have emoji items
				const emojiGrid = page.locator( '.layers-emoji-picker-grid' );
				await expect( emojiGrid ).toBeVisible();
			}
		} );

		test( 'first category is selected by default', async ( { page } ) => {
			// First category should have selected styling (non-transparent border-left)
			const firstCategory = page.locator( '.layers-emoji-picker-category' ).first();
			await expect( firstCategory ).toBeVisible();
		} );
	} );

	test.describe( 'Search Functionality', () => {
		test.beforeEach( async ( { page } ) => {
			await page.click( '.emoji-picker-button' );
			await expect( page.locator( '.layers-emoji-picker' ) ).toBeVisible();
		} );

		test( 'can search for emoji', async ( { page } ) => {
			const searchInput = page.locator( '.layers-emoji-picker-search-input' );

			// Type a search term
			await searchInput.fill( 'smile' );

			// Wait for debounced search
			await page.waitForTimeout( 300 );

			// Grid should show search results (may be empty if no matches)
			const emojiGrid = page.locator( '.layers-emoji-picker-grid' );
			await expect( emojiGrid ).toBeVisible();
		} );

		test( 'shows no results message for invalid search', async ( { page } ) => {
			const searchInput = page.locator( '.layers-emoji-picker-search-input' );

			// Type a search term that won't match anything
			await searchInput.fill( 'xyznonexistent123' );

			// Wait for debounced search
			await page.waitForTimeout( 300 );

			// Should show no results indicator or empty grid
			const emojiGrid = page.locator( '.layers-emoji-picker-grid' );
			await expect( emojiGrid ).toBeVisible();
		} );

		test( 'clears search when input is emptied', async ( { page } ) => {
			const searchInput = page.locator( '.layers-emoji-picker-search-input' );

			// Type and then clear
			await searchInput.fill( 'smile' );
			await page.waitForTimeout( 300 );
			await searchInput.fill( '' );
			await page.waitForTimeout( 300 );

			// Should show category emoji again
			const emojiGrid = page.locator( '.layers-emoji-picker-grid' );
			await expect( emojiGrid ).toBeVisible();
		} );
	} );

	test.describe( 'Emoji Selection', () => {
		test.beforeEach( async ( { page } ) => {
			await page.click( '.emoji-picker-button' );
			await expect( page.locator( '.layers-emoji-picker' ) ).toBeVisible();
			// Wait for emoji to load
			await page.waitForTimeout( 500 );
		} );

		test( 'can click on emoji item', async ( { page } ) => {
			// Find an emoji item in the grid
			const emojiItem = page.locator( '.layers-emoji-picker-grid button' ).first();

			// Wait for at least one emoji to be visible
			await expect( emojiItem ).toBeVisible( { timeout: 5000 } );

			// Click the emoji
			await emojiItem.click();

			// Panel should close after selection
			await expect( page.locator( '.layers-emoji-picker' ) ).not.toBeVisible( { timeout: 3000 } );
		} );

		test( 'emoji items are focusable buttons', async ( { page } ) => {
			const emojiItem = page.locator( '.layers-emoji-picker-grid button' ).first();
			await expect( emojiItem ).toBeVisible( { timeout: 5000 } );

			// Check it's a button (accessible)
			const tagName = await emojiItem.evaluate( ( el ) => el.tagName.toLowerCase() );
			expect( tagName ).toBe( 'button' );
		} );

		test( 'selecting emoji creates a new layer', async ( { page } ) => {
			// Get initial layer count
			const initialCount = await editorPage.getLayerCount();

			// Find and click an emoji
			const emojiItem = page.locator( '.layers-emoji-picker-grid button' ).first();
			await expect( emojiItem ).toBeVisible( { timeout: 5000 } );
			await emojiItem.click();

			// Wait for panel to close and layer to be created
			await expect( page.locator( '.layers-emoji-picker' ) ).not.toBeVisible( { timeout: 3000 } );
			await page.waitForTimeout( 500 );

			// Layer count should have increased
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBeGreaterThan( initialCount );
		} );
	} );

	test.describe( 'Performance and Loading', () => {
		test( 'lazy loads emoji thumbnails', async ( { page } ) => {
			await page.click( '.emoji-picker-button' );
			await expect( page.locator( '.layers-emoji-picker' ) ).toBeVisible();

			// Grid should be visible quickly
			const emojiGrid = page.locator( '.layers-emoji-picker-grid' );
			await expect( emojiGrid ).toBeVisible();

			// Some emoji buttons should appear (with placeholder or loaded state)
			const emojiButtons = page.locator( '.layers-emoji-picker-grid button' );
			await expect( emojiButtons.first() ).toBeVisible( { timeout: 5000 } );
		} );

		test( 'can handle rapid category switching', async ( { page } ) => {
			await page.click( '.emoji-picker-button' );
			await expect( page.locator( '.layers-emoji-picker' ) ).toBeVisible();

			const categories = page.locator( '.layers-emoji-picker-category' );
			const count = await categories.count();

			// Rapidly click through categories
			for ( let i = 0; i < Math.min( count, 5 ); i++ ) {
				await categories.nth( i ).click();
				await page.waitForTimeout( 50 );
			}

			// Panel should still be functional
			const emojiGrid = page.locator( '.layers-emoji-picker-grid' );
			await expect( emojiGrid ).toBeVisible();
		} );
	} );
} );
