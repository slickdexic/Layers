#!/usr/bin/env node
/**
 * MediaWiki Compatibility Checker for Layers Extension
 * 
 * Scans PHP files for known compatibility issues between MW versions.
 * Run this BEFORE merging main into REL branches.
 * 
 * Usage:
 *   node scripts/check-mw-compatibility.js
 *   node scripts/check-mw-compatibility.js --fix  (future: auto-fix known issues)
 * 
 * @since 1.5.51
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Known compatibility issues between MW versions
const COMPATIBILITY_RULES = [
	{
		id: 'ILoadBalancer',
		description: 'Use ILoadBalancer interface instead of LoadBalancer class',
		severity: 'error',
		pattern: /use Wikimedia\\Rdbms\\LoadBalancer;/,
		fix: 'use Wikimedia\\Rdbms\\ILoadBalancer;',
		explanation: 'MediaWikiServices::getDBLoadBalancer() returns ILoadBalancer interface in MW 1.39+',
		affectedVersions: ['1.39', '1.40', '1.41', '1.42', '1.43']
	},
	{
		id: 'LoadBalancer-typehint',
		description: 'Type hint should use ILoadBalancer, not LoadBalancer',
		severity: 'error',
		pattern: /[^I]LoadBalancer \$loadBalancer/,
		fix: 'ILoadBalancer $loadBalancer',
		explanation: 'Constructor type hints must match the interface returned by MediaWikiServices',
		affectedVersions: ['1.39', '1.40', '1.41', '1.42', '1.43']
	},
	{
		id: 'LoadBalancer-docblock',
		description: 'DocBlock should reference ILoadBalancer',
		severity: 'warning',
		pattern: /@var [^I]LoadBalancer\b/,
		fix: '@var ILoadBalancer',
		explanation: 'Documentation should match actual interface type',
		affectedVersions: ['1.39', '1.40', '1.41', '1.42', '1.43']
	},
	{
		id: 'getMainConfig-deprecated',
		description: 'Check for deprecated Config access patterns',
		severity: 'warning',
		pattern: /\$wgConfig\b/,
		explanation: 'Use dependency injection or MediaWikiServices::getMainConfig()',
		affectedVersions: ['1.39', '1.40', '1.41', '1.42', '1.43', '1.44']
	},
	{
		id: 'Title-newFromText',
		description: 'Title::newFromText may return null',
		severity: 'warning', 
		pattern: /Title::newFromText\([^)]+\)->/,
		explanation: 'Title::newFromText() can return null, check before calling methods',
		affectedVersions: ['1.39', '1.40', '1.41', '1.42', '1.43', '1.44']
	}
];

/**
 * Get all PHP files in src/ directory
 */
function getPhpFiles(dir) {
	const files = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...getPhpFiles(fullPath));
		} else if (entry.name.endsWith('.php')) {
			files.push(fullPath);
		}
	}
	
	return files;
}

/**
 * Check a single file for compatibility issues
 */
function checkFile(filePath, rules) {
	const content = fs.readFileSync(filePath, 'utf8');
	const issues = [];
	const lines = content.split('\n');
	
	for (const rule of rules) {
		for (let i = 0; i < lines.length; i++) {
			if (rule.pattern.test(lines[i])) {
				issues.push({
					file: filePath,
					line: i + 1,
					rule: rule.id,
					severity: rule.severity,
					description: rule.description,
					explanation: rule.explanation,
					match: lines[i].trim()
				});
			}
		}
	}
	
	return issues;
}

/**
 * Get current git branch
 */
function getCurrentBranch() {
	try {
		return execSync('git rev-parse --abbrev-ref HEAD', { 
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe']
		}).trim();
	} catch {
		return null;
	}
}

/**
 * Main execution
 */
function main() {
	const projectRoot = path.resolve(__dirname, '..');
	const srcDir = path.join(projectRoot, 'src');
	const branch = getCurrentBranch();
	
	console.log('\n🔍 MediaWiki Compatibility Checker');
	console.log('===================================\n');
	
	if (branch) {
		console.log(`Current branch: ${branch}`);
		if (branch.startsWith('REL')) {
			console.log('⚠️  On a release branch - compatibility is critical!\n');
		}
	}
	
	const phpFiles = getPhpFiles(srcDir);
	console.log(`Scanning ${phpFiles.length} PHP files...\n`);
	
	let errorCount = 0;
	let warningCount = 0;
	const allIssues = [];
	
	for (const file of phpFiles) {
		const issues = checkFile(file, COMPATIBILITY_RULES);
		allIssues.push(...issues);
		
		for (const issue of issues) {
			if (issue.severity === 'error') {
				errorCount++;
			} else {
				warningCount++;
			}
		}
	}
	
	// Group issues by file
	const byFile = {};
	for (const issue of allIssues) {
		const relPath = path.relative(projectRoot, issue.file);
		if (!byFile[relPath]) {
			byFile[relPath] = [];
		}
		byFile[relPath].push(issue);
	}
	
	// Output results
	for (const [file, issues] of Object.entries(byFile)) {
		console.log(`\n📄 ${file}`);
		for (const issue of issues) {
			const icon = issue.severity === 'error' ? '❌' : '⚠️';
			console.log(`   ${icon} Line ${issue.line}: ${issue.description}`);
			console.log(`      ${issue.match}`);
			console.log(`      → ${issue.explanation}`);
		}
	}
	
	console.log('\n-----------------------------------');
	console.log(`Results: ${errorCount} errors, ${warningCount} warnings`);
	
	if (errorCount > 0) {
		console.log('\n❌ Compatibility check FAILED');
		console.log('Fix errors before merging to release branches.\n');
		process.exit(1);
	} else if (warningCount > 0) {
		console.log('\n⚠️  Compatibility check passed with warnings');
		console.log('Review warnings before merging.\n');
		process.exit(0);
	} else {
		console.log('\n✅ All compatibility checks passed!\n');
		process.exit(0);
	}
}

main();
