/**
 * Centralized Font Configuration for Layers Extension
 *
 * This module provides a single source of truth for available fonts
 * across both the floating toolbar (InlineTextEditor) and the properties
 * panel (PropertyBuilders).
 *
 * Fonts are loaded from MediaWiki config ($wgLayersDefaultFonts) with
 * sensible fallbacks. All font-related UI should use this module to
 * ensure consistency.
 *
 * As of v1.5.47, fonts are self-hosted WOFF2 files bundled with the extension.
 * This ensures privacy (no Google Fonts tracking), reliability (no external
 * dependencies), and consistency (fonts always available).
 *
 * @module FontConfig
 */
'use strict';

/**
 * Default fonts used when MediaWiki config is not available.
 * This list should match $wgLayersDefaultFonts in extension.json.
 *
 * Fonts are organized by category (32 self-hosted fonts + 4 system fonts):
 * - System fonts (Arial, Verdana, Times New Roman, Courier New)
 * - Sans-serif (14): Roboto, Open Sans, Lato, Montserrat, Noto Sans, etc.
 * - Serif (6): Merriweather, Playfair Display, Lora, Libre Baskerville, etc.
 * - Display (4): Bebas Neue, Oswald, Archivo Black, Fredoka One
 * - Handwriting (4): Caveat, Dancing Script, Pacifico, Indie Flower
 * - Monospace (4): Source Code Pro, Fira Code, JetBrains Mono, IBM Plex Mono
 *
 * All Google Fonts are self-hosted WOFF2 files under OFL license.
 *
 * @type {string[]}
 */
const DEFAULT_FONTS = [
	// === SYSTEM FONTS (always available) ===
	'Arial',
	'Verdana',
	'Times New Roman',
	'Courier New',

	// === SANS-SERIF (14 self-hosted fonts) ===
	'Roboto',
	'Open Sans',
	'Lato',
	'Montserrat',
	'Noto Sans',
	'Source Sans 3',
	'PT Sans',
	'Ubuntu',
	'Inter',
	'Poppins',
	'Work Sans',
	'Nunito',
	'Raleway',
	'DM Sans',

	// === SERIF (6 self-hosted fonts) ===
	'Merriweather',
	'Playfair Display',
	'Lora',
	'Libre Baskerville',
	'EB Garamond',
	'Crimson Text',

	// === DISPLAY (4 self-hosted fonts) ===
	'Bebas Neue',
	'Oswald',
	'Archivo Black',
	'Fredoka',

	// === HANDWRITING (4 self-hosted fonts) ===
	'Caveat',
	'Dancing Script',
	'Pacifico',
	'Indie Flower',

	// === MONOSPACE (4 self-hosted fonts) ===
	'Source Code Pro',
	'Fira Code',
	'JetBrains Mono',
	'IBM Plex Mono'
];

/**
 * Default font family for new text layers
 *
 * @type {string}
 */
const DEFAULT_FONT_FAMILY = 'Arial, sans-serif';

/**
 * Cache for the fonts list (loaded once from config)
 *
 * @type {string[]|null}
 */
let cachedFonts = null;

/**
 * Get the list of available fonts.
 *
 * Attempts to load from MediaWiki config ($wgLayersDefaultFonts).
 * Falls back to DEFAULT_FONTS if config is unavailable.
 *
 * @return {string[]} Array of font family names
 */
function getFonts() {
	if ( cachedFonts !== null ) {
		return cachedFonts.slice(); // Return copy to prevent mutation
	}

	// Try to get from MediaWiki config
	if ( typeof mw !== 'undefined' && mw.config ) {
		const configFonts = mw.config.get( 'LayersDefaultFonts' );
		if ( Array.isArray( configFonts ) && configFonts.length > 0 ) {
			cachedFonts = configFonts;
			return cachedFonts.slice();
		}
	}

	// Fall back to defaults
	cachedFonts = DEFAULT_FONTS;
	return cachedFonts.slice();
}

/**
 * Get font options formatted for dropdown/select elements.
 *
 * @return {Array<{value: string, text: string}>} Array of option objects
 */
