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

	// Coverage configuration - track ALL source files
	collectCoverageFrom: [
		'resources/ext.layers/**/*.js',
		'resources/ext.layers.editor/**/*.js',
		'resources/ext.layers.shared/**/*.js',
		'resources/ext.layers.modal/**/*.js',
		'resources/ext.layers.slides/**/*.js',
		'!**/*.min.js',
		'!**/node_modules/**',
		'!**/vendor/**',
		// Exclude generated data files (large, auto-generated, not hand-written code)
		'!**/shapeLibrary/ShapeLibraryData.js',
		'!**/shapeLibrary/EmojiLibraryIndex.js',
		// Exclude build scripts (Node.js tools, not browser code)
		'!**/shapeLibrary/scripts/**'
	],

	// Coverage thresholds - protect against regression
	// Current coverage (Jan 2026): 94.19% statements, 84.43% branches, 92.19% functions, 94.32% lines
	// These thresholds ensure we don't regress from current quality levels
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 90,
			lines: 92,
			statements: 92
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
		'/tests/phpunit/',
		'/archive/'
	],

	// Project-specific configurations
	// Performance tests run sequentially to get reliable timing
	projects: [
		{
			displayName: 'unit',
			testMatch: [
				'<rootDir>/tests/jest/**/*.test.js',
				'!<rootDir>/tests/jest/performance/**',
				'!<rootDir>/tests/jest/archive/**'
			],
			testPathIgnorePatterns: [
				'/node_modules/',
				'/vendor/',
				'/archive/'
			],
			testEnvironment: 'jsdom',
			setupFilesAfterEnv: [ '<rootDir>/tests/jest/setup.js' ]
		},
		{
			displayName: 'performance',
			testMatch: [ '<rootDir>/tests/jest/performance/**/*.test.js' ],
			testEnvironment: 'node',
			// Run performance tests sequentially for reliable measurements
			maxWorkers: 1
		}
	],

	// Verbose output
	verbose: true,

	// Clear mocks between tests
	clearMocks: true
};
