#!/usr/bin/env node
/**
 * Generate Emoji Library Data for Layers Extension
 *
 * This script generates EmojiLibraryData.js from SVG files in assets/noto_emoji.
 * The emoji are organized into categories based on Unicode ranges.
 *
 * Usage: node generate-emoji-library.js
 *
 * @file
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

// Paths
const SCRIPT_DIR = __dirname;
const SHAPE_LIB_DIR = path.dirname( SCRIPT_DIR );
const ASSETS_DIR = path.join( SHAPE_LIB_DIR, 'assets', 'noto_emoji' );
const OUTPUT_FILE = path.join( SHAPE_LIB_DIR, 'EmojiLibraryData.js' );

/**
 * Unicode emoji categories based on ranges
 */
const EMOJI_CATEGORIES = {
	// Smileys & Emotion (1F600-1F64F)
	'smileys': {
		name: 'Smileys & Emotion',
		icon: '😀',
		ranges: [
			[ 0x1F600, 0x1F64F ],
			[ 0x1F910, 0x1F92F ],
			[ 0x1F970, 0x1F976 ]
		]
	},
	// People & Body (1F466-1F4FF partial)
	'people': {
		name: 'People & Body',
		icon: '👋',
		ranges: [
			[ 0x1F385, 0x1F3C4 ],
			[ 0x1F442, 0x1F4FF ],
			[ 0x1F9B0, 0x1F9FF ]
		]
	},
	// Animals & Nature (1F400-1F43F, 1F980-1F9AF)
	'animals': {
		name: 'Animals & Nature',
		icon: '🐱',
		ranges: [
			[ 0x1F400, 0x1F43F ],
			[ 0x1F980, 0x1F9AF ],
			[ 0x1F330, 0x1F335 ],
			[ 0x1F337, 0x1F33F ]
		]
	},
	// Food & Drink (1F32D-1F37F)
	'food': {
		name: 'Food & Drink',
		icon: '🍔',
		ranges: [
			[ 0x1F32D, 0x1F32F ],
			[ 0x1F340, 0x1F37F ],
			[ 0x1F950, 0x1F96F ]
		]
	},
	// Travel & Places (1F680-1F6FF)
	'travel': {
		name: 'Travel & Places',
		icon: '✈️',
		ranges: [
			[ 0x1F680, 0x1F6FF ],
			[ 0x1F3D4, 0x1F3DF ]
		]
	},
	// Activities (1F3A0-1F3CF)
	'activities': {
		name: 'Activities',
		icon: '⚽',
		ranges: [
			[ 0x1F3A0, 0x1F3CF ],
			[ 0x1F3E0, 0x1F3F0 ],
			[ 0x26BD, 0x26BF ]
		]
	},
	// Objects (1F4A0-1F4FF, partial)
	'objects': {
		name: 'Objects',
		icon: '💡',
		ranges: [
			[ 0x1F4A0, 0x1F4FF ],
			[ 0x1F500, 0x1F5FF ]
		]
	},
	// Symbols (2600-26FF, 2700-27BF)
	'symbols': {
		name: 'Symbols',
		icon: '❤️',
		ranges: [
			[ 0x2600, 0x26FF ],
			[ 0x2700, 0x27BF ],
			[ 0x1F300, 0x1F320 ]
		]
	},
	// Flags (1F1E0-1F1FF)
	'flags': {
		name: 'Flags',
		icon: '🏳️',
		ranges: [
			[ 0x1F1E0, 0x1F1FF ],
			[ 0x1F3F4, 0x1F3F4 ]
		]
	}
};

/**
 * Parse codepoint from filename
 * @param {string} filename - e.g., "emoji_u1f600.svg" or "emoji_u1f1fa_1f1f8.svg"
 * @return {number|null} - Primary codepoint or null
 */
function parseCodepoint( filename ) {
	const match = filename.match( /emoji_u([0-9a-f]+)/i );
	if ( match ) {
		return parseInt( match[ 1 ], 16 );
	}
	return null;
}

/**
 * Get category for a codepoint
 * @param {number} codepoint
 * @return {string} - Category ID
 */
function getCategoryForCodepoint( codepoint ) {
	for ( const [ catId, catInfo ] of Object.entries( EMOJI_CATEGORIES ) ) {
		for ( const [ min, max ] of catInfo.ranges ) {
			if ( codepoint >= min && codepoint <= max ) {
				return catId;
			}
		}
	}
	return 'symbols'; // Default category
}

/**
 * Generate human-readable name from filename
 * @param {string} filename
 * @return {string}
 */
function generateName( filename ) {
	// Remove emoji_u prefix and .svg extension
	let name = filename.replace( /^emoji_u/i, '' ).replace( /\.svg$/i, '' );

	// Convert underscores to spaces for compound emoji
	name = name.replace( /_/g, ' ' );

	// Add "Emoji" prefix
	return 'Emoji ' + name.toUpperCase();
}

/**
 * Extract viewBox from SVG
 * @param {string} svg
 * @return {Object|null}
 */
function extractViewBox( svg ) {
	const match = svg.match( /viewBox=["']([^"']+)["']/i );
	if ( match ) {
		const parts = match[ 1 ].trim().split( /\s+/ ).map( Number );
		if ( parts.length === 4 ) {
			return {
				x: parts[ 0 ],
				y: parts[ 1 ],
				width: parts[ 2 ],
				height: parts[ 3 ]
			};
		}
	}
	return null;
}

/**
 * Escape string for JavaScript
 * @param {string} str
 * @return {string}
 */
