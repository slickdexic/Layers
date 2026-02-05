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
const { execSync } = require( 'child_process' );

// MediaWiki version requirements by branch
const MW_VERSION_REQUIREMENTS = {
	main: '>= 1.44.0',
	REL1_43: '>= 1.43.0',
	REL1_39: '>= 1.39.0'
};

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
 * @return {string} The version string (base version without branch suffix)
 */
function getSourceVersion() {
	const extensionPath = path.join( getProjectRoot(), 'extension.json' );
	const content = fs.readFileSync( extensionPath, 'utf8' );
	// Match version with optional branch suffix (e.g., "1.5.51" or "1.5.51-REL1_39")
	const match = content.match( /"version":\s*"(\d+\.\d+\.\d+)(?:-[A-Za-z0-9_]+)?"/ );

	if ( !match ) {
		console.error( 'ERROR: Could not find version in extension.json' );
		process.exit( 1 );
	}

	return match[ 1 ];
}

/**
 * Get the current git branch name
 * @return {string|null} Branch name or null if not in a git repo
 */
function getCurrentBranch() {
	try {
		const branch = execSync( 'git rev-parse --abbrev-ref HEAD', {
			encoding: 'utf8',
			cwd: getProjectRoot(),
			stdio: [ 'pipe', 'pipe', 'pipe' ]
		} ).trim();
		return branch;
	} catch {
		return null;
	}
}

/**
 * Get the MediaWiki version requirement from extension.json
 * @return {string|null} The MW version requirement string
 */
function getMWVersionRequirement() {
	const extensionPath = path.join( getProjectRoot(), 'extension.json' );
	const content = fs.readFileSync( extensionPath, 'utf8' );
	const match = content.match( /"MediaWiki":\s*"([^"]+)"/ );
	return match ? match[ 1 ] : null;
}

/**
 * Check that MediaWiki version requirement matches the current branch
 * @return {Object} Result with status and details
 */
function checkMWVersionRequirement() {
	const branch = getCurrentBranch();

	if ( !branch ) {
		return { status: 'skip', message: 'Not in a git repository' };
	}

	const expectedRequirement = MW_VERSION_REQUIREMENTS[ branch ];

	if ( !expectedRequirement ) {
		// Not a tracked branch (feature branch, etc.) - skip check
		return { status: 'skip', message: `Branch '${ branch }' is not a release branch` };
	}

	const actualRequirement = getMWVersionRequirement();

	if ( !actualRequirement ) {
		return { status: 'error', message: 'Could not read MW requirement from extension.json' };
	}

	if ( actualRequirement === expectedRequirement ) {
		return {
			status: 'ok',
			branch,
			requirement: actualRequirement
		};
	}

	return {
		status: 'mismatch',
		branch,
		expected: expectedRequirement,
		actual: actualRequirement
	};
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
	const branch = getCurrentBranch();
	const isReleaseBranch = branch && branch.startsWith( 'REL' );

	console.log( `\nSource version (extension.json): ${ sourceVersion }\n` );

	// Check MediaWiki version requirement matches branch
	console.log( 'Checking MediaWiki version requirement...\n' );
	const mwCheck = checkMWVersionRequirement();

	let allMatch = true;

	switch ( mwCheck.status ) {
		case 'ok':
			console.log( `  ✓  Branch '${ mwCheck.branch }' requires MW ${ mwCheck.requirement }` );
			break;
		case 'mismatch':
			console.log( `  ✗  Branch '${ mwCheck.branch }' has MW "${ mwCheck.actual }" but should have "${ mwCheck.expected }"` );
			console.log( `      Fix: Update extension.json "requires.MediaWiki" to "${ mwCheck.expected }"` );
			allMatch = false;
			break;
		case 'skip':
			console.log( `  ⚠️  ${ mwCheck.message } - skipping MW version check` );
			break;
		case 'error':
			console.log( `  ⚠️  ${ mwCheck.message }` );
			break;
	}

	// Skip version consistency checks on REL branches (they have version suffixes)
	if ( isReleaseBranch ) {
		console.log( '\nSkipping version file consistency check on release branch.\n' );
		console.log( '(Release branches use version suffixes like 1.5.51-REL1_39)\n' );
	} else {
		console.log( '\nChecking version consistency...\n' );

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
	}

	console.log( '' );

	if ( allMatch ) {
		console.log( '✅ All versions are consistent!' );
		return true;
	} else {
		console.log( '❌ Version inconsistencies found!' );
		if ( mwCheck.status === 'mismatch' ) {
			console.log( `Fix extension.json "requires.MediaWiki" to "${ mwCheck.expected }"` );
		} else {
			console.log( 'Run "node scripts/update-version.js" to fix.' );
		}
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
