/* eslint-env node */
const { test, expect } = require( '@playwright/test' );

// Basic smoke test to confirm Playwright + environment run in CI
// This is a small proof-of-concept test; future tests will load the MediaWiki instance

test.describe( 'Smoke tests', () => {
	test( 'can open about:blank and run a basic assertion', async ( { page } ) => {
		await page.goto( 'about:blank' );
		const title = await page.title();
		// about:blank has empty title, ensure page is reachable
		expect( title ).toBe( '' );
	} );
} );
