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

	// Handle IEC 60417 patterns: IEC_60417_-_Ref-No_5001A.svg
	const iec60417Match = name.match( /IEC_60417_-_Ref-No_(\d+[A-Z]?(?:-\d+)?)/i );
	if ( iec60417Match ) {
		return iec60417Match[ 1 ];
	}
	// Handle IEC style patterns: IEC_style_chassis_ground.svg
	const iecStyleMatch = name.match( /IEC_style_(.+)/i );
	if ( iecStyleMatch ) {
		return iecStyleMatch[ 1 ].replace( /_/g, ' ' ).replace( /\b\w/g, ( c ) => c.toUpperCase() );
	}
	// Handle Keyboard Symbol pattern
	if ( name.match( /Keyboard_Symbol/i ) ) {
		return 'Keyboard Symbol';
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
		iec60417: [ 'symbol', 'equipment', 'iec', 'electrical', 'electronic', 'graphical', 'industrial' ],
		ghs: [ 'hazard', 'chemical', 'danger', 'ghs', 'pictogram', 'classification' ],
		ecb: [ 'hazard', 'chemical', 'european', 'danger', 'warning' ],
		ansi: [ 'safety', 'hazard', 'warning', 'american', 'osha' ],
		emoji: [ 'emoji', 'noto', 'google', 'icon', 'expression', 'face', 'symbol' ]
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
		iec_60417: {
			id: 'iec60417',
			name: 'IEC 60417 Symbols',
			prefix: 'IEC',
			color: '#1a5276',
			description: 'IEC 60417 graphical symbols for use on equipment'
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
		},
		noto_emoji: {
			id: 'emoji',
			name: 'Noto Emoji',
			prefix: 'Emoji',
			color: '#FFD93D',
			description: 'Google Noto Color Emoji - expressive emoji icons'
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

const CAT_ORDER = [ 'iso7010-w', 'iso7010-p', 'iso7010-m', 'iso7010-e', 'iso7010-f', 'iso7000', 'iec60417', 'ghs', 'ecb', 'ansi', 'other' ];
const OUTPUT_DIR = path.dirname( OUTPUT_FILE );
const today = new Date().toISOString().slice( 0, 10 );

// ---------------------------------------------------------------------------
// Write per-category data files (SVG + viewBox, loaded lazily per category)
// ---------------------------------------------------------------------------
console.log( 'Writing per-category data files...\n' );

for ( const catId of CAT_ORDER ) {
	if ( !categories[ catId ] ) {
		continue;
	}
	const shapes = categories[ catId ];

	let fileContent = `/**
 * Shape Library Data - ${ catId } category
 *
 * Auto-generated by generate-library.js — do not edit manually.
 * Generated: ${ today }
 *
 * Contains ${ shapes.length } shapes.
 *
 * @file
 */

( function () {
\t'use strict';

\twindow.Layers = window.Layers || {};
\twindow.Layers.ShapeLibrary = window.Layers.ShapeLibrary || {};

\tif ( typeof window.Layers.ShapeLibrary.registerCategoryShapes !== 'function' ) {
\t\t// Base module not yet loaded — defer silently
\t\treturn;
\t}

\twindow.Layers.ShapeLibrary.registerCategoryShapes( '${ catId }', [
`;

	for ( const shape of shapes ) {
		fileContent += `\t\t{
\t\t\tid: '${ escapeJS( shape.id ) }',
\t\t\tcategory: '${ shape.category }',
\t\t\tname: '${ escapeJS( shape.name ) }',
\t\t\ttags: ${ JSON.stringify( shape.tags ) },
\t\t\tviewBox: ${ JSON.stringify( shape.viewBox ) },
\t\t\tsvg: '${ escapeJS( shape.svg ) }'
\t\t},
`;
	}

	fileContent += `\t] );
}() );
`;

	const outFile = path.join( OUTPUT_DIR, `ShapeLibraryData.${ catId }.js` );
	fs.writeFileSync( outFile, fileContent, 'utf8' );
	const kb = ( fs.statSync( outFile ).size / 1024 ).toFixed( 1 );
	console.log( `  ${ catId.padEnd( 14 ) } ${ String( shapes.length ).padStart( 4 ) } shapes  →  ShapeLibraryData.${ catId }.js  (${ kb } KB)` );
}

// ---------------------------------------------------------------------------
// Build the lightweight SHAPE_INDEX (id, category, name, tags — no SVG)
// ---------------------------------------------------------------------------
const indexEntries = allShapes.map( ( s ) =>
	`\t\t{ id: '${ escapeJS( s.id ) }', category: '${ s.category }', name: '${ escapeJS( s.name ) }', tags: ${ JSON.stringify( s.tags ) } }`
).join( ',\n' );

// ---------------------------------------------------------------------------
// Write the new lightweight base ShapeLibraryData.js
// (CATEGORIES + SHAPE_INDEX + lazy API — no SVG data)
// ---------------------------------------------------------------------------
const baseContent = `/**
 * Shape Library Data for Layers Extension
 *
 * Auto-generated by generate-library.js — do not edit manually.
 * Generated: ${ new Date().toISOString() }
 *
 * Contains category metadata and a shape index (${ allShapes.length } shapes).
 * SVG data is NOT included here — it is loaded lazily per category via
 * separate ResourceLoader modules (ext.layers.shapeLibrary.data.*).
 *
 * @file
 */

( function () {
\t'use strict';

\t/**
\t * Shape library categories
\t *
\t * @type {Object[]}
\t */
\tconst CATEGORIES = [
\t\t// Parent category for ISO 7010
\t\t{
\t\t\tid: 'iso7010',
\t\t\tname: 'ISO 7010 Safety Signs',
\t\t\tcolor: '#333333',
\t\t\tdescription: 'International safety signs standard',
\t\t\tisParent: true
\t\t},
\t\t// ISO 7010 subcategories
\t\t{
\t\t\tid: 'iso7010-w',
\t\t\tname: 'Warning Signs',
\t\t\tprefix: 'W',
\t\t\tcolor: '#F9A800',
\t\t\tdescription: 'ISO 7010 yellow triangle warning signs',
\t\t\tparentId: 'iso7010'
\t\t},
\t\t{
\t\t\tid: 'iso7010-p',
\t\t\tname: 'Prohibition Signs',
\t\t\tprefix: 'P',
\t\t\tcolor: '#b71f2e',
\t\t\tdescription: 'ISO 7010 red circle prohibition signs',
\t\t\tparentId: 'iso7010'
\t\t},
\t\t{
\t\t\tid: 'iso7010-m',
\t\t\tname: 'Mandatory Signs',
\t\t\tprefix: 'M',
\t\t\tcolor: '#24578e',
\t\t\tdescription: 'ISO 7010 blue circle mandatory action signs',
\t\t\tparentId: 'iso7010'
\t\t},
\t\t{
\t\t\tid: 'iso7010-e',
\t\t\tname: 'Emergency Signs',
\t\t\tprefix: 'E',
\t\t\tcolor: '#008855',
\t\t\tdescription: 'ISO 7010 green emergency and escape signs',
\t\t\tparentId: 'iso7010'
\t\t},
\t\t{
\t\t\tid: 'iso7010-f',
\t\t\tname: 'Fire Signs',
\t\t\tprefix: 'F',
\t\t\tcolor: '#a92121',
\t\t\tdescription: 'ISO 7010 red fire protection signs',
\t\t\tparentId: 'iso7010'
\t\t},
\t\t// Standalone categories (no parent)
\t\t{
\t\t\tid: 'iso7000',
\t\t\tname: 'ISO 7000 Symbols',
\t\t\tprefix: 'ISO7000',
\t\t\tcolor: '#333333',
\t\t\tdescription: 'ISO 7000 graphical symbols for use on equipment'
\t\t},
\t\t{
\t\t\tid: 'iec60417',
\t\t\tname: 'IEC 60417 Symbols',
\t\t\tprefix: 'IEC',
\t\t\tcolor: '#1a5276',
\t\t\tdescription: 'IEC 60417 graphical symbols for use on equipment'
\t\t},
\t\t{
\t\t\tid: 'ghs',
\t\t\tname: 'GHS Hazard',
\t\t\tprefix: 'GHS',
\t\t\tcolor: '#CC0000',
\t\t\tdescription: 'GHS chemical hazard pictograms'
\t\t},
\t\t{
\t\t\tid: 'ecb',
\t\t\tname: 'ECB Hazard',
\t\t\tprefix: 'ECB',
\t\t\tcolor: '#FF6600',
\t\t\tdescription: 'European chemical hazard symbols'
\t\t},
\t\t{
\t\t\tid: 'ansi',
\t\t\tname: 'ANSI Safety',
\t\t\tprefix: 'ANSI',
\t\t\tcolor: '#000000',
\t\t\tdescription: 'ANSI Z535 safety symbols'
\t\t},
\t\t{
\t\t\tid: 'other',
\t\t\tname: 'Other Symbols',
\t\t\tprefix: '',
\t\t\tcolor: '#666666',
\t\t\tdescription: 'Miscellaneous symbols and icons'
\t\t}
\t];

\t/**
\t * Lightweight shape index — id, category, name, tags only (no SVG).
\t * Used for fast cross-category search without loading SVG data.
\t *
\t * @type {Object[]}
\t */
\tconst SHAPE_INDEX = [
${ indexEntries }
\t];

\t/**
\t * Per-category SVG shape store.
\t * Populated lazily when category data modules are loaded via mw.loader.using().
\t *
\t * @type {Object.<string, Object[]>}
\t */
\tconst _loaded = {};

\t/**
\t * Shape Library API
\t *
\t * @namespace
\t */
\twindow.Layers = window.Layers || {};
\twindow.Layers.ShapeLibrary = window.Layers.ShapeLibrary || {};

\t// Extend ShapeLibrary with data methods (preserves CustomShapeRenderer if already attached)
\tObject.assign( window.Layers.ShapeLibrary, {

\t\t/**
\t\t * Get all categories
\t\t *
\t\t * @return {Object[]} Array of category objects
\t\t */
\t\tgetCategories: function () {
\t\t\treturn CATEGORIES;
\t\t},

\t\t/**
\t\t * Register shape data for a category (called by per-category data modules).
\t\t *
\t\t * @param {string} categoryId - Category ID
\t\t * @param {Object[]} shapes - Array of shape objects with full SVG data
\t\t */
\t\tregisterCategoryShapes: function ( categoryId, shapes ) {
\t\t\t_loaded[ categoryId ] = shapes;
\t\t},

\t\t/**
\t\t * Check whether SVG data for a category has been loaded.
\t\t *
\t\t * @param {string} categoryId - Category ID
\t\t * @return {boolean}
\t\t */
\t\tisCategoryLoaded: function ( categoryId ) {
\t\t\treturn Boolean( _loaded[ categoryId ] );
\t\t},

\t\t/**
\t\t * Get shapes with full SVG data for a category.
\t\t * Returns an empty array if the category data module has not yet been loaded.
\t\t *
\t\t * @param {string} categoryId - Category ID
\t\t * @return {Object[]} Array of full shape objects (empty if not yet loaded)
\t\t */
\t\tgetShapesByCategory: function ( categoryId ) {
\t\t\treturn _loaded[ categoryId ] || [];
\t\t},

\t\t/**
\t\t * Get all loaded shapes (only categories whose data has been fetched).
\t\t *
\t\t * @return {Object[]}
\t\t */
\t\tgetAllShapes: function () {
\t\t\treturn Object.values( _loaded ).flat();
\t\t},

\t\t/**
\t\t * Get a shape by ID from any loaded category.
\t\t *
\t\t * @param {string} shapeId - Shape ID
\t\t * @return {Object|null} Shape object or null
\t\t */
\t\tgetShape: function ( shapeId ) {
\t\t\tfor ( const shapes of Object.values( _loaded ) ) {
\t\t\t\tconst found = shapes.find( ( s ) => s.id === shapeId );
\t\t\t\tif ( found ) {
\t\t\t\t\treturn found;
\t\t\t\t}
\t\t\t}
\t\t\treturn null;
\t\t},

\t\t/**
\t\t * Search shapes by query string.
\t\t *
\t\t * Uses the full SHAPE_INDEX for metadata matching (always available), then
\t\t * enriches results with full SVG data if the category has been loaded.
\t\t *
\t\t * @param {string} query - Search query (min 2 chars)
\t\t * @return {Object[]} Matching shape objects (may lack svg/viewBox if not yet loaded)
\t\t */
\t\tsearch: function ( query ) {
\t\t\tif ( !query || query.length < 2 ) {
\t\t\t\treturn [];
\t\t\t}
\t\t\tconst q = query.toLowerCase();
\t\t\tconst matches = SHAPE_INDEX.filter( ( s ) => {
\t\t\t\tif ( s.name.toLowerCase().includes( q ) ) {
\t\t\t\t\treturn true;
\t\t\t\t}
\t\t\t\treturn s.tags.some( ( tag ) => tag.includes( q ) );
\t\t\t} );
\t\t\t// Enrich with full SVG data for already-loaded categories
\t\t\treturn matches.map( ( s ) => {
\t\t\t\tif ( _loaded[ s.category ] ) {
\t\t\t\t\tconst full = _loaded[ s.category ].find( ( f ) => f.id === s.id );
\t\t\t\t\tif ( full ) {
\t\t\t\t\t\treturn full;
\t\t\t\t\t}
\t\t\t\t}
\t\t\t\treturn s; // Return metadata-only object (no svg/viewBox) if not loaded yet
\t\t\t} );
\t\t},

\t\t/**
\t\t * Get the total number of shapes (from the index, regardless of load state).
\t\t *
\t\t * @return {number}
\t\t */
\t\tgetCount: function () {
\t\t\treturn SHAPE_INDEX.length;
\t\t},

\t\t/**
\t\t * Get the number of shapes in a category (from the index, always available).
\t\t *
\t\t * @param {string} categoryId - Category ID
\t\t * @return {number}
\t\t */
\t\tgetCategoryCount: function ( categoryId ) {
\t\t\treturn SHAPE_INDEX.filter( ( s ) => s.category === categoryId ).length;
\t\t}
\t} );
}() );
`;

fs.writeFileSync( OUTPUT_FILE, baseContent );

const baseKB = ( fs.statSync( OUTPUT_FILE ).size / 1024 ).toFixed( 1 );
console.log( `\nWrote base ${ OUTPUT_FILE }  (${ baseKB } KB)` );
console.log( `\nCategories:` );
for ( const cat of CAT_ORDER ) {
	if ( categories[ cat ] ) {
		console.log( `  ${ cat }: ${ categories[ cat ].length } shapes` );
	}
}
console.log( `\nTotal: ${ allShapes.length } shapes` );
