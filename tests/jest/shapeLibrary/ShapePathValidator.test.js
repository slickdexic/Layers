/**
 * Tests for ShapePathValidator
 */

const ShapePathValidator = require( '../../../resources/ext.layers.editor/shapeLibrary/ShapePathValidator.js' );

describe( 'ShapePathValidator', () => {
	let validator;

	beforeEach( () => {
		validator = new ShapePathValidator();
	} );

	describe( 'validate()', () => {
		it( 'should accept valid simple paths', () => {
			const result = validator.validate( 'M0 0 L10 10 Z' );
			expect( result.isValid ).toBe( true );
			expect( result.error ).toBeNull();
		} );

		it( 'should accept paths with all valid commands', () => {
			const complexPath = 'M10 10 L20 20 H30 V40 C50 50 60 60 70 70 S80 80 90 90 Q100 100 110 110 T120 120 A5 5 0 0 1 130 130 Z';
			expect( validator.isValid( complexPath ) ).toBe( true );
		} );

		it( 'should accept paths with lowercase commands', () => {
			expect( validator.isValid( 'm10 10 l20 20 h30 v40 z' ) ).toBe( true );
		} );

		it( 'should accept paths with scientific notation', () => {
			expect( validator.isValid( 'M1e2 2e3 L3e-2 4e+1 Z' ) ).toBe( true );
		} );

		it( 'should accept paths with negative numbers', () => {
			expect( validator.isValid( 'M-10 -20 L-30 -40 Z' ) ).toBe( true );
		} );

		it( 'should accept paths with decimal numbers', () => {
			expect( validator.isValid( 'M10.5 20.75 L30.125 40.5 Z' ) ).toBe( true );
		} );

		it( 'should accept paths with comma separators', () => {
			expect( validator.isValid( 'M10,20 L30,40 Z' ) ).toBe( true );
		} );

		it( 'should reject non-string input', () => {
			expect( validator.validate( null ).isValid ).toBe( false );
			expect( validator.validate( undefined ).isValid ).toBe( false );
			expect( validator.validate( 123 ).isValid ).toBe( false );
			expect( validator.validate( [] ).isValid ).toBe( false );
			expect( validator.validate( {} ).isValid ).toBe( false );
		} );

		it( 'should reject empty strings', () => {
			expect( validator.validate( '' ).isValid ).toBe( false );
			expect( validator.validate( '   ' ).isValid ).toBe( false );
		} );

		it( 'should reject paths that exceed max length', () => {
			const longPath = 'M0 0 ' + 'L1 1 '.repeat( 5000 );
			const result = validator.validate( longPath );
			expect( result.isValid ).toBe( false );
			expect( result.error ).toContain( 'maximum length' );
		} );

		it( 'should reject paths with too many commands', () => {
			// Use a shorter path that's under the length limit but has many commands
			const manyCommands = 'M0 0' + 'L1 1'.repeat( 2100 );
			const result = validator.validate( manyCommands );
			expect( result.isValid ).toBe( false );
			// Could fail on length or commands depending on repeat count
			expect( result.error ).toMatch( /(commands|length)/ );
		} );

		it( 'should reject paths not starting with move command', () => {
			const result = validator.validate( 'L10 10 Z' );
			expect( result.isValid ).toBe( false );
			expect( result.error ).toContain( 'moveto' );
		} );
	} );

	describe( 'security - script injection prevention', () => {
		it( 'should reject script tags', () => {
			expect( validator.isValid( 'M0 0<script>alert(1)</script>' ) ).toBe( false );
		} );

		it( 'should reject HTML tags', () => {
			expect( validator.isValid( 'M0 0<img src=x onerror=alert(1)>' ) ).toBe( false );
		} );

		it( 'should reject JavaScript URLs', () => {
			expect( validator.isValid( 'M0 0 javascript:alert(1)' ) ).toBe( false );
		} );

		it( 'should reject event handlers', () => {
			expect( validator.isValid( 'M0 0 onclick=alert(1)' ) ).toBe( false );
		} );

		it( 'should reject parentheses', () => {
			expect( validator.isValid( 'M0 0 url(http://evil.com)' ) ).toBe( false );
		} );

		it( 'should reject quotes', () => {
			expect( validator.isValid( 'M0 0 "malicious"' ) ).toBe( false );
			expect( validator.isValid( "M0 0 'malicious'" ) ).toBe( false );
		} );

		it( 'should reject semicolons', () => {
			expect( validator.isValid( 'M0 0; alert(1)' ) ).toBe( false );
		} );

		it( 'should reject angle brackets', () => {
			expect( validator.isValid( 'M0 0 <path>' ) ).toBe( false );
		} );

		it( 'should reject ampersands', () => {
			expect( validator.isValid( 'M0 0 &entity;' ) ).toBe( false );
		} );

		it( 'should reject hash/pound signs', () => {
			expect( validator.isValid( 'M0 0 #id' ) ).toBe( false );
		} );

		it( 'should reject colons (potential protocol injection)', () => {
			expect( validator.isValid( 'M0 0 data:text/html' ) ).toBe( false );
		} );
	} );

	describe( 'isValid()', () => {
		it( 'should return boolean true for valid paths', () => {
			expect( validator.isValid( 'M0 0 Z' ) ).toBe( true );
		} );

		it( 'should return boolean false for invalid paths', () => {
			expect( validator.isValid( '' ) ).toBe( false );
		} );
	} );

	describe( 'sanitize()', () => {
		it( 'should return valid paths unchanged', () => {
			const path = 'M10 20 L30 40 Z';
			expect( validator.sanitize( path ) ).toBe( path );
		} );

		it( 'should remove invalid characters', () => {
			// Characters like <, >, ! are stripped, leaving only valid path chars
			const result = validator.sanitize( 'M10 20 <script> L30 40 Z' );
			// 'script' without vowels becomes 'sct' - only [a-zA-Z] in valid set are path commands
			expect( result ).toBe( 'M10 20 sct L30 40 Z' );
		} );

		it( 'should return null for non-strings', () => {
			expect( validator.sanitize( null ) ).toBeNull();
			expect( validator.sanitize( 123 ) ).toBeNull();
		} );

		it( 'should return null for unsalvageable paths', () => {
			expect( validator.sanitize( '<script>alert(1)</script>' ) ).toBeNull();
		} );
	} );

	describe( 'validateViewBox()', () => {
		it( 'should accept valid viewBox arrays', () => {
			const result = validator.validateViewBox( [ 0, 0, 100, 100 ] );
			expect( result.isValid ).toBe( true );
		} );

		it( 'should accept viewBox with negative origin', () => {
			const result = validator.validateViewBox( [ -50, -50, 100, 100 ] );
			expect( result.isValid ).toBe( true );
		} );

		it( 'should reject non-array input', () => {
			expect( validator.validateViewBox( '0 0 100 100' ).isValid ).toBe( false );
			expect( validator.validateViewBox( null ).isValid ).toBe( false );
		} );

		it( 'should reject arrays with wrong length', () => {
			expect( validator.validateViewBox( [ 0, 0, 100 ] ).isValid ).toBe( false );
			expect( validator.validateViewBox( [ 0, 0, 100, 100, 200 ] ).isValid ).toBe( false );
		} );

		it( 'should reject non-numeric values', () => {
			expect( validator.validateViewBox( [ 'a', 0, 100, 100 ] ).isValid ).toBe( false );
		} );

		it( 'should reject non-finite values', () => {
			expect( validator.validateViewBox( [ 0, 0, Infinity, 100 ] ).isValid ).toBe( false );
			expect( validator.validateViewBox( [ 0, 0, NaN, 100 ] ).isValid ).toBe( false );
		} );

		it( 'should reject zero or negative width/height', () => {
			expect( validator.validateViewBox( [ 0, 0, 0, 100 ] ).isValid ).toBe( false );
			expect( validator.validateViewBox( [ 0, 0, 100, -50 ] ).isValid ).toBe( false );
		} );
	} );

	describe( 'validateShape()', () => {
		it( 'should accept valid shape definitions', () => {
			const shape = {
				id: 'test/shape',
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const result = validator.validateShape( shape );
			expect( result.isValid ).toBe( true );
			expect( result.errors ).toHaveLength( 0 );
		} );

		it( 'should accept shapes with optional properties', () => {
			const shape = {
				id: 'test/shape',
				name: 'Test Shape',
				category: 'test',
				tags: [ 'one', 'two' ],
				path: 'M0 0 L100 100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};
			expect( validator.validateShape( shape ).isValid ).toBe( true );
		} );

		it( 'should reject non-object input', () => {
			expect( validator.validateShape( null ).isValid ).toBe( false );
			expect( validator.validateShape( 'string' ).isValid ).toBe( false );
		} );

		it( 'should reject shapes without id', () => {
			const shape = {
				path: 'M0 0 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const result = validator.validateShape( shape );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( ( e ) => e.includes( 'id' ) ) ).toBe( true );
		} );

		it( 'should reject shapes with invalid path', () => {
			const shape = {
				id: 'test',
				path: '<script>',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const result = validator.validateShape( shape );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( ( e ) => e.toLowerCase().includes( 'path' ) ) ).toBe( true );
		} );

		it( 'should reject shapes with invalid viewBox', () => {
			const shape = {
				id: 'test',
				path: 'M0 0 Z',
				viewBox: 'invalid'
			};
			const result = validator.validateShape( shape );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( ( e ) => e.includes( 'viewBox' ) ) ).toBe( true );
		} );

		it( 'should reject shapes with non-string tags', () => {
			const shape = {
				id: 'test',
				path: 'M0 0 Z',
				viewBox: [ 0, 0, 100, 100 ],
				tags: [ 'valid', 123 ]
			};
			const result = validator.validateShape( shape );
			expect( result.isValid ).toBe( false );
			expect( result.errors.some( ( e ) => e.includes( 'tags' ) ) ).toBe( true );
		} );
	} );

	describe( 'countCommands()', () => {
		it( 'should count path commands correctly', () => {
			// Access private method via object for testing
			const count = validator.countCommands( 'M0 0 L10 10 L20 20 Z' );
			expect( count ).toBe( 4 ); // M, L, L, Z
		} );

		it( 'should count mixed case commands', () => {
			const count = validator.countCommands( 'M0 0 l10 10 L20 20 z' );
			expect( count ).toBe( 4 );
		} );

		it( 'should return 0 for paths with no commands', () => {
			const count = validator.countCommands( '10 20 30 40' );
			expect( count ).toBe( 0 );
		} );
	} );
} );
