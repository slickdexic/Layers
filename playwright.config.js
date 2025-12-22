/* eslint-env node */
// Playwright config for the Layers extension E2E tests
// See: https://playwright.dev/docs/test-configuration

const { defineConfig, devices } = require( '@playwright/test' );

module.exports = defineConfig( {
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	// Use multiple reporters in CI to get both console output and HTML report
	reporter: process.env.CI ?
		[ [ 'github' ], [ 'html', { open: 'never' } ] ] :
		'list',
	// Output directory for test results and traces
	outputDir: 'test-results',
	
	// Global timeout for each test
	timeout: 30000,
	
	// Expect timeout
	expect: {
		timeout: 5000
	},

	use: {
		// Base URL for the MediaWiki instance
		baseURL: process.env.MW_SERVER || 'http://localhost:8080',
		
		// Collect trace when retrying the failed test
		trace: 'on-first-retry',
		
		// Screenshot on failure
		screenshot: 'only-on-failure',
		
		// Video on failure in CI
		video: process.env.CI ? 'retain-on-failure' : 'off',
		
		ignoreHTTPSErrors: true
	},

	projects: [
		{
			name: 'chromium',
			use: {
				...devices[ 'Desktop Chrome' ],
				// Larger viewport to ensure toolbar buttons are visible
				viewport: { width: 1920, height: 1080 }
			}
		}
		// Can add more browsers:
		// { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
		// { name: 'webkit', use: { ...devices['Desktop Safari'] } },
	]
} );
