#!/usr/bin/env node
/**
 * Version Update Script for Layers Extension
 *
 * This script ensures version consistency across all project files.
 * It reads the version from extension.json (source of truth) and updates
 * all other files that contain version references.
 *
 * Usage:
 *   node scripts/update-version.js           # Update all files to match extension.json
 *   node scripts/update-version.js --check   # Check for inconsistencies (CI mode)
 *   node scripts/update-version.js --set 1.5.36  # Set a new version everywhere
 *
 * Files updated:
 *   - extension.json (source of truth)
 *   - resources/ext.layers.editor/LayersNamespace.js
 *   - README.md
 *   - Mediawiki-Extension-Layers.mediawiki
 *   - wiki/Home.md
 *   - wiki/Installation.md
 *   - improvement_plan.md
 *
 * @author Layers Extension Team
 * @since 1.5.35
 */

const fs = require( 'fs' );
const path = require( 'path' );

// Configuration: files and their version patterns
const VERSION_FILES = [
	{
		file: 'extension.json',
		pattern: /"version":\s*"(\d+\.\d+\.\d+)"/,
		replacement: ( version ) => `"version": "${ version }"`,
		isSource: true
	},
	{
		file: 'resources/ext.layers.editor/LayersNamespace.js',
		pattern: /const VERSION = '(\d+\.\d+\.\d+)'/,
		replacement: ( version ) => `const VERSION = '${ version }'`
	},
	{
		file: 'README.md',
		pattern: /> \*\*Version:\*\* (\d+\.\d+\.\d+)/,
		replacement: ( version ) => `> **Version:** ${ version }`
	},
	{
		file: 'Mediawiki-Extension-Layers.mediawiki',
		pattern: /\|version\s*=\s*(\d+\.\d+\.\d+)/,
		replacement: ( version ) => `|version         = ${ version }`
	},
	{
		file: 'wiki/Home.md',
		pattern: /\*\*Version \(main\)\*\*\s*\|\s*(\d+\.\d+\.\d+)/,
		replacement: ( version ) => `**Version (main)** | ${ version }`
	},
	{
		file: 'wiki/Installation.md',
		pattern: /\| 1\.44\+ \| `main` \| (\d+\.\d+\.\d+)/,
		replacement: ( version ) => `| 1.44+ | \`main\` | ${ version }`
	},
	{
		file: 'improvement_plan.md',
		pattern: /\*\*Version:\*\*\s*(\d+\.\d+\.\d+)/,
		replacement: ( version ) => `**Version:** ${ version }`
	}
];

/**
 * Get the project root directory
 * @return {string}
 */
function getProjectRoot() {
	return path.resolve( __dirname, '..' );
}

/**
 * Read the source version from extension.json
 * @return {string} The version string
 */
function getSourceVersion() {
	const extensionPath = path.join( getProjectRoot(), 'extension.json' );
	const content = fs.readFileSync( extensionPath, 'utf8' );
	const match = content.match( /"version":\s*"(\d+\.\d+\.\d+)"/ );

	if ( !match ) {
		console.error( 'ERROR: Could not find version in extension.json' );
		process.exit( 1 );
	}

	return match[ 1 ];
}

/**
 * Check version in a single file
 * @param {Object} config File configuration
 * @param {string} expectedVersion Expected version
 * @return {Object} Result with found version and status
 */
function checkFileVersion( config, expectedVersion ) {
	const filePath = path.join( getProjectRoot(), config.file );

	if ( !fs.existsSync( filePath ) ) {
		return { file: config.file, status: 'missing', found: null };
	}

	const content = fs.readFileSync( filePath, 'utf8' );
	const match = content.match( config.pattern );

	if ( !match ) {
		return { file: config.file, status: 'no-match', found: null };
	}

	const foundVersion = match[ 1 ];
	const status = foundVersion === expectedVersion ? 'ok' : 'mismatch';

	return { file: config.file, status, found: foundVersion, expected: expectedVersion };
}

/**
 * Update version in a single file
 * @param {Object} config File configuration
 * @param {string} newVersion New version to set
 * @return {boolean} Success status
 */
