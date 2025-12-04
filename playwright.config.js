/* eslint-env node */
// Playwright config for the Layers extension tests
// Minimal configuration for smoke tests
module.exports = {
	use: {
		browserName: 'chromium',
		headless: true,
		ignoreHTTPSErrors: true,
		viewport: { width: 1280, height: 720 }
	},
	reporter: [['list'], ['github']]
};