function escapeJS( str ) {
	return str
		.replace( /\\/g, '\\\\' )
		.replace( /'/g, '\\\'' )
		.replace( /\n/g, '\\n' )
		.replace( /\r/g, '' )
		.replace( /\t/g, '\\t' );
}

// Main execution
console.log( 'Generating EmojiLibraryData.js...\n' );

if ( !fs.existsSync( ASSETS_DIR ) ) {
	console.error( `Error: Assets directory not found: ${ ASSETS_DIR }` );
	process.exit( 1 );
}

// Collect all emoji
const allEmoji = [];
const files = fs.readdirSync( ASSETS_DIR );

for ( const file of files ) {
	if ( !file.endsWith( '.svg' ) ) {
		continue;
	}

	const fullPath = path.join( ASSETS_DIR, file );

	try {
		const svg = fs.readFileSync( fullPath, 'utf8' );
		const viewBox = extractViewBox( svg );
		const codepoint = parseCodepoint( file );
		const category = codepoint ? getCategoryForCodepoint( codepoint ) : 'symbols';

		allEmoji.push( {
			id: file.replace( /\.svg$/i, '' ),
			category,
			filename: file,
			codepoint,
			name: generateName( file ),
			viewBox,
			svg
		} );
	} catch ( e ) {
		console.error( `Error processing ${ file }: ${ e.message }` );
	}
}

// Group by category
const categories = {};
for ( const emoji of allEmoji ) {
	if ( !categories[ emoji.category ] ) {
		categories[ emoji.category ] = [];
	}
	categories[ emoji.category ].push( emoji );
}

// Sort each category by codepoint
for ( const cat of Object.keys( categories ) ) {
	categories[ cat ].sort( ( a, b ) => ( a.codepoint || 0 ) - ( b.codepoint || 0 ) );
}

// Generate output
let output = `/**
 * Emoji Library Data for Layers Extension
 *
 * Auto-generated by generate-emoji-library.js
 * Generated: ${ new Date().toISOString() }
 *
 * Contains ${ allEmoji.length } emoji across ${ Object.keys( categories ).length } categories.
 *
 * @file
 */

( function () {
	'use strict';

	/**
	 * Emoji categories
	 *
	 * @type {Object[]}
	 */
	const CATEGORIES = [
`;

// Add categories
for ( const [ catId, catInfo ] of Object.entries( EMOJI_CATEGORIES ) ) {
	const count = categories[ catId ] ? categories[ catId ].length : 0;
	output += `\t\t{
			id: '${ catId }',
			name: '${ catInfo.name }',
			icon: '${ catInfo.icon }',
			count: ${ count }
		},\n`;
}

output += `\t];

	/**
	 * All emoji in the library
	 *
	 * @type {Object[]}
	 */
	const EMOJI = [
`;

// Add emoji by category
for ( const catId of Object.keys( EMOJI_CATEGORIES ) ) {
	if ( !categories[ catId ] || categories[ catId ].length === 0 ) {
		continue;
	}

	output += `\t\t// === ${ catId.toUpperCase() } (${ categories[ catId ].length } emoji) ===\n`;

	for ( const emoji of categories[ catId ] ) {
		output += `\t\t{
			id: '${ escapeJS( emoji.id ) }',
			category: '${ emoji.category }',
			name: '${ escapeJS( emoji.name ) }',
			viewBox: ${ JSON.stringify( emoji.viewBox ) },
			svg: '${ escapeJS( emoji.svg ) }'
		},\n`;
	}
}

output += `\t];

	/**
	 * Emoji Library API
	 *
	 * @namespace
	 */
	window.Layers = window.Layers || {};
	window.Layers.EmojiLibrary = {
		/**
		 * Get all categories
		 *
		 * @return {Object[]} Array of category objects
		 */
		getCategories: function () {
			return CATEGORIES;
		},

		/**
		 * Get emoji by category
		 *
		 * @param {string} categoryId - Category ID
		 * @return {Object[]} Array of emoji in that category
		 */
		getByCategory: function ( categoryId ) {
			return EMOJI.filter( function ( e ) {
				return e.category === categoryId;
			} );
		},

		/**
		 * Get all emoji
		 *
		 * @return {Object[]} All emoji
		 */
		getAll: function () {
			return EMOJI;
		},

		/**
		 * Search emoji by name
		 *
		 * @param {string} query - Search query
		 * @return {Object[]} Matching emoji
		 */
		search: function ( query ) {
			const q = query.toLowerCase();
			return EMOJI.filter( function ( e ) {
				return e.name.toLowerCase().includes( q ) ||
					e.id.toLowerCase().includes( q );
			} );
		},

		/**
		 * Get emoji by ID
		 *
		 * @param {string} id - Emoji ID
		 * @return {Object|null} Emoji or null
		 */
		getById: function ( id ) {
			for ( let i = 0; i < EMOJI.length; i++ ) {
				if ( EMOJI[ i ].id === id ) {
					return EMOJI[ i ];
				}
			}
			return null;
		}
	};
}() );
`;

// Write output
fs.writeFileSync( OUTPUT_FILE, output );

console.log( `Generated ${ OUTPUT_FILE }` );
console.log( 'Categories:' );
for ( const [ catId, catInfo ] of Object.entries( EMOJI_CATEGORIES ) ) {
	const count = categories[ catId ] ? categories[ catId ].length : 0;
	console.log( `  ${ catInfo.name }: ${ count } emoji` );
}
console.log( `\nTotal: ${ allEmoji.length } emoji` );
