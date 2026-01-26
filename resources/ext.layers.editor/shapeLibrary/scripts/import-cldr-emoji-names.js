#!/usr/bin/env node
/**
 * Import Emoji Names and Keywords from Unicode Data
 *
 * Downloads emoji metadata from unicode-emoji-json and merges with existing
 * emoji-names.json. This provides official names and keywords for searchability.
 *
 * Usage:
 *   node import-cldr-emoji-names.js [--force]
 *
 * Options:
 *   --force    Overwrite existing entries (default: keep existing)
 *
 * Data source: unicode-emoji-json (derived from Unicode CLDR)
 * https://github.com/muan/unicode-emoji-json
 *
 * @file
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const https = require( 'https' );

// Configuration
const SCRIPT_DIR = __dirname;
const EMOJI_NAMES_FILE = path.join( SCRIPT_DIR, 'emoji-names.json' );
const ASSETS_DIR = path.join( path.dirname( SCRIPT_DIR ), 'assets', 'noto_emoji' );

// Data source URL
const EMOJI_DATA_URL = 'https://raw.githubusercontent.com/muan/unicode-emoji-json/main/data-by-emoji.json';

// Parse command line arguments
const args = process.argv.slice( 2 );
const forceOverwrite = args.includes( '--force' );

/**
 * Fetch JSON from a URL with retry logic
 *
 * @param {string} url - URL to fetch
 * @param {number} retries - Number of retries
 * @return {Promise<Object>} Parsed JSON
 */
function fetchJson( url, retries = 3 ) {
	return new Promise( ( resolve, reject ) => {
		console.log( `Fetching: ${ url }` );

		const request = https.get( url, {
			headers: {
				'User-Agent': 'Layers-Extension/1.0'
			}
		}, ( res ) => {
			if ( res.statusCode === 301 || res.statusCode === 302 ) {
				// Follow redirect
				fetchJson( res.headers.location, retries ).then( resolve ).catch( reject );
				return;
			}

			if ( res.statusCode !== 200 ) {
				if ( retries > 0 ) {
					console.log( `Retrying... (${ retries } attempts left)` );
					setTimeout( () => {
						fetchJson( url, retries - 1 ).then( resolve ).catch( reject );
					}, 1000 );
					return;
				}
				reject( new Error( `HTTP ${ res.statusCode } for ${ url }` ) );
				return;
			}

			let data = '';
			res.on( 'data', ( chunk ) => {
				data += chunk;
			} );
			res.on( 'end', () => {
				try {
					resolve( JSON.parse( data ) );
				} catch ( e ) {
					reject( new Error( `JSON parse error: ${ e.message }` ) );
				}
			} );
		} );

		request.on( 'error', ( e ) => {
			if ( retries > 0 ) {
				console.log( `Network error, retrying... (${ retries } attempts left)` );
				setTimeout( () => {
					fetchJson( url, retries - 1 ).then( resolve ).catch( reject );
				}, 1000 );
			} else {
				reject( e );
			}
		} );

		request.setTimeout( 30000, () => {
			request.destroy();
			reject( new Error( 'Request timeout' ) );
		} );
	} );
}

/**
 * Convert Unicode character to codepoint string
 *
 * @param {string} char - Unicode character(s)
 * @return {string} Codepoint string like "1f600" or "1f469_200d_1f52c"
 */
function charToCodepoint( char ) {
	const codepoints = [];
	for ( const c of char ) {
		const cp = c.codePointAt( 0 );
		// Skip variation selectors (FE0E, FE0F)
		if ( cp !== 0xFE0E && cp !== 0xFE0F ) {
			codepoints.push( cp.toString( 16 ).toLowerCase() );
		}
	}
	return codepoints.join( '_' );
}

/**
 * Get all emoji files in assets directory
 *
 * @return {Set<string>} Set of codepoint strings we have files for
 */
function getAvailableEmoji() {
	const available = new Set();

	if ( !fs.existsSync( ASSETS_DIR ) ) {
		console.error( `Assets directory not found: ${ ASSETS_DIR }` );
		return available;
	}

	const files = fs.readdirSync( ASSETS_DIR );
	for ( const file of files ) {
		if ( file.startsWith( 'emoji_u' ) && file.endsWith( '.svg' ) ) {
			// Extract codepoint from filename like "emoji_u1f600.svg"
			const codepoint = file.replace( 'emoji_u', '' ).replace( '.svg', '' );
			available.add( codepoint );
		}
	}

	console.log( `Found ${ available.size } emoji files in assets` );
	return available;
}

