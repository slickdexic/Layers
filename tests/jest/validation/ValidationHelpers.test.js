'use strict';

/**
 * Tests for ValidationHelpers utility class
 *
 * @jest-environment jsdom
 */

describe( 'ValidationHelpers', () => {
	let ValidationHelpers;

	beforeAll( () => {
		// Set up MediaWiki mocks
		global.mw = {
			message: jest.fn( ( key ) => ( {
				text: jest.fn( () => `Mocked: ${ key }` ),
				params: jest.fn().mockReturnThis(),
				exists: jest.fn( () => true )
			} ) )
		};

		// Load the module
		require( '../../../resources/ext.layers.editor/validation/ValidationHelpers.js' );
		ValidationHelpers = window.Layers.Validation.ValidationHelpers;
	} );

	afterAll( () => {
		delete global.mw;
	} );

	describe( 'isValidNumber', () => {
		test( 'returns true for valid integers', () => {
			expect( ValidationHelpers.isValidNumber( 0 ) ).toBe( true );
			expect( ValidationHelpers.isValidNumber( 1 ) ).toBe( true );
			expect( ValidationHelpers.isValidNumber( -1 ) ).toBe( true );
			expect( ValidationHelpers.isValidNumber( 100 ) ).toBe( true );
		} );

		test( 'returns true for valid floats', () => {
			expect( ValidationHelpers.isValidNumber( 0.5 ) ).toBe( true );
			expect( ValidationHelpers.isValidNumber( 3.14159 ) ).toBe( true );
			expect( ValidationHelpers.isValidNumber( -0.001 ) ).toBe( true );
		} );

		test( 'returns false for numeric strings (strict number type required)', () => {
			// Implementation requires typeof number, not just numeric strings
			expect( ValidationHelpers.isValidNumber( '42' ) ).toBe( false );
			expect( ValidationHelpers.isValidNumber( '3.14' ) ).toBe( false );
			expect( ValidationHelpers.isValidNumber( '-100' ) ).toBe( false );
		} );

		test( 'returns false for NaN', () => {
			expect( ValidationHelpers.isValidNumber( NaN ) ).toBe( false );
		} );

		test( 'returns false for Infinity', () => {
			expect( ValidationHelpers.isValidNumber( Infinity ) ).toBe( false );
			expect( ValidationHelpers.isValidNumber( -Infinity ) ).toBe( false );
		} );

		test( 'returns false for non-numeric values', () => {
			expect( ValidationHelpers.isValidNumber( null ) ).toBe( false );
			expect( ValidationHelpers.isValidNumber( undefined ) ).toBe( false );
			expect( ValidationHelpers.isValidNumber( 'abc' ) ).toBe( false );
			expect( ValidationHelpers.isValidNumber( {} ) ).toBe( false );
			expect( ValidationHelpers.isValidNumber( [] ) ).toBe( false );
			expect( ValidationHelpers.isValidNumber( '' ) ).toBe( false );
		} );
	} );

	describe( 'isValidColor', () => {
		test( 'returns true for hex colors', () => {
			expect( ValidationHelpers.isValidColor( '#fff' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( '#FFF' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( '#ffffff' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( '#FFFFFF' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( '#000000' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( '#aAbBcC' ) ).toBe( true );
		} );

		test( 'returns true for 8-digit hex colors with alpha', () => {
			expect( ValidationHelpers.isValidColor( '#ffffffff' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( '#00000000' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( '#ff000080' ) ).toBe( true );
		} );

		test( 'returns true for rgb() format', () => {
			expect( ValidationHelpers.isValidColor( 'rgb(255, 255, 255)' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'rgb(0, 0, 0)' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'rgb(100,100,100)' ) ).toBe( true );
		} );

		test( 'returns true for rgba() format', () => {
			expect( ValidationHelpers.isValidColor( 'rgba(255, 255, 255, 1)' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'rgba(0, 0, 0, 0.5)' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'rgba(100,100,100,0)' ) ).toBe( true );
		} );

		test( 'returns true for hsl() format', () => {
			expect( ValidationHelpers.isValidColor( 'hsl(360, 100%, 50%)' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'hsl(0, 0%, 0%)' ) ).toBe( true );
		} );

		test( 'returns true for hsla() format', () => {
			expect( ValidationHelpers.isValidColor( 'hsla(360, 100%, 50%, 1)' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'hsla(0, 0%, 0%, 0.5)' ) ).toBe( true );
		} );

		test( 'returns true for safe named colors', () => {
			expect( ValidationHelpers.isValidColor( 'red' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'blue' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'green' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'black' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'white' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'transparent' ) ).toBe( true );
		} );

		test( 'returns true for safe named colors case-insensitive', () => {
			expect( ValidationHelpers.isValidColor( 'RED' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'Blue' ) ).toBe( true );
			expect( ValidationHelpers.isValidColor( 'GREEN' ) ).toBe( true );
		} );

		test( 'returns false for invalid hex colors', () => {
			expect( ValidationHelpers.isValidColor( '#gggggg' ) ).toBe( false );
		} );

		test( 'returns false for rgb out of range', () => {
			expect( ValidationHelpers.isValidColor( 'rgb(300, 300, 300)' ) ).toBe( false );
		} );

		test( 'returns false for unknown named colors', () => {
			expect( ValidationHelpers.isValidColor( 'notacolor' ) ).toBe( false );
		} );

		test( 'returns false for url() values', () => {
			expect( ValidationHelpers.isValidColor( 'url(evil)' ) ).toBe( false );
		} );

		test( 'returns false for non-string values', () => {
			expect( ValidationHelpers.isValidColor( null ) ).toBe( false );
			expect( ValidationHelpers.isValidColor( undefined ) ).toBe( false );
			expect( ValidationHelpers.isValidColor( 123 ) ).toBe( false );
			expect( ValidationHelpers.isValidColor( {} ) ).toBe( false );
		} );

		test( 'returns false for potentially dangerous values', () => {
			expect( ValidationHelpers.isValidColor( 'javascript:alert(1)' ) ).toBe( false );
		} );
	} );

	describe( 'containsScriptInjection', () => {
		test( 'returns true for javascript: protocol', () => {
			expect( ValidationHelpers.containsScriptInjection( 'javascript:alert(1)' ) ).toBe( true );
			expect( ValidationHelpers.containsScriptInjection( 'JAVASCRIPT:alert(1)' ) ).toBe( true );
		} );

		test( 'returns true for data: protocol', () => {
			expect( ValidationHelpers.containsScriptInjection( 'data:text/html,<script>' ) ).toBe( true );
			expect( ValidationHelpers.containsScriptInjection( 'DATA:text/html' ) ).toBe( true );
		} );

		test( 'returns true for vbscript: protocol', () => {
			expect( ValidationHelpers.containsScriptInjection( 'vbscript:msgbox' ) ).toBe( true );
		} );

		test( 'returns true for script tags', () => {
			expect( ValidationHelpers.containsScriptInjection( '<script>alert(1)</script>' ) ).toBe( true );
			expect( ValidationHelpers.containsScriptInjection( '<SCRIPT SRC="evil.js">' ) ).toBe( true );
		} );

		test( 'returns true for event handlers', () => {
			expect( ValidationHelpers.containsScriptInjection( 'onerror=alert(1)' ) ).toBe( true );
			expect( ValidationHelpers.containsScriptInjection( 'onclick=evil()' ) ).toBe( true );
			expect( ValidationHelpers.containsScriptInjection( 'onload=hack()' ) ).toBe( true );
		} );

		test( 'returns false for safe text', () => {
			expect( ValidationHelpers.containsScriptInjection( 'Hello World' ) ).toBe( false );
			expect( ValidationHelpers.containsScriptInjection( 'Normal annotation text' ) ).toBe( false );
			expect( ValidationHelpers.containsScriptInjection( 'https://example.com' ) ).toBe( false );
		} );

		test( 'returns false for non-string values', () => {
			expect( ValidationHelpers.containsScriptInjection( null ) ).toBe( false );
			expect( ValidationHelpers.containsScriptInjection( undefined ) ).toBe( false );
			expect( ValidationHelpers.containsScriptInjection( 123 ) ).toBe( false );
		} );
	} );

	describe( 'getMessage', () => {
		test( 'uses mw.message when available', () => {
			const result = ValidationHelpers.getMessage( 'layers-validation-type-invalid' );
			expect( global.mw.message ).toHaveBeenCalledWith( 'layers-validation-type-invalid' );
			expect( result ).toBe( 'Mocked: layers-validation-type-invalid' );
		} );

		test( 'returns key when no fallback exists for unknown keys', () => {
			const originalMw = global.mw;
			delete global.mw;

			const result = ValidationHelpers.getMessage( 'nonexistent-key' );
			expect( result ).toBe( 'nonexistent-key' );

			global.mw = originalMw;
		} );
	} );

	describe( 'validateNumberRange', () => {
		test( 'returns isValid true for value within range', () => {
			expect( ValidationHelpers.validateNumberRange( 50, 0, 100 ).isValid ).toBe( true );
			expect( ValidationHelpers.validateNumberRange( 0, 0, 100 ).isValid ).toBe( true );
			expect( ValidationHelpers.validateNumberRange( 100, 0, 100 ).isValid ).toBe( true );
		} );

		test( 'returns isValid false for value below min', () => {
			expect( ValidationHelpers.validateNumberRange( -1, 0, 100 ).isValid ).toBe( false );
			expect( ValidationHelpers.validateNumberRange( -100, 0, 100 ).isValid ).toBe( false );
		} );

		test( 'returns isValid false for value above max', () => {
			expect( ValidationHelpers.validateNumberRange( 101, 0, 100 ).isValid ).toBe( false );
			expect( ValidationHelpers.validateNumberRange( 1000, 0, 100 ).isValid ).toBe( false );
		} );

		test( 'returns isValid false for non-numeric values', () => {
			expect( ValidationHelpers.validateNumberRange( 'abc', 0, 100 ).isValid ).toBe( false );
			expect( ValidationHelpers.validateNumberRange( null, 0, 100 ).isValid ).toBe( false );
		} );

		test( 'returns numericValue for valid values', () => {
			expect( ValidationHelpers.validateNumberRange( 50, 0, 100 ).numericValue ).toBe( 50 );
		} );

		test( 'returns numericValue null for invalid values', () => {
			expect( ValidationHelpers.validateNumberRange( 'abc', 0, 100 ).numericValue ).toBe( null );
		} );
	} );

	describe( 'isValidInteger', () => {
		test( 'returns true for valid integers', () => {
			expect( ValidationHelpers.isValidInteger( 0 ) ).toBe( true );
			expect( ValidationHelpers.isValidInteger( 1 ) ).toBe( true );
			expect( ValidationHelpers.isValidInteger( -1 ) ).toBe( true );
			expect( ValidationHelpers.isValidInteger( 1000000 ) ).toBe( true );
		} );

		test( 'returns false for floats', () => {
			expect( ValidationHelpers.isValidInteger( 3.14 ) ).toBe( false );
			expect( ValidationHelpers.isValidInteger( 0.5 ) ).toBe( false );
		} );

		test( 'returns false for non-numeric values', () => {
			expect( ValidationHelpers.isValidInteger( 'abc' ) ).toBe( false );
			expect( ValidationHelpers.isValidInteger( null ) ).toBe( false );
			expect( ValidationHelpers.isValidInteger( {} ) ).toBe( false );
			// Numeric strings are not valid numbers by isValidNumber
			expect( ValidationHelpers.isValidInteger( '42' ) ).toBe( false );
		} );
	} );

	describe( 'SAFE_COLORS constant', () => {
		test( 'includes common color names', () => {
			expect( ValidationHelpers.SAFE_COLORS ).toContain( 'red' );
			expect( ValidationHelpers.SAFE_COLORS ).toContain( 'blue' );
			expect( ValidationHelpers.SAFE_COLORS ).toContain( 'green' );
			expect( ValidationHelpers.SAFE_COLORS ).toContain( 'black' );
			expect( ValidationHelpers.SAFE_COLORS ).toContain( 'white' );
		} );

		test( 'includes transparent', () => {
			expect( ValidationHelpers.SAFE_COLORS ).toContain( 'transparent' );
		} );

		test( 'does not include dangerous values', () => {
			expect( ValidationHelpers.SAFE_COLORS ).not.toContain( 'javascript' );
			expect( ValidationHelpers.SAFE_COLORS ).not.toContain( 'expression' );
		} );
	} );

	describe( 'FALLBACK_MESSAGES constant', () => {
		test( 'has validation error messages', () => {
			expect( ValidationHelpers.FALLBACK_MESSAGES ).toHaveProperty( 'layers-validation-type-invalid' );
			expect( ValidationHelpers.FALLBACK_MESSAGES ).toHaveProperty( 'layers-validation-id-required' );
			expect( ValidationHelpers.FALLBACK_MESSAGES ).toHaveProperty( 'layers-validation-opacity-invalid' );
		} );

		test( 'messages are non-empty strings', () => {
			for ( const [ , value ] of Object.entries( ValidationHelpers.FALLBACK_MESSAGES ) ) {
				expect( typeof value ).toBe( 'string' );
				expect( value.length ).toBeGreaterThan( 0 );
			}
		} );
	} );

	describe( 'showValidationErrors', () => {
		test( 'does nothing for empty errors array', () => {
			// Should not throw
			expect( () => ValidationHelpers.showValidationErrors( [] ) ).not.toThrow();
			expect( () => ValidationHelpers.showValidationErrors( null ) ).not.toThrow();
		} );

		test( 'uses mw.notify when available', () => {
			const mockNotify = jest.fn();
			global.mw.notify = mockNotify;

			ValidationHelpers.showValidationErrors( [ 'Error 1', 'Error 2' ] );

			expect( mockNotify ).toHaveBeenCalled();
			delete global.mw.notify;
		} );
	} );
} );
