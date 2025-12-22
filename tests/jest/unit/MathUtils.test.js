/**
 * MathUtils unit tests
 *
 * Tests for shared mathematical utility functions.
 */
'use strict';

const MathUtils = require( '../../../resources/ext.layers.shared/MathUtils.js' );

describe( 'MathUtils', () => {
	describe( 'clampOpacity', () => {
		it( 'should return 1 for undefined', () => {
			expect( MathUtils.clampOpacity( undefined ) ).toBe( 1 );
		} );

		it( 'should return 1 for null', () => {
			expect( MathUtils.clampOpacity( null ) ).toBe( 1 );
		} );

		it( 'should return 1 for NaN', () => {
			expect( MathUtils.clampOpacity( NaN ) ).toBe( 1 );
		} );

		it( 'should return 1 for non-numeric strings', () => {
			expect( MathUtils.clampOpacity( 'abc' ) ).toBe( 1 );
		} );

		it( 'should return 1 for empty string', () => {
			expect( MathUtils.clampOpacity( '' ) ).toBe( 1 );
		} );

		it( 'should return 1 for objects', () => {
			expect( MathUtils.clampOpacity( {} ) ).toBe( 1 );
		} );

		it( 'should return 1 for arrays', () => {
			expect( MathUtils.clampOpacity( [] ) ).toBe( 1 );
		} );

		it( 'should clamp negative values to 0', () => {
			expect( MathUtils.clampOpacity( -0.5 ) ).toBe( 0 );
			expect( MathUtils.clampOpacity( -100 ) ).toBe( 0 );
		} );

		it( 'should clamp values greater than 1 to 1', () => {
			expect( MathUtils.clampOpacity( 1.5 ) ).toBe( 1 );
			expect( MathUtils.clampOpacity( 100 ) ).toBe( 1 );
		} );

		it( 'should return valid values unchanged', () => {
			expect( MathUtils.clampOpacity( 0 ) ).toBe( 0 );
			expect( MathUtils.clampOpacity( 0.5 ) ).toBe( 0.5 );
			expect( MathUtils.clampOpacity( 1 ) ).toBe( 1 );
			expect( MathUtils.clampOpacity( 0.75 ) ).toBe( 0.75 );
		} );

		it( 'should handle edge case values', () => {
			expect( MathUtils.clampOpacity( 0.0001 ) ).toBe( 0.0001 );
			expect( MathUtils.clampOpacity( 0.9999 ) ).toBe( 0.9999 );
		} );

		it( 'should handle Infinity', () => {
			expect( MathUtils.clampOpacity( Infinity ) ).toBe( 1 );
			expect( MathUtils.clampOpacity( -Infinity ) ).toBe( 0 );
		} );
	} );

	describe( 'clamp', () => {
		it( 'should clamp value below minimum to minimum', () => {
			expect( MathUtils.clamp( -10, 0, 100 ) ).toBe( 0 );
			expect( MathUtils.clamp( -1, 5, 10 ) ).toBe( 5 );
		} );

		it( 'should clamp value above maximum to maximum', () => {
			expect( MathUtils.clamp( 150, 0, 100 ) ).toBe( 100 );
			expect( MathUtils.clamp( 20, 5, 10 ) ).toBe( 10 );
		} );

		it( 'should return value unchanged when within range', () => {
			expect( MathUtils.clamp( 50, 0, 100 ) ).toBe( 50 );
			expect( MathUtils.clamp( 7, 5, 10 ) ).toBe( 7 );
		} );

		it( 'should return boundary values unchanged', () => {
			expect( MathUtils.clamp( 0, 0, 100 ) ).toBe( 0 );
			expect( MathUtils.clamp( 100, 0, 100 ) ).toBe( 100 );
		} );

		it( 'should handle negative ranges', () => {
			expect( MathUtils.clamp( -50, -100, -10 ) ).toBe( -50 );
			expect( MathUtils.clamp( 0, -100, -10 ) ).toBe( -10 );
			expect( MathUtils.clamp( -200, -100, -10 ) ).toBe( -100 );
		} );

		it( 'should return min for invalid input types', () => {
			expect( MathUtils.clamp( undefined, 0, 100 ) ).toBe( 0 );
			expect( MathUtils.clamp( null, 5, 10 ) ).toBe( 5 );
			expect( MathUtils.clamp( 'abc', 0, 100 ) ).toBe( 0 );
			expect( MathUtils.clamp( NaN, 10, 20 ) ).toBe( 10 );
		} );

		it( 'should handle decimal values', () => {
			expect( MathUtils.clamp( 0.5, 0, 1 ) ).toBe( 0.5 );
			expect( MathUtils.clamp( 1.5, 0, 1 ) ).toBe( 1 );
			expect( MathUtils.clamp( -0.5, 0, 1 ) ).toBe( 0 );
		} );

		it( 'should handle zero-width ranges', () => {
			expect( MathUtils.clamp( 5, 10, 10 ) ).toBe( 10 );
			expect( MathUtils.clamp( 15, 10, 10 ) ).toBe( 10 );
		} );

		it( 'should handle Infinity', () => {
			expect( MathUtils.clamp( Infinity, 0, 100 ) ).toBe( 100 );
			expect( MathUtils.clamp( -Infinity, 0, 100 ) ).toBe( 0 );
		} );
	} );

	describe( 'degreesToRadians', () => {
		it( 'should convert 0 degrees to 0 radians', () => {
			expect( MathUtils.degreesToRadians( 0 ) ).toBe( 0 );
		} );

		it( 'should convert 90 degrees to π/2 radians', () => {
			expect( MathUtils.degreesToRadians( 90 ) ).toBeCloseTo( Math.PI / 2, 10 );
		} );

		it( 'should convert 180 degrees to π radians', () => {
			expect( MathUtils.degreesToRadians( 180 ) ).toBeCloseTo( Math.PI, 10 );
		} );

		it( 'should convert 270 degrees to 3π/2 radians', () => {
			expect( MathUtils.degreesToRadians( 270 ) ).toBeCloseTo( ( 3 * Math.PI ) / 2, 10 );
		} );

		it( 'should convert 360 degrees to 2π radians', () => {
			expect( MathUtils.degreesToRadians( 360 ) ).toBeCloseTo( 2 * Math.PI, 10 );
		} );

		it( 'should handle negative degrees', () => {
			expect( MathUtils.degreesToRadians( -90 ) ).toBeCloseTo( -Math.PI / 2, 10 );
			expect( MathUtils.degreesToRadians( -180 ) ).toBeCloseTo( -Math.PI, 10 );
		} );

		it( 'should handle decimal degrees', () => {
			expect( MathUtils.degreesToRadians( 45 ) ).toBeCloseTo( Math.PI / 4, 10 );
			expect( MathUtils.degreesToRadians( 30 ) ).toBeCloseTo( Math.PI / 6, 10 );
			expect( MathUtils.degreesToRadians( 60 ) ).toBeCloseTo( Math.PI / 3, 10 );
		} );

		it( 'should handle values greater than 360', () => {
			expect( MathUtils.degreesToRadians( 450 ) ).toBeCloseTo( 2.5 * Math.PI, 10 );
		} );
	} );

	describe( 'radiansToDegrees', () => {
		it( 'should convert 0 radians to 0 degrees', () => {
			expect( MathUtils.radiansToDegrees( 0 ) ).toBe( 0 );
		} );

		it( 'should convert π/2 radians to 90 degrees', () => {
			expect( MathUtils.radiansToDegrees( Math.PI / 2 ) ).toBeCloseTo( 90, 10 );
		} );

		it( 'should convert π radians to 180 degrees', () => {
			expect( MathUtils.radiansToDegrees( Math.PI ) ).toBeCloseTo( 180, 10 );
		} );

		it( 'should convert 3π/2 radians to 270 degrees', () => {
			expect( MathUtils.radiansToDegrees( ( 3 * Math.PI ) / 2 ) ).toBeCloseTo( 270, 10 );
		} );

		it( 'should convert 2π radians to 360 degrees', () => {
			expect( MathUtils.radiansToDegrees( 2 * Math.PI ) ).toBeCloseTo( 360, 10 );
		} );

		it( 'should handle negative radians', () => {
			expect( MathUtils.radiansToDegrees( -Math.PI / 2 ) ).toBeCloseTo( -90, 10 );
			expect( MathUtils.radiansToDegrees( -Math.PI ) ).toBeCloseTo( -180, 10 );
		} );

		it( 'should handle decimal radians', () => {
			expect( MathUtils.radiansToDegrees( Math.PI / 4 ) ).toBeCloseTo( 45, 10 );
			expect( MathUtils.radiansToDegrees( Math.PI / 6 ) ).toBeCloseTo( 30, 10 );
			expect( MathUtils.radiansToDegrees( Math.PI / 3 ) ).toBeCloseTo( 60, 10 );
		} );

		it( 'should handle values greater than 2π', () => {
			expect( MathUtils.radiansToDegrees( 2.5 * Math.PI ) ).toBeCloseTo( 450, 10 );
		} );
	} );

	describe( 'round-trip conversions', () => {
		it( 'should be reversible: degrees → radians → degrees', () => {
			const testDegrees = [ 0, 45, 90, 135, 180, 225, 270, 315, 360 ];
			testDegrees.forEach( ( deg ) => {
				const result = MathUtils.radiansToDegrees( MathUtils.degreesToRadians( deg ) );
				expect( result ).toBeCloseTo( deg, 10 );
			} );
		} );

		it( 'should be reversible: radians → degrees → radians', () => {
			const testRadians = [ 0, Math.PI / 4, Math.PI / 2, Math.PI, 2 * Math.PI ];
			testRadians.forEach( ( rad ) => {
				const result = MathUtils.degreesToRadians( MathUtils.radiansToDegrees( rad ) );
				expect( result ).toBeCloseTo( rad, 10 );
			} );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export all expected functions', () => {
			expect( typeof MathUtils.clampOpacity ).toBe( 'function' );
			expect( typeof MathUtils.clamp ).toBe( 'function' );
			expect( typeof MathUtils.degreesToRadians ).toBe( 'function' );
			expect( typeof MathUtils.radiansToDegrees ).toBe( 'function' );
		} );

		it( 'should have exactly 4 exported functions', () => {
			const keys = Object.keys( MathUtils );
			expect( keys.length ).toBe( 4 );
		} );
	} );
} );
