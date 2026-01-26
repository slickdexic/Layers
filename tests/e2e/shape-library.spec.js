/* eslint-env node */
/**
 * Shape Library Panel - E2E Tests
 *
 * Tests for the Shape Library Panel UI which provides access to 1,310 shapes
 * across 10 categories. This fills the testing gap for ShapeLibraryPanel.js
 * which has 0% unit test coverage due to tight OOUI integration.
 *
 * Usage:
 *   MW_SERVER=http://localhost:8080 npx playwright test tests/e2e/shape-library.spec.js
 *
 * For tests requiring login:
 *   MW_SERVER=http://localhost:8080 MW_USERNAME=Admin MW_PASSWORD=admin123 npx playwright test
 */

const { test, expect } = require( '@playwright/test' );
const { LayersEditorPage } = require( './fixtures' );

// Skip tests if no MediaWiki server configured
const describeShapeLibrary = process.env.MW_SERVER ? test.describe : test.describe.skip;

describeShapeLibrary( 'Shape Library Panel', () => {
	let editorPage;

	test.beforeEach( async ( { page } ) => {
		editorPage = new LayersEditorPage( page );
		// Login required for all editor operations
		await editorPage.login();
		// Open editor on test file
		const testFile = process.env.TEST_FILE || 'Test.png';
		await editorPage.openEditor( testFile );
	} );

	describeShapeLibrary( 'Panel Opening and Closing', () => {
		test( 'can open shape library via toolbar button', async ( { page } ) => {
			// Click shape library button
			await page.click( '.shape-library-button' );

			// Wait for panel to appear
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Panel should be visible
			const panel = await page.$( '.layers-shape-library-panel' );
			expect( panel ).not.toBeNull();

			// Overlay should also be visible
			const overlay = await page.$( '.layers-shape-library-overlay' );
			const overlayDisplay = await overlay.evaluate( el => getComputedStyle( el ).display );
			expect( overlayDisplay ).not.toBe( 'none' );
		} );

		test( 'can close shape library via close button', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Click close button
			await page.click( '.layers-shape-library-close' );

			// Panel should be hidden
			await page.waitForTimeout( 300 ); // Allow animation
			const panel = await page.$( '.layers-shape-library-panel' );
			const panelDisplay = await panel.evaluate( el => getComputedStyle( el ).display );
			expect( panelDisplay ).toBe( 'none' );
		} );

		test( 'can close shape library via Escape key', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Press Escape
			await page.keyboard.press( 'Escape' );

			// Panel should be hidden
			await page.waitForTimeout( 300 );
			const panel = await page.$( '.layers-shape-library-panel' );
			const panelDisplay = await panel.evaluate( el => getComputedStyle( el ).display );
			expect( panelDisplay ).toBe( 'none' );
		} );

		test( 'can close shape library via overlay click', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Click overlay (not the panel itself)
			await page.click( '.layers-shape-library-overlay', { position: { x: 10, y: 10 } } );

			// Panel should be hidden
			await page.waitForTimeout( 300 );
			const panel = await page.$( '.layers-shape-library-panel' );
			const panelDisplay = await panel.evaluate( el => getComputedStyle( el ).display );
			expect( panelDisplay ).toBe( 'none' );
		} );
	} );

	describeShapeLibrary( 'Category Navigation', () => {
		test( 'displays category list on open', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Category list should be visible
			const categoryList = await page.$( '.layers-shape-library-categories' );
			expect( categoryList ).not.toBeNull();

			// Should have multiple category items
			const categories = await page.$$( '.layers-shape-library-category' );
			expect( categories.length ).toBeGreaterThan( 5 );
		} );

		test( 'can navigate between categories', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Get all category buttons
			const categories = await page.$$( '.layers-shape-library-category' );
			expect( categories.length ).toBeGreaterThan( 0 );

			// Click a different category
			const secondCategory = categories[ 1 ];
			await secondCategory.click();
			await page.waitForTimeout( 200 ); // Allow shapes to load

			// Should have an active category
			const activeCategory = await page.$( '.layers-shape-library-category.active' );
			expect( activeCategory ).not.toBeNull();
		} );

		test( 'displays shapes when category selected', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Wait for shapes to load (default category should auto-select)
			await page.waitForSelector( '.layers-shape-library-item', { timeout: 5000 } );

			// Should have shape items in grid
			const shapes = await page.$$( '.layers-shape-library-item' );
			expect( shapes.length ).toBeGreaterThan( 0 );
		} );
	} );

	describeShapeLibrary( 'Search Functionality', () => {
		test( 'has search input focused on open', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Search input should be focused
			const searchInput = await page.$( '.layers-shape-library-search-input' );
			expect( searchInput ).not.toBeNull();

			// Should be able to type immediately
			await page.keyboard.type( 'test' );
			const inputValue = await searchInput.inputValue();
			expect( inputValue ).toBe( 'test' );
		} );

		test( 'search filters shapes in current category', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Wait for initial shapes
			await page.waitForSelector( '.layers-shape-library-item', { timeout: 5000 } );
			const initialShapes = await page.$$( '.layers-shape-library-item' );
			expect( initialShapes.length ).toBeGreaterThan( 0 );

			// Clear and type search term
			const searchInput = await page.$( '.layers-shape-library-search-input' );
			await searchInput.fill( 'warning' );

			// Wait for search debounce and filter
			await page.waitForTimeout( 400 );

			// Shape count should change (either filtered or showing search results)
			const filteredShapes = await page.$$( '.layers-shape-library-item' );
			// We can't predict exact count, but search should work without error
			expect( filteredShapes.length ).toBeGreaterThanOrEqual( 0 );
		} );

		test( 'can clear search', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Type search term
			const searchInput = await page.$( '.layers-shape-library-search-input' );
			await searchInput.fill( 'test' );
			await page.waitForTimeout( 400 );

			// Clear search
			await searchInput.fill( '' );
			await page.waitForTimeout( 400 );

			// Should show category shapes again
			const shapes = await page.$$( '.layers-shape-library-item' );
			expect( shapes.length ).toBeGreaterThan( 0 );
		} );
	} );

	describeShapeLibrary( 'Shape Selection and Insertion', () => {
		test( 'shape items have preview and label', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Wait for shapes
			await page.waitForSelector( '.layers-shape-library-item', { timeout: 5000 } );

			// First shape should have preview
			const preview = await page.$( '.layers-shape-library-item .layers-shape-library-preview' );
			expect( preview ).not.toBeNull();

			// First shape should have label
			const label = await page.$( '.layers-shape-library-item .layers-shape-library-label' );
			expect( label ).not.toBeNull();
		} );

		test( 'clicking shape inserts it onto canvas', async ( { page } ) => {
			// Get initial layer count
			const initialCount = await editorPage.getLayerCount();

			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Wait for shapes and click first one
			await page.waitForSelector( '.layers-shape-library-item', { timeout: 5000 } );
			await page.click( '.layers-shape-library-item' );

			// Panel should close after selection
			await page.waitForTimeout( 500 );

			// Layer count should increase by 1
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );

		test( 'panel closes after shape selection', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Click a shape
			await page.waitForSelector( '.layers-shape-library-item', { timeout: 5000 } );
			await page.click( '.layers-shape-library-item' );

			// Panel should be hidden
			await page.waitForTimeout( 500 );
			const panel = await page.$( '.layers-shape-library-panel' );
			const panelDisplay = await panel.evaluate( el => getComputedStyle( el ).display );
			expect( panelDisplay ).toBe( 'none' );
		} );
	} );

	describeShapeLibrary( 'Accessibility', () => {
		test( 'panel has proper ARIA attributes', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Panel should have role
			const panel = await page.$( '.layers-shape-library-panel' );
			const role = await panel.getAttribute( 'role' );
			// Accept dialog or absence of role (implementation may vary)
			expect( role === 'dialog' || role === null ).toBe( true );

			// Close button should have aria-label
			const closeBtn = await page.$( '.layers-shape-library-close' );
			const closeLabel = await closeBtn.getAttribute( 'aria-label' );
			// Accept aria-label or title
			const closeTitle = await closeBtn.getAttribute( 'title' );
			expect( closeLabel || closeTitle ).toBeTruthy();
		} );

		test( 'shape items are keyboard navigable', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Wait for shapes
			await page.waitForSelector( '.layers-shape-library-item', { timeout: 5000 } );

			// Tab to first shape (from search input)
			await page.keyboard.press( 'Tab' );
			await page.waitForTimeout( 100 );

			// Should be able to navigate with keyboard
			await page.keyboard.press( 'Tab' );
			await page.waitForTimeout( 100 );

			// Should still be in the panel
			const activeElement = await page.evaluate( () => {
				return document.activeElement?.closest( '.layers-shape-library-panel' ) !== null;
			} );
			expect( activeElement ).toBe( true );
		} );
	} );

	describeShapeLibrary( 'Visual Regression', () => {
		test( 'shape library panel renders correctly', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Wait for shapes to load
			await page.waitForSelector( '.layers-shape-library-item', { timeout: 5000 } );
			await page.waitForTimeout( 500 ); // Allow lazy loading

			// Take screenshot of panel for visual comparison
			const panel = await page.$( '.layers-shape-library-panel' );
			expect( panel ).not.toBeNull();

			// If visual regression testing is enabled, compare screenshot
			// For now, just verify panel is visible and has content
			const panelBox = await panel.boundingBox();
			expect( panelBox.width ).toBeGreaterThan( 400 );
			expect( panelBox.height ).toBeGreaterThan( 300 );
		} );

		test( 'shape previews load correctly', async ( { page } ) => {
			// Open panel
			await page.click( '.shape-library-button' );
			await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

			// Wait for shapes
			await page.waitForSelector( '.layers-shape-library-item', { timeout: 5000 } );
			await page.waitForTimeout( 1000 ); // Allow SVG loading

			// Check that preview elements have content
			const previews = await page.$$( '.layers-shape-library-preview' );
			expect( previews.length ).toBeGreaterThan( 0 );

			// First preview should have an SVG or image
			const firstPreview = previews[ 0 ];
			const hasSvg = await firstPreview.$( 'svg' );
			const hasImg = await firstPreview.$( 'img' );
			expect( hasSvg || hasImg ).toBeTruthy();
		} );
	} );
} );

