#!/usr/bin/env node
/**
 * Download Google Fonts for Layers Extension
 *
 * This script downloads STATIC WOFF2 font files from Google Webfonts Helper
 * (https://gwfh.mranftl.com/) which provides individual files per weight,
 * unlike Google Fonts API v2 which returns variable fonts.
 *
 * Usage: node scripts/download-fonts.js
 *
 * All fonts are under the Open Font License (OFL) and free to redistribute.
 */

'use strict';

const https = require( 'https' );
const fs = require( 'fs' );
const path = require( 'path' );

// Font configuration - organized by category
// Font IDs must match google-webfonts-helper format (lowercase, hyphenated)
const FONTS = {
	// Sans-serif fonts
	'sans-serif': [
		{ name: 'Roboto', id: 'roboto' },
		{ name: 'Open Sans', id: 'open-sans' },
		{ name: 'Lato', id: 'lato' },
		{ name: 'Montserrat', id: 'montserrat' },
		{ name: 'Noto Sans', id: 'noto-sans' },
		{ name: 'Source Sans 3', id: 'source-sans-3' },
		{ name: 'PT Sans', id: 'pt-sans' },
		{ name: 'Ubuntu', id: 'ubuntu' },
		{ name: 'Inter', id: 'inter' },
		{ name: 'Poppins', id: 'poppins' },
		{ name: 'Work Sans', id: 'work-sans' },
		{ name: 'Nunito', id: 'nunito' },
		{ name: 'Raleway', id: 'raleway' },
		{ name: 'DM Sans', id: 'dm-sans' }
	],
	// Serif fonts
	serif: [
		{ name: 'Merriweather', id: 'merriweather' },
		{ name: 'Playfair Display', id: 'playfair-display' },
		{ name: 'Lora', id: 'lora' },
		{ name: 'Libre Baskerville', id: 'libre-baskerville' },
		{ name: 'EB Garamond', id: 'eb-garamond' },
		{ name: 'Crimson Text', id: 'crimson-text' }
	],
	// Display fonts
	display: [
		{ name: 'Bebas Neue', id: 'bebas-neue' },
		{ name: 'Oswald', id: 'oswald' },
		{ name: 'Archivo Black', id: 'archivo-black' },
		{ name: 'Fredoka', id: 'fredoka' }
	],
	// Handwriting fonts
	handwriting: [
		{ name: 'Caveat', id: 'caveat' },
		{ name: 'Dancing Script', id: 'dancing-script' },
		{ name: 'Pacifico', id: 'pacifico' },
		{ name: 'Indie Flower', id: 'indie-flower' }
	],
	// Monospace fonts
	monospace: [
		{ name: 'Source Code Pro', id: 'source-code-pro' },
		{ name: 'Fira Code', id: 'fira-code' },
		{ name: 'JetBrains Mono', id: 'jetbrains-mono' },
		{ name: 'IBM Plex Mono', id: 'ibm-plex-mono' }
	]
};

// Variants we want to download
// Format matches google-webfonts-helper variant IDs
const WANTED_VARIANTS = [ '400', '400italic', '700', '700italic', 'regular', 'italic' ];

// Output directory
const OUTPUT_DIR = path.join( __dirname, '..', 'resources', 'ext.layers.shared', 'fonts' );

/**
 * Create directory if it doesn't exist
 * @param {string} dir - Directory path
 */
function ensureDir( dir ) {
	if ( !fs.existsSync( dir ) ) {
		fs.mkdirSync( dir, { recursive: true } );
		console.log( `Created directory: ${ dir }` );
	}
}

/**
 * Download a file from URL
 * @param {string} url - URL to download
 * @param {string} dest - Destination file path
 * @return {Promise<void>}
 */
function downloadFile( url, dest ) {
	return new Promise( ( resolve, reject ) => {
		const file = fs.createWriteStream( dest );
		https.get( url, ( response ) => {
			if ( response.statusCode === 302 || response.statusCode === 301 ) {
				// Follow redirect
				downloadFile( response.headers.location, dest )
					.then( resolve )
					.catch( reject );
				return;
			}
			if ( response.statusCode !== 200 ) {
				reject( new Error( `HTTP ${ response.statusCode } for ${ url }` ) );
				return;
			}
			response.pipe( file );
			file.on( 'finish', () => {
				file.close();
				resolve();
			} );
		} ).on( 'error', ( err ) => {
			fs.unlink( dest, () => {} );
			reject( err );
		} );
	} );
}

/**
 * Fetch font metadata from Google Webfonts Helper API
 * @param {string} fontId - Font ID (e.g., 'roboto', 'open-sans')
 * @return {Promise<Object>}
 */
function fetchFontMetadata( fontId ) {
	return new Promise( ( resolve, reject ) => {
		const url = `https://gwfh.mranftl.com/api/fonts/${ fontId }?subsets=latin`;

		https.get( url, ( response ) => {
			if ( response.statusCode !== 200 ) {
				reject( new Error( `HTTP ${ response.statusCode } for ${ fontId }` ) );
				return;
			}
			let data = '';
			response.on( 'data', ( chunk ) => {
				data += chunk;
			} );
			response.on( 'end', () => {
				try {
					resolve( JSON.parse( data ) );
				} catch ( e ) {
					reject( new Error( `Invalid JSON for ${ fontId }` ) );
				}
			} );
		} ).on( 'error', reject );
	} );
}

/**
 * Normalize variant ID to weight and style
 * @param {string} variantId - Variant ID like '400', '400italic', 'regular', 'italic'
 * @return {Object} { weight: number, style: string }
 */