function updateFileVersion( config, newVersion ) {
	const filePath = path.join( getProjectRoot(), config.file );

	if ( !fs.existsSync( filePath ) ) {
		console.log( `  ⚠️  ${ config.file } - FILE NOT FOUND` );
		return false;
	}

	let content = fs.readFileSync( filePath, 'utf8' );
	const match = content.match( config.pattern );

	if ( !match ) {
		console.log( `  ⚠️  ${ config.file } - PATTERN NOT FOUND` );
		return false;
	}

	const oldVersion = match[ 1 ];
	if ( oldVersion === newVersion ) {
		console.log( `  ✓  ${ config.file } - already at ${ newVersion }` );
		return true;
	}

	content = content.replace( config.pattern, config.replacement( newVersion ) );
	fs.writeFileSync( filePath, content, 'utf8' );
	console.log( `  ✓  ${ config.file } - updated ${ oldVersion } → ${ newVersion }` );
	return true;
}

/**
 * Check all files for version consistency
 * @return {boolean} True if all versions match
 */
function checkVersions() {
	const sourceVersion = getSourceVersion();
	console.log( `\nSource version (extension.json): ${ sourceVersion }\n` );
	console.log( 'Checking version consistency...\n' );

	let allMatch = true;

	for ( const config of VERSION_FILES ) {
		if ( config.isSource ) {
			continue;
		}

		const result = checkFileVersion( config, sourceVersion );

		switch ( result.status ) {
			case 'ok':
				console.log( `  ✓  ${ result.file } - ${ result.found }` );
				break;
			case 'mismatch':
				console.log( `  ✗  ${ result.file } - ${ result.found } (expected ${ result.expected })` );
				allMatch = false;
				break;
			case 'missing':
				console.log( `  ⚠️  ${ result.file } - FILE NOT FOUND` );
				break;
			case 'no-match':
				console.log( `  ⚠️  ${ result.file } - PATTERN NOT FOUND` );
				break;
		}
	}

	console.log( '' );

	if ( allMatch ) {
		console.log( '✅ All versions are consistent!' );
		return true;
	} else {
		console.log( '❌ Version inconsistencies found!' );
		console.log( 'Run "node scripts/update-version.js" to fix.' );
		return false;
	}
}

/**
 * Update all files to match the source version or a specified version
 * @param {string|null} newVersion Optional new version to set
 */
function updateVersions( newVersion = null ) {
	const sourceVersion = getSourceVersion();
	const targetVersion = newVersion || sourceVersion;

	console.log( `\nUpdating all files to version ${ targetVersion }...\n` );

	// If setting a new version, update extension.json first
	if ( newVersion && newVersion !== sourceVersion ) {
		const sourceConfig = VERSION_FILES.find( ( c ) => c.isSource );
		updateFileVersion( sourceConfig, newVersion );
	}

	// Update all other files
	for ( const config of VERSION_FILES ) {
		if ( config.isSource && !newVersion ) {
			continue;
		}
		if ( config.isSource ) {
			continue;
		}
		updateFileVersion( config, targetVersion );
	}

	console.log( '\n✅ Version update complete!' );
}

/**
 * Print usage information
 */
function printUsage() {
	console.log( `
Layers Extension Version Update Script

Usage:
  node scripts/update-version.js           Update all files to match extension.json
  node scripts/update-version.js --check   Check for version inconsistencies (CI mode)
  node scripts/update-version.js --set X   Set version X in all files

Examples:
  node scripts/update-version.js --check
  node scripts/update-version.js --set 1.5.36
` );
}

// Main execution
const args = process.argv.slice( 2 );

if ( args.includes( '--help' ) || args.includes( '-h' ) ) {
	printUsage();
	process.exit( 0 );
}

if ( args.includes( '--check' ) ) {
	const success = checkVersions();
	process.exit( success ? 0 : 1 );
}

if ( args.includes( '--set' ) ) {
	const setIndex = args.indexOf( '--set' );
	const newVersion = args[ setIndex + 1 ];

	if ( !newVersion || !/^\d+\.\d+\.\d+$/.test( newVersion ) ) {
		console.error( 'ERROR: Invalid version format. Use X.Y.Z (e.g., 1.5.36)' );
		process.exit( 1 );
	}

	updateVersions( newVersion );
	process.exit( 0 );
}

// Default: sync all files to extension.json version
updateVersions();
