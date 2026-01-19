/**
 * Tests for FontConfig module
 *
 * FontConfig provides centralized font configuration for both the
 * floating toolbar and the properties panel.
 */

'use strict';

const FontConfig = require( '../../../resources/ext.layers.shared/FontConfig.js' );

describe( 'FontConfig', () => {
	beforeEach( () => {
		FontConfig.clearCache();
		// Clear any mw mock
		delete global.mw;
	} );

	afterEach( () => {
		FontConfig.clearCache();
	} );

	describe( 'DEFAULT_FONTS', () => {
		test( 'should be an array', () => {
			expect( Array.isArray( FontConfig.DEFAULT_FONTS ) ).toBe( true );
		} );

		test( 'should contain Arial as first font', () => {
			expect( FontConfig.DEFAULT_FONTS[ 0 ] ).toBe( 'Arial' );
		} );

		test( 'should contain standard web-safe fonts', () => {
			expect( FontConfig.DEFAULT_FONTS ).toContain( 'Arial' );
			expect( FontConfig.DEFAULT_FONTS ).toContain( 'Times New Roman' );
			expect( FontConfig.DEFAULT_FONTS ).toContain( 'Courier New' );
		} );
	} );

	describe( 'DEFAULT_FONT_FAMILY', () => {
		test( 'should be Arial with fallback', () => {
			expect( FontConfig.DEFAULT_FONT_FAMILY ).toBe( 'Arial, sans-serif' );
		} );
	} );

	describe( 'getFonts', () => {
		test( 'should return array of fonts', () => {
			const fonts = FontConfig.getFonts();
			expect( Array.isArray( fonts ) ).toBe( true );
			expect( fonts.length ).toBeGreaterThan( 0 );
		} );

		test( 'should return default fonts when mw is not available', () => {
			const fonts = FontConfig.getFonts();
			expect( fonts ).toEqual( FontConfig.DEFAULT_FONTS );
		} );

		test( 'should return copy of fonts to prevent mutation', () => {
			const fonts1 = FontConfig.getFonts();
			const fonts2 = FontConfig.getFonts();
			expect( fonts1 ).not.toBe( fonts2 );
			expect( fonts1 ).toEqual( fonts2 );
		} );

		test( 'should use mw.config when available', () => {
			global.mw = {
				config: {
					get: jest.fn().mockReturnValue( [ 'CustomFont', 'AnotherFont' ] )
				}
			};

			FontConfig.clearCache();
			const fonts = FontConfig.getFonts();

			expect( mw.config.get ).toHaveBeenCalledWith( 'LayersDefaultFonts' );
			expect( fonts ).toEqual( [ 'CustomFont', 'AnotherFont' ] );
		} );

		test( 'should fall back to defaults when mw.config returns empty array', () => {
			global.mw = {
				config: {
					get: jest.fn().mockReturnValue( [] )
				}
			};

			FontConfig.clearCache();
			const fonts = FontConfig.getFonts();

			expect( fonts ).toEqual( FontConfig.DEFAULT_FONTS );
		} );

		test( 'should fall back to defaults when mw.config returns null', () => {
			global.mw = {
				config: {
					get: jest.fn().mockReturnValue( null )
				}
			};

			FontConfig.clearCache();
			const fonts = FontConfig.getFonts();

			expect( fonts ).toEqual( FontConfig.DEFAULT_FONTS );
		} );

		test( 'should cache fonts after first call', () => {
			global.mw = {
				config: {
					get: jest.fn().mockReturnValue( [ 'CachedFont' ] )
				}
			};

			FontConfig.clearCache();
			FontConfig.getFonts();
			FontConfig.getFonts();
			FontConfig.getFonts();

			// Should only call mw.config.get once
			expect( mw.config.get ).toHaveBeenCalledTimes( 1 );
		} );
	} );

	describe( 'getFontOptions', () => {
		test( 'should return array of option objects', () => {
			const options = FontConfig.getFontOptions();
			expect( Array.isArray( options ) ).toBe( true );
			expect( options.length ).toBeGreaterThan( 0 );
		} );

		test( 'should have value and text properties', () => {
			const options = FontConfig.getFontOptions();
			options.forEach( ( option ) => {
				expect( option ).toHaveProperty( 'value' );
				expect( option ).toHaveProperty( 'text' );
				expect( option.value ).toBe( option.text );
			} );
		} );

		test( 'should match getFonts output', () => {
			const fonts = FontConfig.getFonts();
			const options = FontConfig.getFontOptions();

			expect( options.length ).toBe( fonts.length );
			options.forEach( ( option, index ) => {
				expect( option.value ).toBe( fonts[ index ] );
			} );
		} );
	} );

	describe( 'getDefaultFontFamily', () => {
		test( 'should return default font family', () => {
			expect( FontConfig.getDefaultFontFamily() ).toBe( 'Arial, sans-serif' );
		} );
	} );

	describe( 'normalizeFontFamily', () => {
		test( 'should return Arial for null', () => {
			expect( FontConfig.normalizeFontFamily( null ) ).toBe( 'Arial' );
		} );

		test( 'should return Arial for undefined', () => {
			expect( FontConfig.normalizeFontFamily( undefined ) ).toBe( 'Arial' );
		} );

		test( 'should return Arial for empty string', () => {
			expect( FontConfig.normalizeFontFamily( '' ) ).toBe( 'Arial' );
		} );

		test( 'should return Arial for non-string', () => {
			expect( FontConfig.normalizeFontFamily( 123 ) ).toBe( 'Arial' );
			expect( FontConfig.normalizeFontFamily( {} ) ).toBe( 'Arial' );
		} );

		test( 'should extract primary font from font stack', () => {
			expect( FontConfig.normalizeFontFamily( 'Arial, sans-serif' ) ).toBe( 'Arial' );
			expect( FontConfig.normalizeFontFamily( 'Times New Roman, serif' ) ).toBe( 'Times New Roman' );
		} );

		test( 'should remove quotes', () => {
			expect( FontConfig.normalizeFontFamily( '"Arial"' ) ).toBe( 'Arial' );
			expect( FontConfig.normalizeFontFamily( "'Times New Roman'" ) ).toBe( 'Times New Roman' );
		} );

		test( 'should handle font with multiple fallbacks', () => {
			expect( FontConfig.normalizeFontFamily( 'Georgia, Times, serif' ) ).toBe( 'Georgia' );
		} );

		test( 'should trim whitespace', () => {
			expect( FontConfig.normalizeFontFamily( '  Arial  ' ) ).toBe( 'Arial' );
		} );
	} );

	describe( 'isFontAvailable', () => {
		test( 'should return true for fonts in the list', () => {
			expect( FontConfig.isFontAvailable( 'Arial' ) ).toBe( true );
			expect( FontConfig.isFontAvailable( 'Times New Roman' ) ).toBe( true );
		} );

		test( 'should return false for fonts not in the list', () => {
			expect( FontConfig.isFontAvailable( 'Comic Sans MS' ) ).toBe( false );
			expect( FontConfig.isFontAvailable( 'Unknown Font' ) ).toBe( false );
		} );

		test( 'should be case-insensitive', () => {
			expect( FontConfig.isFontAvailable( 'arial' ) ).toBe( true );
			expect( FontConfig.isFontAvailable( 'ARIAL' ) ).toBe( true );
		} );

		test( 'should handle font stacks', () => {
			expect( FontConfig.isFontAvailable( 'Arial, sans-serif' ) ).toBe( true );
		} );
	} );

	describe( 'getValidFont', () => {
		test( 'should return the font if it is in the list', () => {
			expect( FontConfig.getValidFont( 'Arial' ) ).toBe( 'Arial' );
			expect( FontConfig.getValidFont( 'Times New Roman' ) ).toBe( 'Times New Roman' );
		} );

		test( 'should return first font as fallback', () => {
			const fonts = FontConfig.getFonts();
			expect( FontConfig.getValidFont( 'Unknown Font' ) ).toBe( fonts[ 0 ] );
		} );

		test( 'should handle font stacks', () => {
			expect( FontConfig.getValidFont( 'Arial, sans-serif' ) ).toBe( 'Arial' );
		} );

		test( 'should be case-insensitive', () => {
			expect( FontConfig.getValidFont( 'arial' ) ).toBe( 'Arial' );
		} );
	} );

	describe( 'findMatchingFont', () => {
		test( 'should find exact match', () => {
			expect( FontConfig.findMatchingFont( 'Arial' ) ).toBe( 'Arial' );
			expect( FontConfig.findMatchingFont( 'Times New Roman' ) ).toBe( 'Times New Roman' );
		} );

		test( 'should find match from font stack', () => {
			expect( FontConfig.findMatchingFont( 'Arial, sans-serif' ) ).toBe( 'Arial' );
		} );

		test( 'should be case-insensitive', () => {
			expect( FontConfig.findMatchingFont( 'arial' ) ).toBe( 'Arial' );
			expect( FontConfig.findMatchingFont( 'TIMES NEW ROMAN' ) ).toBe( 'Times New Roman' );
		} );

		test( 'should return first font for unknown font', () => {
			const fonts = FontConfig.getFonts();
			expect( FontConfig.findMatchingFont( 'Unknown Font' ) ).toBe( fonts[ 0 ] );
		} );

		test( 'should handle partial matches', () => {
			// If the font includes part of a known font name
			expect( FontConfig.findMatchingFont( 'Arial Black' ) ).toBe( 'Arial' );
		} );
	} );

	describe( 'clearCache', () => {
		test( 'should clear the cached fonts', () => {
			global.mw = {
				config: {
					get: jest.fn().mockReturnValue( [ 'FirstCall' ] )
				}
			};

			FontConfig.clearCache();
			FontConfig.getFonts();

			// Change what config returns
			mw.config.get.mockReturnValue( [ 'SecondCall' ] );

			// Without clearing cache, should still get first value
			expect( FontConfig.getFonts() ).toEqual( [ 'FirstCall' ] );

			// After clearing, should get new value
			FontConfig.clearCache();
			expect( FontConfig.getFonts() ).toEqual( [ 'SecondCall' ] );
		} );
	} );

	describe( 'module exports', () => {
		test( 'should export all expected functions', () => {
			expect( typeof FontConfig.getFonts ).toBe( 'function' );
			expect( typeof FontConfig.getFontOptions ).toBe( 'function' );
			expect( typeof FontConfig.getDefaultFontFamily ).toBe( 'function' );
			expect( typeof FontConfig.normalizeFontFamily ).toBe( 'function' );
			expect( typeof FontConfig.isFontAvailable ).toBe( 'function' );
			expect( typeof FontConfig.getValidFont ).toBe( 'function' );
			expect( typeof FontConfig.findMatchingFont ).toBe( 'function' );
			expect( typeof FontConfig.clearCache ).toBe( 'function' );
		} );

		test( 'should export constants', () => {
			expect( Array.isArray( FontConfig.DEFAULT_FONTS ) ).toBe( true );
			expect( typeof FontConfig.DEFAULT_FONT_FAMILY ).toBe( 'string' );
		} );
	} );
} );

describe( 'FontConfig browser export', () => {
	beforeEach( () => {
		// Reset window.Layers
		delete window.Layers;
		FontConfig.clearCache();
	} );

	test( 'should export to window.Layers.FontConfig', () => {
		// Re-require to trigger browser export
		jest.resetModules();
		require( '../../../resources/ext.layers.shared/FontConfig.js' );

		expect( window.Layers ).toBeDefined();
		expect( window.Layers.FontConfig ).toBeDefined();
		expect( typeof window.Layers.FontConfig.getFonts ).toBe( 'function' );
	} );
} );