function normalizeVariant( variantId ) {
	// Handle 'regular' and 'italic' aliases
	if ( variantId === 'regular' ) {
		return { weight: 400, style: 'normal' };
	}
	if ( variantId === 'italic' ) {
		return { weight: 400, style: 'italic' };
	}

	const isItalic = variantId.includes( 'italic' );
	const weight = parseInt( variantId.replace( 'italic', '' ), 10 ) || 400;

	return {
		weight: weight,
		style: isItalic ? 'italic' : 'normal'
	};
}

/**
 * Generate filename for font file
 * @param {string} fontId - Font ID
 * @param {number} weight - Font weight
 * @param {string} style - Font style
 * @return {string}
 */
function generateFilename( fontId, weight, style ) {
	const weightName = weight === 400 ? 'regular' : weight === 700 ? 'bold' : String( weight );
	const styleSuffix = style === 'italic' ? '-italic' : '';
	return `${ fontId }-${ weightName }${ styleSuffix }.woff2`;
}

/**
 * Download all fonts
 */
async function downloadAllFonts() {
	console.log( 'Downloading STATIC fonts for Layers extension...\n' );
	console.log( 'Using Google Webfonts Helper API for individual weight files.\n' );

	ensureDir( OUTPUT_DIR );

	const allFonts = [];
	let successCount = 0;
	let errorCount = 0;
	let skippedCount = 0;

	for ( const [ category, fonts ] of Object.entries( FONTS ) ) {
		console.log( `\n=== ${ category.toUpperCase() } ===\n` );

		for ( const font of fonts ) {
			console.log( `Fetching ${ font.name }...` );

			try {
				const metadata = await fetchFontMetadata( font.id );

				if ( !metadata.variants || metadata.variants.length === 0 ) {
					console.log( `  ⚠ No variants available for ${ font.name }` );
					errorCount++;
					continue;
				}

				// Filter to wanted variants
				const wantedVariants = metadata.variants.filter( ( v ) =>
					WANTED_VARIANTS.includes( v.id )
				);

				if ( wantedVariants.length === 0 ) {
					console.log( `  ⚠ No matching variants for ${ font.name }` );
					console.log( `    Available: ${ metadata.variants.map( ( v ) => v.id ).join( ', ' ) }` );
					errorCount++;
					continue;
				}

				for ( const variant of wantedVariants ) {
					if ( !variant.woff2 ) {
						console.log( `  ⚠ No woff2 for ${ variant.id }` );
						continue;
					}

					const { weight, style } = normalizeVariant( variant.id );
					const filename = generateFilename( font.id, weight, style );
					const destPath = path.join( OUTPUT_DIR, filename );

					// Skip if already exists (and is not empty)
					if ( fs.existsSync( destPath ) && fs.statSync( destPath ).size > 0 ) {
						console.log( `  ✓ ${ filename } (cached)` );
						allFonts.push( {
							name: font.name,
							id: font.id,
							weight: weight,
							style: style,
							filename: filename,
							category: category
						} );
						skippedCount++;
						continue;
					}

					try {
						await downloadFile( variant.woff2, destPath );
						console.log( `  ✓ ${ filename }` );
						allFonts.push( {
							name: font.name,
							id: font.id,
							weight: weight,
							style: style,
							filename: filename,
							category: category
						} );
						successCount++;
					} catch ( err ) {
						console.log( `  ✗ ${ filename }: ${ err.message }` );
						errorCount++;
					}
				}
			} catch ( err ) {
				console.log( `  ✗ Failed to fetch ${ font.name }: ${ err.message }` );
				errorCount++;
			}
		}
	}

	// Generate CSS file
	console.log( '\n\nGenerating fonts.css...' );
	generateCSS( allFonts );

	// Print summary
	console.log( `\n✓ Downloaded ${ successCount } new font files` );
	if ( skippedCount > 0 ) {
		console.log( `✓ ${ skippedCount } files already cached` );
	}
	if ( errorCount > 0 ) {
		console.log( `✗ ${ errorCount } errors` );
	}
	console.log( `\n${ allFonts.length } total font variants` );
	console.log( `Fonts saved to: ${ OUTPUT_DIR }` );
}

/**
 * Generate CSS file with @font-face declarations
 * @param {Array<Object>} fonts - Font metadata
 */
function generateCSS( fonts ) {
	let css = `/**
 * Self-hosted Web Fonts for Layers Extension
 *
 * Static font files downloaded from Google Webfonts Helper.
 * All fonts are licensed under the Open Font License (OFL).
 *
 * Generated by: node scripts/download-fonts.js
 * Generated on: ${ new Date().toISOString().split( 'T' )[ 0 ] }
 */

`;

	// Group by font name for organized output
	const byName = {};
	for ( const font of fonts ) {
		if ( !byName[ font.name ] ) {
			byName[ font.name ] = [];
		}
		byName[ font.name ].push( font );
	}

	for ( const [ name, variants ] of Object.entries( byName ) ) {
		css += `/* ${ name } */\n`;
		// Sort by weight then style for consistent output
		variants.sort( ( a, b ) => {
			if ( a.weight !== b.weight ) {
				return a.weight - b.weight;
			}
			// normal before italic
			return a.style === 'normal' ? -1 : 1;
		} );

		for ( const font of variants ) {
			css += `@font-face {
	font-family: '${ name }';
	font-style: ${ font.style };
	font-weight: ${ font.weight };
	font-display: swap;
	src: url('fonts/${ font.filename }') format('woff2');
}
`;
		}
		css += '\n';
	}

	const cssPath = path.join( OUTPUT_DIR, '..', 'fonts.css' );
	fs.writeFileSync( cssPath, css );
	console.log( `Generated: ${ cssPath }` );
}

// Run
downloadAllFonts().catch( ( err ) => {
	console.error( 'Fatal error:', err );
	process.exit( 1 );
} );