/**
 * Parse unicode-emoji-json format
 *
 * Format: { "😀": { "name": "grinning face", "slug": "grinning_face", "group": "Smileys & Emotion", ... } }
 *
 * @param {Object} data - Raw data from unicode-emoji-json
 * @param {Set<string>} available - Set of available emoji codepoints
 * @return {Object} Processed emoji names
 */
function parseUnicodeEmojiJson( data, available ) {
	const result = {};

	for ( const [ char, info ] of Object.entries( data ) ) {
		const codepoint = charToCodepoint( char );

		// Skip if we don't have a file for this emoji
		if ( !available.has( codepoint ) ) {
			continue;
		}

		// Extract name and generate keywords from slug and group
		const name = info.name || '';
		const keywords = [];

		// Add words from name
		if ( name ) {
			const nameWords = name.toLowerCase().split( /\s+/ );
			keywords.push( ...nameWords );
		}

		// Add words from slug
		if ( info.slug ) {
			const slugWords = info.slug.split( '_' );
			for ( const word of slugWords ) {
				if ( !keywords.includes( word ) ) {
					keywords.push( word );
				}
			}
		}

		// Add group as keyword
		if ( info.group ) {
			const groupWords = info.group.toLowerCase().split( /[\s&]+/ ).filter( ( w ) => w );
			for ( const word of groupWords ) {
				if ( !keywords.includes( word ) ) {
					keywords.push( word );
				}
			}
		}

		// Add subgroup as keyword
		if ( info.sub_group ) {
			const subgroupWords = info.sub_group.toLowerCase().split( /[-\s]+/ ).filter( ( w ) => w );
			for ( const word of subgroupWords ) {
				if ( !keywords.includes( word ) ) {
					keywords.push( word );
				}
			}
		}

		if ( name || keywords.length > 0 ) {
			result[ codepoint ] = {
				name: name,
				keywords: keywords
			};
		}
	}

	return result;
}

/**
 * Generate fallback names for emoji based on codepoint
 *
 * @param {Set<string>} available - All available emoji codepoints
 * @param {Object} existing - Existing names data
 * @return {Object} Generated fallback entries
 */
function generateFallbackNames( available, existing ) {
	const fallback = {};

	// Skin tone modifiers
	const skinTones = {
		'1f3fb': 'light skin tone',
		'1f3fc': 'medium-light skin tone',
		'1f3fd': 'medium skin tone',
		'1f3fe': 'medium-dark skin tone',
		'1f3ff': 'dark skin tone'
	};

	// Gender indicators
	const genders = {
		'2640': 'woman',
		'2642': 'man'
	};

	for ( const codepoint of available ) {
		if ( existing[ codepoint ] ) {
			continue; // Already has data
		}

		// Try to generate a name based on the codepoint components
		const parts = codepoint.split( '_' );

		// Check if it's a skin tone or gender variant
		let baseName = null;
		const modifiers = [];

		for ( const part of parts ) {
			if ( skinTones[ part ] ) {
				modifiers.push( skinTones[ part ] );
			} else if ( genders[ part ] ) {
				modifiers.push( genders[ part ] );
			} else if ( part === '200d' ) {
				// Zero-width joiner, skip
				continue;
			} else {
				// Try to find the base emoji
				if ( existing[ part ] ) {
					baseName = existing[ part ].name;
				}
			}
		}

		if ( baseName && modifiers.length > 0 ) {
			fallback[ codepoint ] = {
				name: baseName + ': ' + modifiers.join( ', ' ),
				keywords: [ ...( existing[ parts[ 0 ] ]?.keywords || [] ), ...modifiers.map( ( m ) => m.split( ' ' ) ).flat() ]
			};
		}
	}

	return fallback;
}

/**
 * Main function
 */
