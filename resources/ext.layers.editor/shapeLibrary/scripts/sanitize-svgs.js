#!/usr/bin/env node
/**
 * SVG Sanitization Script for Layers Extension
 * 
 * Cleans up SVG files by:
 * - Removing XML declarations
 * - Removing comments
 * - Removing DOCTYPE declarations
 * - Removing Inkscape/Sodipodi namespaces and metadata
 * - Keeping only the <svg>...</svg> content
 * - Preserving essential attributes (viewBox, width, height, xmlns)
 * 
 * Usage: node sanitize-svgs.js
 */

const fs = require( 'fs' );
const path = require( 'path' );

const ASSETS_DIR = path.join( __dirname, '../assets' );

/**
 * Sanitize SVG content by extracting only the essential SVG markup
 * 
 * @param {string} content - Raw SVG file content
 * @return {string|null} - Cleaned SVG or null if invalid
 */
function sanitizeSVG( content ) {
	// Remove XML declaration
	content = content.replace( /<\?xml[^?]*\?>\s*/gi, '' );

	// Remove comments
	content = content.replace( /<!--[\s\S]*?-->/g, '' );

	// Remove DOCTYPE
	content = content.replace( /<!DOCTYPE[^>]*>/gi, '' );

	// Find the svg tag and its content
	const svgMatch = content.match( /<svg[\s\S]*<\/svg>/i );
	if ( !svgMatch ) {
		return null; // Invalid SVG
	}

	let svg = svgMatch[ 0 ];

	// Remove Inkscape/Sodipodi/RDF namespaces from opening tag
	svg = svg.replace( /\s*xmlns:(inkscape|sodipodi|dc|cc|rdf)="[^"]*"/gi, '' );

	// Remove Inkscape/Sodipodi attributes
	svg = svg.replace( /\s*(inkscape|sodipodi):[a-z-]+="[^"]*"/gi, '' );

	// Remove sodipodi:namedview elements entirely
	svg = svg.replace( /<sodipodi:namedview[\s\S]*?\/>/gi, '' );
	svg = svg.replace( /<sodipodi:namedview[\s\S]*?<\/sodipodi:namedview>/gi, '' );

	// Remove metadata elements
	svg = svg.replace( /<metadata[\s\S]*?<\/metadata>/gi, '' );

	// Remove RDF elements
	svg = svg.replace( /<rdf:RDF[\s\S]*?<\/rdf:RDF>/gi, '' );

	// Remove empty defs
	svg = svg.replace( /<defs\s*id="[^"]*"\s*\/>/gi, '' );
	svg = svg.replace( /<defs\s*\/>/gi, '' );
	svg = svg.replace( /<defs\s*>\s*<\/defs>/gi, '' );
	svg = svg.replace( /<defs\s+id="[^"]*"\s*>\s*<\/defs>/gi, '' );

	// Remove inkscape:label and inkscape:groupmode attributes from g elements
	svg = svg.replace( /\s*inkscape:[a-z-]+="[^"]*"/gi, '' );

	// Remove empty id attributes that are just whitespace
	svg = svg.replace( /\s*id=""\s*/gi, ' ' );

	// Clean up excessive whitespace between tags
	svg = svg.replace( />\s+</g, '><' );

	// Clean up whitespace within tags
	svg = svg.replace( /\s+/g, ' ' );

	// Fix spacing around attributes
	svg = svg.replace( /\s+>/g, '>' );
	svg = svg.replace( /\s+\/>/g, '/>' );

	// Ensure xmlns is present
	if ( !svg.includes( 'xmlns="http://www.w3.org/2000/svg"' ) ) {
		svg = svg.replace( '<svg', '<svg xmlns="http://www.w3.org/2000/svg"' );
	}

	// Remove duplicate xmlns:svg
	svg = svg.replace( /\s*xmlns:svg="[^"]*"/gi, '' );

	return svg.trim();
}

/**
 * Process all SVG files in a directory recursively
 * 
 * @param {string} dir - Directory path
 * @return {Object} - Results with processed count and errors
 */
function processDirectory( dir ) {
	const files = fs.readdirSync( dir );
	let processed = 0;
	let skipped = 0;
	let errors = [];
	let sizeSaved = 0;

	for ( const file of files ) {
		const fullPath = path.join( dir, file );
		const stat = fs.statSync( fullPath );

		if ( stat.isDirectory() ) {
			const result = processDirectory( fullPath );
			processed += result.processed;
			skipped += result.skipped;
			errors = errors.concat( result.errors );
			sizeSaved += result.sizeSaved;
		} else if ( file.endsWith( '.svg' ) ) {
			try {
				const originalContent = fs.readFileSync( fullPath, 'utf8' );
				const originalSize = Buffer.byteLength( originalContent, 'utf8' );

				const sanitized = sanitizeSVG( originalContent );

				if ( sanitized ) {
					const newSize = Buffer.byteLength( sanitized, 'utf8' );
					const saved = originalSize - newSize;

					if ( saved > 0 ) {
						fs.writeFileSync( fullPath, sanitized );
						sizeSaved += saved;
						processed++;
						const relativePath = path.relative( ASSETS_DIR, fullPath );
						console.log( `✓ ${relativePath} (saved ${saved} bytes)` );
					} else {
						skipped++;
					}
				} else {
					errors.push( { file: path.relative( ASSETS_DIR, fullPath ), error: 'Invalid SVG structure' } );
				}
			} catch ( e ) {
				errors.push( { file: path.relative( ASSETS_DIR, fullPath ), error: e.message } );
			}
		}
	}

	return { processed, skipped, errors, sizeSaved };
}

// Main execution
console.log( 'SVG Sanitization Script for Layers Extension' );
console.log( '============================================\n' );
console.log( `Processing directory: ${ASSETS_DIR}\n` );

const result = processDirectory( ASSETS_DIR );

console.log( '\n============================================' );
console.log( `Processed: ${result.processed} files` );
console.log( `Skipped (already clean): ${result.skipped} files` );
console.log( `Total size saved: ${( result.sizeSaved / 1024 ).toFixed( 2 )} KB` );

if ( result.errors.length > 0 ) {
	console.log( '\nErrors:' );
	result.errors.forEach( ( e ) => console.log( `  ✗ ${e.file}: ${e.error}` ) );
}

console.log( '\nDone!' );