function getFontOptions() {
	return getFonts().map( ( font ) => ( { value: font, text: font } ) );
}

/**
 * Get the default font family for new text layers.
 *
 * @return {string} Default font family with fallback
 */
function getDefaultFontFamily() {
	return DEFAULT_FONT_FAMILY;
}

/**
 * Normalize a font family value.
 *
 * Handles values like "Arial, sans-serif" by extracting the primary font,
 * and validates against the available fonts list.
 *
 * @param {string} fontFamily - Font family value to normalize
 * @return {string} Normalized font family (primary font name)
 */
function normalizeFontFamily( fontFamily ) {
	if ( !fontFamily || typeof fontFamily !== 'string' ) {
		return 'Arial';
	}

	// Extract primary font (before comma)
	const primary = fontFamily.split( ',' )[ 0 ].trim();

	// Remove quotes if present
	const normalized = primary.replace( /['"]/g, '' );

	return normalized || 'Arial';
}

/**
 * Check if a font is in the available fonts list.
 *
 * @param {string} fontFamily - Font family to check
 * @return {boolean} True if font is available
 */
function isFontAvailable( fontFamily ) {
	const fonts = getFonts();
	const normalized = normalizeFontFamily( fontFamily );
	return fonts.some( ( font ) => font.toLowerCase() === normalized.toLowerCase() );
}

/**
 * Get a valid font from the list, or the first available font.
 *
 * @param {string} fontFamily - Preferred font family
 * @return {string} A valid font from the available list
 */
function getValidFont( fontFamily ) {
	const fonts = getFonts();
	const normalized = normalizeFontFamily( fontFamily );

	// Check if the normalized font is in the list
	const matchIndex = fonts.findIndex( ( font ) => font.toLowerCase() === normalized.toLowerCase() );

	if ( matchIndex !== -1 ) {
		return fonts[ matchIndex ];
	}

	// Return first available font as fallback
	return fonts[ 0 ] || 'Arial';
}

/**
 * Find the matching font in the available list for selection purposes.
 *
 * Useful for determining which option to select in a dropdown.
 *
 * @param {string} fontFamily - Current layer font family
 * @return {string} The matching font from the list, or first font
 */
function findMatchingFont( fontFamily ) {
	const fonts = getFonts();
	const normalized = normalizeFontFamily( fontFamily );

	// Look for exact match
	for ( let i = 0; i < fonts.length; i++ ) {
		if ( fonts[ i ].toLowerCase() === normalized.toLowerCase() ) {
			return fonts[ i ];
		}
	}

	// Look for partial match (e.g., "Arial" matches "Arial, sans-serif")
	for ( let i = 0; i < fonts.length; i++ ) {
		if ( normalized.toLowerCase().includes( fonts[ i ].toLowerCase() ) ||
			fonts[ i ].toLowerCase().includes( normalized.toLowerCase() ) ) {
			return fonts[ i ];
		}
	}

	// Return first font as fallback
	return fonts[ 0 ] || 'Arial';
}

/**
 * Clear the cached fonts (for testing purposes)
 */
function clearCache() {
	cachedFonts = null;
}

// Export for CommonJS (Node.js/Jest)
if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = {
		getFonts,
		getFontOptions,
		getDefaultFontFamily,
		normalizeFontFamily,
		isFontAvailable,
		getValidFont,
		findMatchingFont,
		clearCache,
		DEFAULT_FONTS,
		DEFAULT_FONT_FAMILY
	};
}

// Export for browser (MediaWiki ResourceLoader)
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.FontConfig = {
		getFonts: getFonts,
		getFontOptions: getFontOptions,
		getDefaultFontFamily: getDefaultFontFamily,
		normalizeFontFamily: normalizeFontFamily,
		isFontAvailable: isFontAvailable,
		getValidFont: getValidFont,
		findMatchingFont: findMatchingFont,
		clearCache: clearCache,
		DEFAULT_FONTS: DEFAULT_FONTS,
		DEFAULT_FONT_FAMILY: DEFAULT_FONT_FAMILY
	};
}