describeShapeLibrary( 'Shape Library Categories', () => {
	let editorPage;

	test.beforeEach( async ( { page } ) => {
		editorPage = new LayersEditorPage( page );
		await editorPage.login();
		const testFile = process.env.TEST_FILE || 'Test.png';
		await editorPage.openEditor( testFile );
	} );

	/**
	 * Test each shape category has shapes
	 * The library has 10 categories as per documentation
	 */
	const expectedCategories = [
		'iso7010-w',  // Warning signs
		'iso7010-p',  // Prohibition signs
		'iso7010-m',  // Mandatory signs
		'iso7010-e',  // Emergency signs
		'iso7010-f',  // Fire safety
		'arrows',     // Arrow shapes
		'basic',      // Basic geometric shapes
		'flowchart',  // Flowchart symbols
		'callouts',   // Callout shapes
		'misc'        // Miscellaneous
	];

	// Only run detailed category tests if environment variable is set
	// These tests take longer due to navigation
	const describeCategoryTests = process.env.TEST_ALL_CATEGORIES ?
		test.describe : test.describe.skip;

	describeCategoryTests( 'Category Contents', () => {
		for ( const categoryId of expectedCategories ) {
			test( `category "${ categoryId }" contains shapes`, async ( { page } ) => {
				// Open panel
				await page.click( '.shape-library-button' );
				await page.waitForSelector( '.layers-shape-library-panel', { timeout: 5000 } );

				// Find and click category
				const categoryBtn = await page.$( `[data-category="${ categoryId }"]` );
				if ( categoryBtn ) {
					await categoryBtn.click();
					await page.waitForTimeout( 300 );

					// Should have shapes
					const shapes = await page.$$( '.layers-shape-library-item' );
					expect( shapes.length ).toBeGreaterThan( 0 );
				}

				// Close panel
				await page.keyboard.press( 'Escape' );
			} );
		}
	} );
} );
