'use strict';

/**
 * Tests for NumericValidator class
 *
 * NumericValidator is instance-based (not static methods) and its validation
 * methods take a layer object and a result object to populate.
 *
 * @jest-environment jsdom
 */

describe( 'NumericValidator', () => {
	let NumericValidator, validator;

	beforeAll( () => {
		// Set up MediaWiki mocks
		global.mw = {
			message: jest.fn( ( key ) => ( {
				text: jest.fn( () => `Mocked: ${ key }` ),
				params: jest.fn().mockReturnThis(),
				exists: jest.fn( () => true )
			} ) )
		};

		// Load validation helpers first (dependency)
		require( '../../../resources/ext.layers.editor/validation/ValidationHelpers.js' );
		// Load the module
		require( '../../../resources/ext.layers.editor/validation/NumericValidator.js' );
		NumericValidator = window.Layers.Validation.NumericValidator;
	} );

	beforeEach( () => {
		// Create a fresh instance for each test
		validator = new NumericValidator();
	} );

	afterAll( () => {
		delete global.mw;
	} );

	/**
	 * Helper to create a fresh result object for validation
	 */
	function createResult() {
		return { isValid: true, errors: [] };
	}

	describe( 'constructor', () => {
		test( 'uses default rules when no custom rules provided', () => {
			const v = new NumericValidator();
			expect( v.rules.fontSize ).toEqual( { min: 1, max: 1000 } );
			expect( v.rules.opacity ).toEqual( { min: 0, max: 1 } );
		} );

		test( 'merges custom rules with defaults', () => {
			const customRules = { fontSize: { min: 10, max: 100 } };
			const v = new NumericValidator( customRules );
			expect( v.rules.fontSize ).toEqual( { min: 10, max: 100 } );
			// Other defaults preserved
			expect( v.rules.opacity ).toEqual( { min: 0, max: 1 } );
		} );
	} );

	describe( 'DEFAULT_RULES constant', () => {
		test( 'has expected validation rules', () => {
			expect( NumericValidator.DEFAULT_RULES ).toHaveProperty( 'fontSize' );
			expect( NumericValidator.DEFAULT_RULES ).toHaveProperty( 'strokeWidth' );
			expect( NumericValidator.DEFAULT_RULES ).toHaveProperty( 'opacity' );
			expect( NumericValidator.DEFAULT_RULES ).toHaveProperty( 'blurRadius' );
		} );

		test( 'fontSize has correct range', () => {
			const rule = NumericValidator.DEFAULT_RULES.fontSize;
			expect( rule.min ).toBe( 1 );
			expect( rule.max ).toBe( 1000 );
		} );

		test( 'opacity has correct range', () => {
			const rule = NumericValidator.DEFAULT_RULES.opacity;
			expect( rule.min ).toBe( 0 );
			expect( rule.max ).toBe( 1 );
		} );
	} );

	describe( 'validateFontSize', () => {
		test( 'returns valid for normal font sizes', () => {
			const result = createResult();
			validator.validateFontSize( { fontSize: 12 }, result );
			expect( result.isValid ).toBe( true );

			const result2 = createResult();
			validator.validateFontSize( { fontSize: 24 }, result2 );
			expect( result2.isValid ).toBe( true );
		} );

		test( 'returns valid for boundary values', () => {
			const result1 = createResult();
			validator.validateFontSize( { fontSize: 1 }, result1 );
			expect( result1.isValid ).toBe( true );

			const result2 = createResult();
			validator.validateFontSize( { fontSize: 1000 }, result2 );
			expect( result2.isValid ).toBe( true );
		} );

		test( 'returns invalid for values below minimum', () => {
			const result = createResult();
			validator.validateFontSize( { fontSize: 0 }, result );
			expect( result.isValid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThan( 0 );
		} );

		test( 'returns invalid for values above maximum', () => {
			const result = createResult();
			validator.validateFontSize( { fontSize: 1001 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for non-numeric values', () => {
			const result = createResult();
			validator.validateFontSize( { fontSize: 'large' }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'does nothing for undefined fontSize', () => {
			const result = createResult();
			validator.validateFontSize( {}, result );
			expect( result.isValid ).toBe( true );
			expect( result.errors ).toHaveLength( 0 );
		} );
	} );

	describe( 'validateStrokeWidth', () => {
		test( 'returns valid for normal stroke widths', () => {
			const result = createResult();
			validator.validateStrokeWidth( { strokeWidth: 2 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns valid for zero (no stroke)', () => {
			const result = createResult();
			validator.validateStrokeWidth( { strokeWidth: 0 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns valid for maximum value', () => {
			const result = createResult();
			validator.validateStrokeWidth( { strokeWidth: 50 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns invalid for negative values', () => {
			const result = createResult();
			validator.validateStrokeWidth( { strokeWidth: -1 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for excessive values', () => {
			const result = createResult();
			validator.validateStrokeWidth( { strokeWidth: 51 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for non-numeric values', () => {
			const result = createResult();
			validator.validateStrokeWidth( { strokeWidth: 'thick' }, result );
			expect( result.isValid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThan( 0 );
		} );

		test( 'returns invalid for NaN', () => {
			const result = createResult();
			validator.validateStrokeWidth( { strokeWidth: NaN }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'skips validation when strokeWidth is undefined', () => {
			const result = createResult();
			validator.validateStrokeWidth( {}, result );
			expect( result.isValid ).toBe( true );
		} );
	} );

	describe( 'validateOpacity', () => {
		test( 'returns valid for normal opacity values', () => {
			const result = createResult();
			validator.validateOpacity( { opacity: 0.5 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns valid for boundary values', () => {
			const result1 = createResult();
			validator.validateOpacity( { opacity: 0 }, result1 );
			expect( result1.isValid ).toBe( true );

			const result2 = createResult();
			validator.validateOpacity( { opacity: 1 }, result2 );
			expect( result2.isValid ).toBe( true );
		} );

		test( 'returns invalid for values below 0', () => {
			const result = createResult();
			validator.validateOpacity( { opacity: -0.1 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for values above 1', () => {
			const result = createResult();
			validator.validateOpacity( { opacity: 1.1 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for non-numeric values', () => {
			const result = createResult();
			validator.validateOpacity( { opacity: 'half' }, result );
			expect( result.isValid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThan( 0 );
		} );

		test( 'returns invalid for NaN', () => {
			const result = createResult();
			validator.validateOpacity( { opacity: NaN }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'skips validation when opacity is undefined', () => {
			const result = createResult();
			validator.validateOpacity( {}, result );
			expect( result.isValid ).toBe( true );
		} );
	} );

	describe( 'validateBlurRadius', () => {
		test( 'returns valid for normal blur values', () => {
			const result = createResult();
			validator.validateBlurRadius( { blurRadius: 10 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns valid for minimum value', () => {
			const result = createResult();
			validator.validateBlurRadius( { blurRadius: 1 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns valid for maximum value', () => {
			const result = createResult();
			validator.validateBlurRadius( { blurRadius: 100 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns invalid for zero', () => {
			const result = createResult();
			validator.validateBlurRadius( { blurRadius: 0 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for excessive values', () => {
			const result = createResult();
			validator.validateBlurRadius( { blurRadius: 101 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for non-numeric values', () => {
			const result = createResult();
			validator.validateBlurRadius( { blurRadius: 'medium' }, result );
			expect( result.isValid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThan( 0 );
		} );

		test( 'returns invalid for NaN', () => {
			const result = createResult();
			validator.validateBlurRadius( { blurRadius: NaN }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'skips validation when blurRadius is undefined', () => {
			const result = createResult();
			validator.validateBlurRadius( {}, result );
			expect( result.isValid ).toBe( true );
		} );
	} );

	describe( 'validateShadowProperties', () => {
		test( 'returns valid for normal shadow offset', () => {
			const result = createResult();
			validator.validateShadowProperties( { shadowOffsetX: 5 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns valid for zero offset', () => {
			const result = createResult();
			validator.validateShadowProperties( { shadowOffsetX: 0, shadowOffsetY: 0 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns valid for negative offset (within range)', () => {
			const result = createResult();
			validator.validateShadowProperties( { shadowOffsetX: -10, shadowOffsetY: -10 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns invalid for excessive positive offset', () => {
			const result = createResult();
			validator.validateShadowProperties( { shadowOffsetX: 101 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for excessive negative offset', () => {
			const result = createResult();
			validator.validateShadowProperties( { shadowOffsetX: -101 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'validates shadowBlur', () => {
			const result1 = createResult();
			validator.validateShadowProperties( { shadowBlur: 10 }, result1 );
			expect( result1.isValid ).toBe( true );

			const result2 = createResult();
			validator.validateShadowProperties( { shadowBlur: -1 }, result2 );
			expect( result2.isValid ).toBe( false );
		} );

		test( 'validates shadowSpread', () => {
			const result1 = createResult();
			validator.validateShadowProperties( { shadowSpread: 5 }, result1 );
			expect( result1.isValid ).toBe( true );

			const result2 = createResult();
			validator.validateShadowProperties( { shadowSpread: 51 }, result2 );
			expect( result2.isValid ).toBe( false );
		} );

		test( 'returns valid for empty layer', () => {
			const result = createResult();
			validator.validateShadowProperties( {}, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns invalid for non-numeric shadowOffsetX', () => {
			const result = createResult();
			validator.validateShadowProperties( { shadowOffsetX: 'right' }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for non-numeric shadowOffsetY', () => {
			const result = createResult();
			validator.validateShadowProperties( { shadowOffsetY: 'down' }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for non-numeric shadowBlur', () => {
			const result = createResult();
			validator.validateShadowProperties( { shadowBlur: 'soft' }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for non-numeric shadowSpread', () => {
			const result = createResult();
			validator.validateShadowProperties( { shadowSpread: 'wide' }, result );
			expect( result.isValid ).toBe( false );
		} );
	} );

	describe( 'validateArrowSize', () => {
		test( 'returns valid for normal arrow sizes', () => {
			const result = createResult();
			validator.validateArrowSize( { arrowSize: 10 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns valid for minimum value', () => {
			const result = createResult();
			validator.validateArrowSize( { arrowSize: 1 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns valid for maximum value', () => {
			const result = createResult();
			validator.validateArrowSize( { arrowSize: 100 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns invalid for zero', () => {
			const result = createResult();
			validator.validateArrowSize( { arrowSize: 0 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for excessive values', () => {
			const result = createResult();
			validator.validateArrowSize( { arrowSize: 101 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'does nothing for undefined arrowSize', () => {
			const result = createResult();
			validator.validateArrowSize( {}, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns invalid for non-numeric values', () => {
			const result = createResult();
			validator.validateArrowSize( { arrowSize: 'big' }, result );
			expect( result.isValid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThan( 0 );
		} );

		test( 'returns invalid for NaN', () => {
			const result = createResult();
			validator.validateArrowSize( { arrowSize: NaN }, result );
			expect( result.isValid ).toBe( false );
		} );
	} );

	describe( 'validateSides', () => {
		test( 'returns valid for normal polygon sides', () => {
			const result1 = createResult();
			validator.validateSides( { sides: 3 }, result1 );
			expect( result1.isValid ).toBe( true ); // triangle

			const result2 = createResult();
			validator.validateSides( { sides: 6 }, result2 );
			expect( result2.isValid ).toBe( true ); // hexagon
		} );

		test( 'returns valid for maximum sides', () => {
			const result = createResult();
			validator.validateSides( { sides: 20 }, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns invalid for less than 3 sides', () => {
			const result = createResult();
			validator.validateSides( { sides: 2 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for excessive sides', () => {
			const result = createResult();
			validator.validateSides( { sides: 21 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for non-integers', () => {
			const result = createResult();
			validator.validateSides( { sides: 3.5 }, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'does nothing for undefined sides', () => {
			const result = createResult();
			validator.validateSides( {}, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns invalid for non-numeric values', () => {
			const result = createResult();
			validator.validateSides( { sides: 'hexagon' }, result );
			expect( result.isValid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThan( 0 );
		} );

		test( 'returns invalid for NaN', () => {
			const result = createResult();
			validator.validateSides( { sides: NaN }, result );
			expect( result.isValid ).toBe( false );
		} );
	} );

	describe( 'validateStarPoints', () => {
		test( 'returns valid for normal star points', () => {
			const result = createResult();
			validator.validateStarPoints( 5, result ); // 5-point star
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns valid for minimum points (3)', () => {
			const result = createResult();
			validator.validateStarPoints( 3, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns valid for maximum points', () => {
			const result = createResult();
			validator.validateStarPoints( 20, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns invalid for less than 3 points', () => {
			const result = createResult();
			validator.validateStarPoints( 2, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for excessive points', () => {
			const result = createResult();
			validator.validateStarPoints( 21, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'returns invalid for non-integers', () => {
			const result = createResult();
			validator.validateStarPoints( 5.5, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'does nothing for undefined', () => {
			const result = createResult();
			validator.validateStarPoints( undefined, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns invalid for non-numeric values', () => {
			const result = createResult();
			validator.validateStarPoints( 'five', result );
			expect( result.isValid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThan( 0 );
		} );

		test( 'returns invalid for NaN', () => {
			const result = createResult();
			validator.validateStarPoints( NaN, result );
			expect( result.isValid ).toBe( false );
		} );
	} );

	describe( 'validateNumericProperties', () => {
		test( 'validates layer with valid properties', () => {
			const layer = {
				type: 'text',
				fontSize: 24,
				opacity: 0.8,
				strokeWidth: 2
			};
			const result = createResult();
			validator.validateNumericProperties( layer, result );
			expect( result.isValid ).toBe( true );
			expect( result.errors ).toHaveLength( 0 );
		} );

		test( 'validates layer with no numeric properties', () => {
			const layer = {
				type: 'rectangle',
				fill: '#ff0000'
			};
			const result = createResult();
			validator.validateNumericProperties( layer, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'returns errors for invalid fontSize', () => {
			const layer = {
				type: 'text',
				fontSize: 0
			};
			const result = createResult();
			validator.validateNumericProperties( layer, result );
			expect( result.isValid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThan( 0 );
		} );

		test( 'returns errors for invalid opacity', () => {
			const layer = {
				type: 'rectangle',
				opacity: 1.5
			};
			const result = createResult();
			validator.validateNumericProperties( layer, result );
			expect( result.isValid ).toBe( false );
		} );

		test( 'validates polygon with sides', () => {
			const validResult = createResult();
			validator.validateNumericProperties( { type: 'polygon', sides: 6 }, validResult );
			expect( validResult.isValid ).toBe( true );

			const invalidResult = createResult();
			validator.validateNumericProperties( { type: 'polygon', sides: 2 }, invalidResult );
			expect( invalidResult.isValid ).toBe( false );
		} );

		test( 'validates arrow with arrowSize', () => {
			const validResult = createResult();
			validator.validateNumericProperties( { type: 'arrow', arrowSize: 15 }, validResult );
			expect( validResult.isValid ).toBe( true );

			const invalidResult = createResult();
			validator.validateNumericProperties( { type: 'arrow', arrowSize: 0 }, invalidResult );
			expect( invalidResult.isValid ).toBe( false );
		} );

		test( 'validates shadow properties', () => {
			const validResult = createResult();
			validator.validateNumericProperties(
				{ type: 'rectangle', shadow: true, shadowBlur: 10, shadowOffsetX: 5 },
				validResult
			);
			expect( validResult.isValid ).toBe( true );

			const invalidResult = createResult();
			validator.validateNumericProperties(
				{ type: 'rectangle', shadow: true, shadowOffsetX: 200 },
				invalidResult
			);
			expect( invalidResult.isValid ).toBe( false );
		} );

		test( 'collects multiple errors', () => {
			const layer = {
				type: 'text',
				fontSize: 0,
				opacity: 2,
				strokeWidth: -5
			};
			const result = createResult();
			validator.validateNumericProperties( layer, result );
			expect( result.isValid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThanOrEqual( 2 );
		} );
	} );

	describe( 'isValidNumber', () => {
		test( 'returns true for valid numbers', () => {
			expect( validator.isValidNumber( 0 ) ).toBe( true );
			expect( validator.isValidNumber( 42 ) ).toBe( true );
			expect( validator.isValidNumber( -1.5 ) ).toBe( true );
		} );

		test( 'returns false for invalid values', () => {
			expect( validator.isValidNumber( NaN ) ).toBe( false );
			expect( validator.isValidNumber( Infinity ) ).toBe( false );
			expect( validator.isValidNumber( 'string' ) ).toBe( false );
			expect( validator.isValidNumber( null ) ).toBe( false );
		} );
	} );

	describe( 'getMessage', () => {
		test( 'returns message from helpers', () => {
			const msg = validator.getMessage( 'layers-validation-fontsize-invalid' );
			expect( typeof msg ).toBe( 'string' );
		} );
	} );

	describe( 'fallback behavior without helpers', () => {
		let validatorNoHelpers;

		beforeEach( () => {
			// Create a validator instance and remove helpers
			validatorNoHelpers = new NumericValidator();
			validatorNoHelpers.helpers = null;
		} );

		test( 'isValidNumber uses inline fallback when helpers unavailable', () => {
			expect( validatorNoHelpers.isValidNumber( 42 ) ).toBe( true );
			expect( validatorNoHelpers.isValidNumber( 0 ) ).toBe( true );
			expect( validatorNoHelpers.isValidNumber( -1.5 ) ).toBe( true );
			expect( validatorNoHelpers.isValidNumber( NaN ) ).toBe( false );
			expect( validatorNoHelpers.isValidNumber( Infinity ) ).toBe( false );
			expect( validatorNoHelpers.isValidNumber( 'string' ) ).toBe( false );
		} );

		test( 'getMessage returns key when helpers unavailable', () => {
			const msg = validatorNoHelpers.getMessage( 'some-message-key' );
			expect( msg ).toBe( 'some-message-key' );
		} );
	} );

	describe( 'shadow spread validation', () => {
		test( 'accepts valid shadow spread values', () => {
			const layer = {
				type: 'rectangle',
				shadowSpread: 5
			};
			const result = createResult();
			validator.validateShadowProperties( layer, result );
			expect( result.isValid ).toBe( true );
		} );

		test( 'rejects shadow spread out of range', () => {
			const layer = {
				type: 'rectangle',
				shadowSpread: 200
			};
			const result = createResult();
			validator.validateShadowProperties( layer, result );
			expect( result.isValid ).toBe( false );
			expect( result.errors ).toContainEqual(
				expect.stringContaining( 'Shadow spread' )
			);
		} );

		test( 'rejects non-numeric shadow spread', () => {
			const layer = {
				type: 'rectangle',
				shadowSpread: 'invalid'
			};
			const result = createResult();
			validator.validateShadowProperties( layer, result );
			expect( result.isValid ).toBe( false );
			expect( result.errors ).toContainEqual( 'Shadow spread must be a number' );
		} );
	} );

	describe( 'shadow offset Y range validation', () => {
		test( 'rejects shadowOffsetY out of range', () => {
			const layer = {
				type: 'rectangle',
				shadowOffsetY: 1000
			};
			const result = createResult();
			validator.validateShadowProperties( layer, result );
			expect( result.isValid ).toBe( false );
			expect( result.errors ).toContainEqual(
				expect.stringContaining( 'Shadow offset Y must be between' )
			);
		} );
	} );
} );
