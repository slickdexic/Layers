module.exports = {
	// Test environment - JSDOM for DOM testing
	testEnvironment: 'jsdom',

	// Root directory for tests
	roots: [ '<rootDir>/tests/jest' ],

	// File patterns for test files
	testMatch: [
		'**/__tests__/**/*.js',
		'**/*.test.js',
		'**/*.spec.js'
	],

	// Setup files to run after environment setup
	setupFilesAfterEnv: [ '<rootDir>/tests/jest/setup.js' ],

	// Coverage configuration
	collectCoverageFrom: [
		'resources/ext.layers.editor/*.js',
		'!resources/ext.layers.editor/*.min.js',
		'!**/node_modules/**',
		'!**/vendor/**'
	],

	// Coverage thresholds
	coverageThreshold: {
		global: {
			branches: 70,
			functions: 70,
			lines: 70,
			statements: 70
		}
	},

	// Module name mapping for MediaWiki environment
	moduleNameMapper: {
		'^mw$': '<rootDir>/tests/jest/mocks/mediawiki.js',
		'^jquery$': '<rootDir>/tests/jest/mocks/jquery.js'
	},

	// Transform configuration for modern JavaScript
	transform: {
		'^.+\\.js$': [ 'babel-jest', {
			presets: [ [ '@babel/preset-env', {
				targets: { node: 'current' }
			} ] ]
		} ]
	},

	// Ignore patterns
	testPathIgnorePatterns: [
		'/node_modules/',
		'/vendor/',
		'/tests/phpunit/'
	],

	// Verbose output
	verbose: true,

	// Clear mocks between tests
	clearMocks: true
};