async function main() {
	console.log( '=== Emoji Names Importer ===' );
	console.log( `Force overwrite: ${ forceOverwrite }` );
	console.log( '' );

	// Load existing emoji-names.json
	let existing = {};
	if ( fs.existsSync( EMOJI_NAMES_FILE ) ) {
		try {
			existing = JSON.parse( fs.readFileSync( EMOJI_NAMES_FILE, 'utf8' ) );
			console.log( `Loaded ${ Object.keys( existing ).length } existing entries` );
		} catch ( e ) {
			console.warn( `Warning: Could not load existing file: ${ e.message }` );
		}
	}

	// Get available emoji from assets
	const available = getAvailableEmoji();
	if ( available.size === 0 ) {
		console.error( 'No emoji files found. Aborting.' );
		process.exit( 1 );
	}

	// Fetch emoji data
	let emojiData = {};
	try {
		const rawData = await fetchJson( EMOJI_DATA_URL );
		emojiData = parseUnicodeEmojiJson( rawData, available );
		console.log( `Parsed ${ Object.keys( emojiData ).length } entries from unicode-emoji-json` );
	} catch ( e ) {
		console.error( `Error fetching emoji data: ${ e.message }` );
		console.log( 'Continuing with existing data and fallback generation...' );
	}

	// Merge with existing
	const merged = { ...existing };
	let added = 0;
	let updated = 0;
	let skipped = 0;

	for ( const [ codepoint, data ] of Object.entries( emojiData ) ) {
		if ( !merged[ codepoint ] ) {
			// New entry
			merged[ codepoint ] = data;
			added++;
		} else if ( forceOverwrite ) {
			// Update existing
			merged[ codepoint ] = data;
			updated++;
		} else {
			// Keep existing, but maybe add missing keywords
			const existingKeywords = new Set( merged[ codepoint ].keywords || [] );
			let keywordsAdded = false;
			for ( const kw of data.keywords || [] ) {
				if ( !existingKeywords.has( kw ) ) {
					existingKeywords.add( kw );
					keywordsAdded = true;
				}
			}
			if ( keywordsAdded ) {
				merged[ codepoint ].keywords = Array.from( existingKeywords );
				updated++;
			} else {
				skipped++;
			}
		}
	}

	// Generate fallback names for variants
	console.log( '\nGenerating fallback names for skin tone/gender variants...' );
	const fallback = generateFallbackNames( available, merged );
	for ( const [ codepoint, data ] of Object.entries( fallback ) ) {
		if ( !merged[ codepoint ] ) {
			merged[ codepoint ] = data;
			added++;
		}
	}
	console.log( `Generated ${ Object.keys( fallback ).length } fallback entries` );

	console.log( `\nMerge results:` );
	console.log( `  Added: ${ added }` );
	console.log( `  Updated: ${ updated }` );
	console.log( `  Skipped (already complete): ${ skipped }` );
	console.log( `  Total entries: ${ Object.keys( merged ).length }` );

	// Sort by codepoint for consistent output
	const sorted = {};
	const sortedKeys = Object.keys( merged ).sort();
	for ( const key of sortedKeys ) {
		sorted[ key ] = merged[ key ];
	}

	// Write output
	const output = JSON.stringify( sorted, null, 2 );
	fs.writeFileSync( EMOJI_NAMES_FILE, output, 'utf8' );
	console.log( `\nWrote: ${ EMOJI_NAMES_FILE }` );

	// Stats on coverage
	const withName = Object.values( sorted ).filter( ( e ) => e.name ).length;
	const withKeywords = Object.values( sorted ).filter( ( e ) => e.keywords && e.keywords.length > 0 ).length;
	console.log( `\nCoverage:` );
	console.log( `  Emoji with names: ${ withName } / ${ available.size } (${ Math.round( withName / available.size * 100 ) }%)` );
	console.log( `  Emoji with keywords: ${ withKeywords } / ${ available.size } (${ Math.round( withKeywords / available.size * 100 ) }%)` );

	// Report missing emoji
	const missing = [];
	for ( const codepoint of available ) {
		if ( !sorted[ codepoint ] ) {
			missing.push( codepoint );
		}
	}

	if ( missing.length > 0 && missing.length <= 50 ) {
		console.log( `\nMissing entries (${ missing.length }):` );
		console.log( '  ' + missing.join( ', ' ) );
	} else if ( missing.length > 50 ) {
		console.log( `\n${ missing.length } emoji still without names/keywords.` );
		console.log( 'These are likely rare symbols or regional indicators.' );
	} else {
		console.log( '\n✓ All emoji have names and keywords!' );
	}

	console.log( '\n=== Done ===' );
	console.log( 'Next step: Run "node generate-emoji-index.js" to regenerate the index.' );
}

main().catch( ( e ) => {
	console.error( 'Fatal error:', e );
	process.exit( 1 );
} );
