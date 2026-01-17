#!/usr/bin/env node
/**
 * Generate ShapeLibraryData.js from SVG assets
 * 
 * This script scans the assets directory and generates a JavaScript module
 * containing all SVG shapes organized by category with metadata.
 * 
 * Usage: node generate-library.js
 */

const fs = require( 'fs' );
const path = require( 'path' );

const ASSETS_DIR = path.join( __dirname, '../assets' );
const OUTPUT_FILE = path.join( __dirname, '../ShapeLibraryData.js' );

/**
 * Extract viewBox from SVG string
 * 
 * @param {string} svg - SVG content
 * @return {number[]|null} - [x, y, width, height] or null
 */
function extractViewBox( svg ) {
	// Try viewBox attribute first
	const viewBoxMatch = svg.match( /viewBox=["']([^"']+)["']/ );
	if ( viewBoxMatch ) {
		const parts = viewBoxMatch[ 1 ].trim().split( /[\s,]+/ ).map( Number );
		if ( parts.length === 4 && parts.every( ( n ) => !isNaN( n ) ) ) {
			return parts;
		}
	}

	// Fall back to width/height attributes
	const widthMatch = svg.match( /width=["'](\d+(?:\.\d+)?)(?:px)?["']/ );
	const heightMatch = svg.match( /height=["'](\d+(?:\.\d+)?)(?:px)?["']/ );
	if ( widthMatch && heightMatch ) {
		return [ 0, 0, parseFloat( widthMatch[ 1 ] ), parseFloat( heightMatch[ 1 ] ) ];
	}

	// Default viewBox
	return [ 0, 0, 100, 100 ];
}

/**
 * Generate a readable name from filename
 * 
 * @param {string} filename - SVG filename
 * @return {string} - Human-readable name
 */
function generateName( filename ) {
	// Remove extension
	let name = filename.replace( /\.svg$/i, '' );

	// Extract description from filename patterns like:
	// ISO_7010_W001.svg -> "W001"
	// ISO_7010_W033_warning;_barbed_wire.svg -> "W033: Barbed Wire"
	// ANSI_Z535_-_Figure_A17,_Poison.svg -> "Poison"
	// ISO_7000_-_Ref-No_0001.svg -> "0001"
	// GHS-pictogram-acid.svg -> "Acid"
	// ECB_Hazard_Symbol_C.svg -> "C"

	// Handle ISO 7010 patterns
	const isoMatch = name.match( /ISO_7010_([A-Z])(\d+)(?:[_;,]+(.+))?/ );
	if ( isoMatch ) {
		const code = isoMatch[ 1 ] + isoMatch[ 2 ];
		const description = isoMatch[ 3 ];
		if ( description ) {
			// Clean up description
			let desc = description
				.replace( /^(warning|mandatory|prohibition|emergency|fire)[_;,]+/i, '' )
				.replace( /_/g, ' ' )
				.replace( /;/g, '' )
				.replace( /\s+/g, ' ' )
				.trim();
			// Capitalize first letter of each word
			desc = desc.replace( /\b\w/g, ( c ) => c.toUpperCase() );
			return `${ code }: ${ desc }`;
		}
		return code;
	}

	// Handle ISO 7000 patterns: ISO_7000_-_Ref-No_0001.svg
	const iso7000Match = name.match( /ISO_7000_-_Ref-No_(\d+[A-Z]?)/ );
	if ( iso7000Match ) {
		return iso7000Match[ 1 ];
	}

	// Handle GHS patterns: GHS-pictogram-acid.svg
	const ghsMatch = name.match( /GHS-pictogram-(.+)/i );
	if ( ghsMatch ) {
		return ghsMatch[ 1 ]
			.replace( /-/g, ' ' )
			.replace( /\b\w/g, ( c ) => c.toUpperCase() );
	}

	// Handle ECB patterns: ECB_Hazard_Symbol_C.svg
	const ecbMatch = name.match( /ECB_Hazard_Symbol_(.+)/i );
	if ( ecbMatch ) {
		return ecbMatch[ 1 ];
	}

	// Handle ANSI patterns
	const ansiMatch = name.match( /ANSI_Z535[^,]*,\s*(.+)$/i );
	if ( ansiMatch ) {
		return ansiMatch[ 1 ]
			.replace( /_/g, ' ' )
			.replace( /\s+/g, ' ' )
			.trim()
			.replace( /\b\w/g, ( c ) => c.toUpperCase() );
	}

	// Generic cleanup
	return name
		.replace( /^ISO_7010_|^ANSI_Z535[^_]*_/i, '' )
		.replace( /_/g, ' ' )
		.replace( /\s+/g, ' ' )
		.trim();
}

/**
 * Generate search tags from name and filename
 * 
 * @param {string} name - Shape name
 * @param {string} filename - Original filename
 * @param {string} category - Category ID
 * @return {string[]} - Array of search tags
 */
function generateTags( name, filename, category ) {
	const tags = new Set();

	// Add category-based tags
	const categoryTags = {
		'iso7010-e': [ 'emergency', 'escape', 'safety', 'green', 'exit' ],
		'iso7010-f': [ 'fire', 'protection', 'red', 'extinguisher', 'alarm' ],
		'iso7010-m': [ 'mandatory', 'required', 'blue', 'must', 'wear' ],
		'iso7010-p': [ 'prohibition', 'forbidden', 'no', 'red', 'banned' ],
		'iso7010-w': [ 'warning', 'danger', 'caution', 'yellow', 'hazard' ],
		iso7000: [ 'symbol', 'equipment', 'industrial', 'graphical', 'iso' ],
		ghs: [ 'hazard', 'chemical', 'danger', 'ghs', 'pictogram', 'classification' ],
		ecb: [ 'hazard', 'chemical', 'european', 'danger', 'warning' ],
		ansi: [ 'safety', 'hazard', 'warning', 'american', 'osha' ]
	};

	if ( categoryTags[ category ] ) {
		categoryTags[ category ].forEach( ( t ) => tags.add( t ) );
	}

	// Extract words from name
	name.toLowerCase().split( /[\s:,]+/ ).forEach( ( word ) => {
		if ( word.length > 2 ) {
			tags.add( word );
		}
	} );

	// Extract code number
	const codeMatch = filename.match( /([EFMPW])(\d+)/ );
	if ( codeMatch ) {
		tags.add( codeMatch[ 1 ].toLowerCase() + codeMatch[ 2 ] );
		tags.add( codeMatch[ 2 ] );
	}

	return Array.from( tags );
}

/**
 * Get category info from directory path
 * 
 * @param {string} dir - Directory path relative to assets
 * @return {Object} - Category info { id, name, prefix }
 */
function getCategoryInfo( dir ) {
	const categories = {
		'iso/iso_7010/E': {
			id: 'iso7010-e',
			name: 'ISO 7010 Emergency/Escape',
			prefix: 'E',
			color: '#008855',
			description: 'Green square signs for emergency and escape routes'
		},
		'iso/iso_7010/F': {
			id: 'iso7010-f',
			name: 'ISO 7010 Fire Protection',
			prefix: 'F',
			color: '#a92121',
			description: 'Red square signs for fire protection equipment'
		},
		'iso/iso_7010/M': {
			id: 'iso7010-m',
			name: 'ISO 7010 Mandatory',
			prefix: 'M',
			color: '#24578e',
			description: 'Blue circle signs for mandatory actions'
		},
		'iso/iso_7010/P': {
			id: 'iso7010-p',
			name: 'ISO 7010 Prohibition',
			prefix: 'P',
			color: '#b71f2e',
			description: 'Red circle with slash for prohibited actions'
		},
		'iso/iso_7010/W': {
			id: 'iso7010-w',
			name: 'ISO 7010 Warning',
			prefix: 'W',
			color: '#F9A800',
			description: 'Yellow triangle signs for warnings and hazards'
		},
		'iso/iso_7000': {
			id: 'iso7000',
			name: 'ISO 7000 Symbols',
			prefix: 'ISO7000',
			color: '#333333',
			description: 'ISO 7000 graphical symbols for use on equipment'
		},
		ghs: {
			id: 'ghs',
			name: 'GHS Hazard',
			prefix: 'GHS',
			color: '#CC0000',
			description: 'Globally Harmonized System of Classification and Labelling of Chemicals pictograms'
		},
		ecb: {
			id: 'ecb',
			name: 'ECB Hazard',
			prefix: 'ECB',
			color: '#FF6600',
			description: 'European hazard symbols for chemical classification'
		},
		ansi: {
			id: 'ansi',
			name: 'ANSI Z535 Safety',
			prefix: 'ANSI',
			color: '#000000',
			description: 'American National Standards Institute safety symbols'
		}
	};

	return categories[ dir ] || { id: 'other', name: 'Other', prefix: '' };
}

/**
 * Escape string for JavaScript
 * 
 * @param {string} str - String to escape
 * @return {string} - Escaped string
 */
function escapeJS( str ) {
	return str
		.replace( /\\/g, '\\\\' )
		.replace( /'/g, "\\'" )
		.replace( /\n/g, '\\n' )
		.replace( /\r/g, '' );
}

/**
 * Process a directory of SVG files
 * 
 * @param {string} dir - Directory path
 * @param {string} relPath - Relative path from assets
 * @return {Object[]} - Array of shape objects
 */
function processDirectory( dir, relPath = '' ) {
	const shapes = [];
	const files = fs.readdirSync( dir );

	for ( const file of files ) {
		const fullPath = path.join( dir, file );
		const stat = fs.statSync( fullPath );

		if ( stat.isDirectory() ) {
			const subPath = relPath ? `${ relPath }/${ file }` : file;
			shapes.push( ...processDirectory( fullPath, subPath ) );
		} else if ( file.endsWith( '.svg' ) ) {
			try {
				const svg = fs.readFileSync( fullPath, 'utf8' );
				const viewBox = extractViewBox( svg );
				const category = getCategoryInfo( relPath );
				const name = generateName( file );
				const tags = generateTags( name, file, category.id );

				// Create unique ID from path
				const id = `${ category.id }/${ file.replace( /\.svg$/i, '' ) }`
					.replace( /[^a-z0-9/\-_]/gi, '-' )
					.replace( /-+/g, '-' )
					.toLowerCase();

				shapes.push( {
					id,
					category: category.id,
					filename: file,
					name,
					tags,
					viewBox,
					svg
				} );
			} catch ( e ) {
				console.error( `Error processing ${ fullPath }: ${ e.message }` );
			}
		}
	}

	return shapes;
}

// Main execution
console.log( 'Generating ShapeLibraryData.js...\n' );

// Collect all shapes
const allShapes = processDirectory( ASSETS_DIR );

// Group by category
const categories = {};
for ( const shape of allShapes ) {
	if ( !categories[ shape.category ] ) {
		categories[ shape.category ] = [];
	}
	categories[ shape.category ].push( shape );
}

// Sort shapes within each category by ID
for ( const cat of Object.keys( categories ) ) {
	categories[ cat ].sort( ( a, b ) => a.id.localeCompare( b.id, undefined, { numeric: true } ) );
}

// Generate output
let output = `/**
 * Shape Library Data for Layers Extension
 *
 * Auto-generated by generate-library.js
 * Generated: ${ new Date().toISOString() }
 *
 * Contains ${ allShapes.length } shapes across ${ Object.keys( categories ).length } categories.
 *
 * @file
 */

( function () {
	'use strict';

	/**
	 * Shape library categories
	 *
	 * @type {Object[]}
	 */
	const CATEGORIES = [
		// Parent category for ISO 7010
		{
			id: 'iso7010',
			name: 'ISO 7010 Safety Signs',
			color: '#333333',
			description: 'International safety signs standard',
			isParent: true
		},
		// ISO 7010 subcategories
		{
			id: 'iso7010-w',
			name: 'Warning Signs',
			prefix: 'W',
			color: '#F9A800',
			description: 'ISO 7010 yellow triangle warning signs',
			parentId: 'iso7010'
		},
		{
			id: 'iso7010-p',
			name: 'Prohibition Signs',
			prefix: 'P',
			color: '#b71f2e',
			description: 'ISO 7010 red circle prohibition signs',
			parentId: 'iso7010'
		},
		{
			id: 'iso7010-m',
			name: 'Mandatory Signs',
			prefix: 'M',
			color: '#24578e',
			description: 'ISO 7010 blue circle mandatory action signs',
			parentId: 'iso7010'
		},
		{
			id: 'iso7010-e',
			name: 'Emergency Signs',
			prefix: 'E',
			color: '#008855',
			description: 'ISO 7010 green emergency and escape signs',
			parentId: 'iso7010'
		},
		{
			id: 'iso7010-f',
			name: 'Fire Signs',
			prefix: 'F',
			color: '#a92121',
			description: 'ISO 7010 red fire protection signs',
			parentId: 'iso7010'
		},
		// Standalone categories (no parent)
		{
			id: 'iso7000',
			name: 'ISO 7000 Symbols',
			prefix: 'ISO7000',
			color: '#333333',
			description: 'ISO 7000 graphical symbols for use on equipment'
		},
		{
			id: 'ghs',
			name: 'GHS Hazard',
			prefix: 'GHS',
			color: '#CC0000',
			description: 'GHS chemical hazard pictograms'
		},
		{
			id: 'ecb',
			name: 'ECB Hazard',
			prefix: 'ECB',
			color: '#FF6600',
			description: 'European chemical hazard symbols'
		},
		{
			id: 'ansi',
			name: 'ANSI Safety',
			prefix: 'ANSI',
			color: '#000000',
			description: 'ANSI Z535 safety symbols'
		}
	];

	/**
	 * All shapes in the library
	 *
	 * @type {Object[]}
	 */
	const SHAPES = [
`;

// Add shapes
for ( const cat of [ 'iso7010-w', 'iso7010-p', 'iso7010-m', 'iso7010-e', 'iso7010-f', 'iso7000', 'ghs', 'ecb', 'ansi' ] ) {
	if ( !categories[ cat ] ) {
		continue;
	}

	output += `\t\t// === ${ cat.toUpperCase() } (${ categories[ cat ].length } shapes) ===\n`;

	for ( const shape of categories[ cat ] ) {
		output += `\t\t{
			id: '${ escapeJS( shape.id ) }',
			category: '${ shape.category }',
			name: '${ escapeJS( shape.name ) }',
			tags: ${ JSON.stringify( shape.tags ) },
			viewBox: ${ JSON.stringify( shape.viewBox ) },
			svg: '${ escapeJS( shape.svg ) }'
		},\n`;
	}
}

output += `\t];

	/**
	 * Shape Library API
	 *
	 * @namespace
	 */
	window.Layers = window.Layers || {};
	window.Layers.ShapeLibrary = window.Layers.ShapeLibrary || {};

	// Extend ShapeLibrary with data methods (preserves CustomShapeRenderer if already attached)
	Object.assign( window.Layers.ShapeLibrary, {
		/**
		 * Get all categories
		 *
		 * @return {Object[]} Array of category objects
		 */
		getCategories: function () {
			return CATEGORIES;
		},

		/**
		 * Get all shapes
		 *
		 * @return {Object[]} Array of shape objects
		 */
		getAllShapes: function () {
			return SHAPES;
		},

		/**
		 * Get shapes by category
		 *
		 * @param {string} categoryId - Category ID
		 * @return {Object[]} Array of shapes in category
		 */
		getShapesByCategory: function ( categoryId ) {
			return SHAPES.filter( function ( s ) {
				return s.category === categoryId;
			} );
		},

		/**
		 * Get a shape by ID
		 *
		 * @param {string} shapeId - Shape ID
		 * @return {Object|null} Shape object or null
		 */
		getShape: function ( shapeId ) {
			return SHAPES.find( function ( s ) {
				return s.id === shapeId;
			} ) || null;
		},

		/**
		 * Search shapes by query
		 *
		 * @param {string} query - Search query
		 * @return {Object[]} Matching shapes
		 */
		search: function ( query ) {
			if ( !query || query.length < 2 ) {
				return [];
			}

			const q = query.toLowerCase();
			return SHAPES.filter( function ( s ) {
				// Search in name
				if ( s.name.toLowerCase().indexOf( q ) !== -1 ) {
					return true;
				}
				// Search in tags
				return s.tags.some( function ( tag ) {
					return tag.indexOf( q ) !== -1;
				} );
			} );
		},

		/**
		 * Get shape count
		 *
		 * @return {number} Total number of shapes
		 */
		getCount: function () {
			return SHAPES.length;
		}
	} );
}() );
`;

// Write output
fs.writeFileSync( OUTPUT_FILE, output );

console.log( `Generated ${ OUTPUT_FILE }` );
console.log( `\nCategories:` );
for ( const cat of Object.keys( categories ) ) {
	console.log( `  ${ cat }: ${ categories[ cat ].length } shapes` );
}
console.log( `\nTotal: ${ allShapes.length } shapes` );
