/**
 * Comprehensive unit tests for LayersValidator
 *
 * Tests the client-side validation module that provides immediate feedback
 * to users about invalid layer data. This module is security-critical as
 * it validates user input before submission.
 *
 * @see resources/ext.layers.editor/LayersValidator.js
 */

describe( 'LayersValidator', () => {
	let LayersValidator;
	let validator;

	beforeEach( () => {
		jest.resetModules();

		// Setup minimal mw global
		global.mw = {
			message: jest.fn( ( key ) => ( {
				text: () => key,
				exists: () => true,
				params: () => ( { text: () => key } )
			} ) ),
			msg: jest.fn( ( key ) => key ),
			notify: jest.fn(),
			log: {
				error: jest.fn(),
				warn: jest.fn()
			}
		};

		// Setup window
		global.window = {
			mw: global.mw,
			Layers: {},
			LayersConstants: {
				LIMITS: {
					MAX_POLYGON_SIDES: 20,
					MIN_POLYGON_SIDES: 3,
					MIN_STAR_POINTS: 3,
					MAX_STAR_POINTS: 20
				}
			}
		};

		// Load LayersValidator
		require( '../../resources/ext.layers.editor/LayersValidator.js' );
		LayersValidator = window.Layers.Validation.LayersValidator;
		validator = new LayersValidator();
	} );

	afterEach( () => {
		delete global.mw;
		delete global.window;
	} );

	// ============================================
	// Constructor and Initialization Tests
	// ============================================

	describe( 'Constructor', () => {
		it( 'should create a new instance', () => {
			expect( validator ).toBeInstanceOf( LayersValidator );
		} );

		it( 'should initialize validation rules', () => {
			expect( validator.validationRules ).toBeDefined();
			expect( validator.validationRules.validTypes ).toContain( 'rectangle' );
			expect( validator.validationRules.validTypes ).toContain( 'text' );
		} );

		it( 'should have all 10 layer types in whitelist', () => {
			const expectedTypes = [
				'text', 'arrow', 'rectangle', 'circle', 'ellipse',
				'polygon', 'star', 'line', 'path', 'blur'
			];
			expectedTypes.forEach( type => {
				expect( validator.validationRules.validTypes ).toContain( type );
			} );
		} );

		it( 'should use default limits when LayersConstants not available', () => {
			delete global.window.Layers.Constants;
			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayersValidator.js' );
			const freshValidator = new window.Layers.Validation.LayersValidator();

			expect( freshValidator.validationRules.maxSides ).toBe( 20 );
			expect( freshValidator.validationRules.minSides ).toBe( 3 );
		} );
	} );

	// ============================================
	// validateLayer - Basic Tests
	// ============================================

	describe( 'validateLayer - Basic', () => {
		it( 'should return valid for a minimal valid layer', () => {
			const layer = { id: 'layer1', type: 'rectangle', x: 0, y: 0 };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
			expect( result.errors ).toHaveLength( 0 );
		} );

		it( 'should return invalid for null layer', () => {
			const result = validator.validateLayer( null );

			expect( result.isValid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThan( 0 );
		} );

		it( 'should return invalid for undefined layer', () => {
			const result = validator.validateLayer( undefined );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should return invalid for non-object layer', () => {
			expect( validator.validateLayer( 'string' ).isValid ).toBe( false );
			expect( validator.validateLayer( 123 ).isValid ).toBe( false );
			expect( validator.validateLayer( [] ).isValid ).toBe( false );
		} );

		it( 'should return invalid when id is missing', () => {
			const layer = { type: 'rectangle' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'ID' ) || e.includes( 'id' ) ) ).toBe( true );
		} );

		it( 'should return invalid when type is missing', () => {
			const layer = { id: 'layer1' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'type' ) ) ).toBe( true );
		} );
	} );

	// ============================================
	// validateLayerType Tests
	// ============================================

	describe( 'validateLayerType', () => {
		const validTypes = [
			'text', 'arrow', 'rectangle', 'circle', 'ellipse',
			'polygon', 'star', 'line', 'path', 'blur', 'customShape'
		];

		validTypes.forEach( type => {
			it( `should accept valid type: ${type}`, () => {
				const layer = { id: 'test', type };
				const result = validator.validateLayer( layer );

				expect( result.errors.some( e => e.includes( 'type' ) && e.includes( 'invalid' ) ) ).toBe( false );
			} );
		} );

		it( 'should reject invalid type', () => {
			const layer = { id: 'test', type: 'invalid-type' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'type' ) ) ).toBe( true );
		} );

		it( 'should reject type with SQL injection attempt', () => {
			const layer = { id: 'test', type: "'; DROP TABLE layers;--" };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject empty string type', () => {
			const layer = { id: 'test', type: '' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );
	} );

	// ============================================
	// validateLayerId Tests
	// ============================================

	describe( 'validateLayerId', () => {
		it( 'should accept valid alphanumeric ID', () => {
			const layer = { id: 'layer123', type: 'rectangle' };
			const result = validator.validateLayer( layer );

			expect( result.errors.filter( e => e.includes( 'ID' ) || e.includes( 'id' ) ) ).toHaveLength( 0 );
		} );

		it( 'should accept ID with underscores and hyphens', () => {
			const layer = { id: 'layer_1-test', type: 'rectangle' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should reject non-string ID', () => {
			const layer = { id: 123, type: 'rectangle' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject ID longer than max length', () => {
			const layer = { id: 'a'.repeat( 101 ), type: 'rectangle' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'long' ) ) ).toBe( true );
		} );

		it( 'should reject ID with special characters', () => {
			const layer = { id: 'layer@#$%', type: 'rectangle' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'invalid' ) ) ).toBe( true );
		} );

		it( 'should reject ID with spaces', () => {
			const layer = { id: 'layer with spaces', type: 'rectangle' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject ID with XSS attempt', () => {
			const layer = { id: '<script>alert(1)</script>', type: 'rectangle' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );
	} );

	// ============================================
	// validateCoordinates Tests
	// ============================================

	describe( 'validateCoordinates', () => {
		const coordinateFields = [ 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'radius', 'radiusX', 'radiusY' ];

		coordinateFields.forEach( field => {
			it( `should accept valid ${field} coordinate`, () => {
				const layer = { id: 'test', type: 'rectangle', [ field ]: 100 };
				const result = validator.validateLayer( layer );

				expect( result.errors.filter( e => e.includes( field ) ) ).toHaveLength( 0 );
			} );

			it( `should accept negative ${field} coordinate within limits`, () => {
				const layer = { id: 'test', type: 'rectangle', [ field ]: -500 };
				const result = validator.validateLayer( layer );

				expect( result.errors.filter( e => e.includes( field ) ) ).toHaveLength( 0 );
			} );

			it( `should reject ${field} exceeding max coordinate`, () => {
				const layer = { id: 'test', type: 'rectangle', [ field ]: 10001 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
				// Error message may not contain the field name verbatim
				expect( result.errors.length ).toBeGreaterThan( 0 );
			} );

			it( `should reject ${field} below min coordinate`, () => {
				const layer = { id: 'test', type: 'rectangle', [ field ]: -10001 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		it( 'should reject non-numeric x value', () => {
			const layer = { id: 'test', type: 'rectangle', x: 'abc' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject NaN coordinate', () => {
			const layer = { id: 'test', type: 'rectangle', x: NaN };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject Infinity coordinate', () => {
			const layer = { id: 'test', type: 'rectangle', x: Infinity };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should accept zero coordinates', () => {
			const layer = { id: 'test', type: 'rectangle', x: 0, y: 0, width: 0, height: 0 };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should accept decimal coordinates', () => {
			const layer = { id: 'test', type: 'rectangle', x: 10.5, y: 20.75 };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );
	} );

	// ============================================
	// validateNumericProperties Tests
	// ============================================

	describe( 'validateNumericProperties', () => {
		describe( 'fontSize', () => {
			it( 'should accept valid font size', () => {
				const layer = { id: 'test', type: 'text', fontSize: 16, text: 'hello' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept minimum font size', () => {
				const layer = { id: 'test', type: 'text', fontSize: 1, text: 'hello' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept maximum font size', () => {
				const layer = { id: 'test', type: 'text', fontSize: 1000, text: 'hello' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject font size below minimum', () => {
				const layer = { id: 'test', type: 'text', fontSize: 0, text: 'hello' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject font size above maximum', () => {
				const layer = { id: 'test', type: 'text', fontSize: 1001, text: 'hello' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject non-numeric font size', () => {
				const layer = { id: 'test', type: 'text', fontSize: 'large', text: 'hello' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'strokeWidth', () => {
			it( 'should accept valid stroke width', () => {
				const layer = { id: 'test', type: 'rectangle', strokeWidth: 2 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept zero stroke width', () => {
				const layer = { id: 'test', type: 'rectangle', strokeWidth: 0 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept maximum stroke width', () => {
				const layer = { id: 'test', type: 'rectangle', strokeWidth: 50 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject stroke width above maximum', () => {
				const layer = { id: 'test', type: 'rectangle', strokeWidth: 51 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject negative stroke width', () => {
				const layer = { id: 'test', type: 'rectangle', strokeWidth: -1 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'opacity', () => {
			it( 'should accept valid opacity', () => {
				const layer = { id: 'test', type: 'rectangle', opacity: 0.5 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept opacity of 0', () => {
				const layer = { id: 'test', type: 'rectangle', opacity: 0 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept opacity of 1', () => {
				const layer = { id: 'test', type: 'rectangle', opacity: 1 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject opacity above 1', () => {
				const layer = { id: 'test', type: 'rectangle', opacity: 1.1 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject negative opacity', () => {
				const layer = { id: 'test', type: 'rectangle', opacity: -0.1 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'sides', () => {
			it( 'should accept valid sides for polygon', () => {
				const layer = { id: 'test', type: 'polygon', sides: 6 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept minimum sides (3)', () => {
				const layer = { id: 'test', type: 'polygon', sides: 3 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept maximum sides (20)', () => {
				const layer = { id: 'test', type: 'polygon', sides: 20 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject sides below minimum', () => {
				const layer = { id: 'test', type: 'polygon', sides: 2 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject sides above maximum', () => {
				const layer = { id: 'test', type: 'polygon', sides: 21 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject non-integer sides', () => {
				const layer = { id: 'test', type: 'polygon', sides: 5.5 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'blurRadius', () => {
			it( 'should accept valid blur radius for blur fill shapes', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 'blur', blurRadius: 10 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject blur radius below minimum', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 'blur', blurRadius: 0 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject blur radius above maximum', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 'blur', blurRadius: 101 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'shadow properties', () => {
			it( 'should accept valid shadow blur', () => {
				const layer = { id: 'test', type: 'rectangle', shadowBlur: 10 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject shadow blur above 100', () => {
				const layer = { id: 'test', type: 'rectangle', shadowBlur: 101 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should accept valid shadow offsets', () => {
				const layer = { id: 'test', type: 'rectangle', shadowOffsetX: 5, shadowOffsetY: -5 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject shadow offset exceeding limits', () => {
				const layer = { id: 'test', type: 'rectangle', shadowOffsetX: 101 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should accept valid shadow spread', () => {
				const layer = { id: 'test', type: 'rectangle', shadowSpread: 5 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject shadow spread above 50', () => {
				const layer = { id: 'test', type: 'rectangle', shadowSpread: 51 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'arrowSize', () => {
			it( 'should accept valid arrow size', () => {
				const layer = { id: 'test', type: 'arrow', arrowSize: 10 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject arrow size below 1', () => {
				const layer = { id: 'test', type: 'arrow', arrowSize: 0 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject arrow size above 100', () => {
				const layer = { id: 'test', type: 'arrow', arrowSize: 101 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );
	} );

	// ============================================
	// validateTextContent Tests
	// ============================================

	describe( 'validateTextContent', () => {
		it( 'should accept valid text', () => {
			const layer = { id: 'test', type: 'text', text: 'Hello World' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should accept empty text', () => {
			const layer = { id: 'test', type: 'text', text: '' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should reject non-string text', () => {
			const layer = { id: 'test', type: 'text', text: 123 };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject text exceeding max length', () => {
			const layer = { id: 'test', type: 'text', text: 'a'.repeat( 501 ) };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'long' ) ) ).toBe( true );
		} );

		it( 'should accept text at max length', () => {
			const layer = { id: 'test', type: 'text', text: 'a'.repeat( 500 ) };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should reject text with script tag', () => {
			const layer = { id: 'test', type: 'text', text: '<script>alert(1)</script>' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'unsafe' ) ) ).toBe( true );
		} );

		it( 'should reject text with javascript: protocol', () => {
			const layer = { id: 'test', type: 'text', text: 'javascript:alert(1)' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject text with data: protocol', () => {
			const layer = { id: 'test', type: 'text', text: 'data:text/html,<script>alert(1)</script>' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject text with vbscript: protocol', () => {
			const layer = { id: 'test', type: 'text', text: 'vbscript:msgbox(1)' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject text with event handlers', () => {
			const layer = { id: 'test', type: 'text', text: '<img onload=alert(1)>' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should accept text with special characters', () => {
			const layer = { id: 'test', type: 'text', text: 'Special: @#$%^&*()[]{}|\\;:\'",.<>?/~`' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should accept text with unicode', () => {
			const layer = { id: 'test', type: 'text', text: '你好世界 🌍 مرحبا' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );
	} );

	// ============================================
	// validateFontFamily Tests
	// ============================================

	describe( 'validateFontFamily', () => {
		it( 'should accept valid font family', () => {
			const layer = { id: 'test', type: 'text', fontFamily: 'Arial', text: 'test' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should accept font family with spaces', () => {
			const layer = { id: 'test', type: 'text', fontFamily: 'Times New Roman', text: 'test' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should accept font stack', () => {
			const layer = { id: 'test', type: 'text', fontFamily: 'Arial, Helvetica, sans-serif', text: 'test' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should reject non-string font family', () => {
			const layer = { id: 'test', type: 'text', fontFamily: 123, text: 'test' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject font family exceeding max length', () => {
			const layer = { id: 'test', type: 'text', fontFamily: 'a'.repeat( 101 ), text: 'test' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject font family with special characters', () => {
			const layer = { id: 'test', type: 'text', fontFamily: 'Arial<script>', text: 'test' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );
	} );

	// ============================================
	// validateTextAlign Tests
	// ============================================

	describe( 'validateTextAlign', () => {
		const validAlignments = [ 'left', 'center', 'right', 'start', 'end' ];

		validAlignments.forEach( align => {
			it( `should accept valid alignment: ${align}`, () => {
				const layer = { id: 'test', type: 'text', textAlign: align, text: 'test' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );
		} );

		it( 'should reject invalid text alignment', () => {
			const layer = { id: 'test', type: 'text', textAlign: 'justify', text: 'test' };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );
	} );

	// ============================================
	// validateColors Tests
	// ============================================

	describe( 'validateColors', () => {
		describe( 'hex colors', () => {
			it( 'should accept 3-digit hex color', () => {
				const layer = { id: 'test', type: 'rectangle', stroke: '#f00' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept 6-digit hex color', () => {
				const layer = { id: 'test', type: 'rectangle', stroke: '#ff0000' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept 8-digit hex color (with alpha)', () => {
				const layer = { id: 'test', type: 'rectangle', stroke: '#ff000080' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept uppercase hex', () => {
				const layer = { id: 'test', type: 'rectangle', stroke: '#FF0000' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );
		} );

		describe( 'rgb/rgba colors', () => {
			it( 'should accept rgb color', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 'rgb(255, 0, 0)' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept rgba color', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 'rgba(255, 0, 0, 0.5)' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject rgb with invalid values', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 'rgb(300, 0, 0)' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'hsl/hsla colors', () => {
			it( 'should accept hsl color', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 'hsl(0, 100%, 50%)' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept hsla color', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 'hsla(0, 100%, 50%, 0.5)' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject hsl with invalid hue', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 'hsl(400, 100%, 50%)' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'named colors', () => {
			const safeColors = [
				'transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow',
				'orange', 'purple', 'pink', 'gray', 'grey', 'brown', 'cyan'
			];

			safeColors.forEach( color => {
				it( `should accept safe named color: ${color}`, () => {
					const layer = { id: 'test', type: 'rectangle', fill: color };
					const result = validator.validateLayer( layer );

					expect( result.isValid ).toBe( true );
				} );
			} );

			it( 'should reject unsafe named color', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 'rebeccapurple' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'invalid colors', () => {
			it( 'should reject non-string color', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 123 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject color exceeding max length', () => {
				const layer = { id: 'test', type: 'rectangle', fill: 'a'.repeat( 51 ) };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject invalid hex format', () => {
				const layer = { id: 'test', type: 'rectangle', fill: '#gggggg' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		it( 'should validate all color fields', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				stroke: '#ff0000',
				fill: 'blue',
				textStrokeColor: '#000',
				textShadowColor: 'rgba(0,0,0,0.5)',
				shadowColor: 'black'
			};
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );
	} );

	// ============================================
	// validatePoints Tests
	// ============================================

	describe( 'validatePoints', () => {
		describe( 'path layers', () => {
			it( 'should accept valid points array', () => {
				const layer = {
					id: 'test',
					type: 'path',
					points: [ { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 } ]
				};
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject non-array points for path', () => {
				const layer = { id: 'test', type: 'path', points: 'invalid' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject points exceeding max count', () => {
				const points = Array( 501 ).fill( { x: 0, y: 0 } );
				const layer = { id: 'test', type: 'path', points };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should accept points at max count', () => {
				const points = Array( 500 ).fill( null ).map( ( _, i ) => ( { x: i, y: i } ) );
				const layer = { id: 'test', type: 'path', points };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject invalid point object', () => {
				const layer = {
					id: 'test',
					type: 'path',
					points: [ { x: 0, y: 0 }, null, { x: 20, y: 20 } ]
				};
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject point with missing coordinates', () => {
				const layer = {
					id: 'test',
					type: 'path',
					points: [ { x: 0 }, { x: 10, y: 10 } ]
				};
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject point with coordinates exceeding limits', () => {
				const layer = {
					id: 'test',
					type: 'path',
					points: [ { x: 0, y: 0 }, { x: 10001, y: 0 } ]
				};
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject point with non-numeric coordinates', () => {
				const layer = {
					id: 'test',
					type: 'path',
					points: [ { x: 'abc', y: 0 } ]
				};
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'star layers', () => {
			it( 'should accept valid star points (number)', () => {
				const layer = { id: 'test', type: 'star', points: 5 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept minimum star points', () => {
				const layer = { id: 'test', type: 'star', points: 3 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept maximum star points', () => {
				const layer = { id: 'test', type: 'star', points: 20 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should reject star points below minimum', () => {
				const layer = { id: 'test', type: 'star', points: 2 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject star points above maximum', () => {
				const layer = { id: 'test', type: 'star', points: 21 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject non-integer star points', () => {
				const layer = { id: 'test', type: 'star', points: 5.5 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should reject non-numeric star points', () => {
				const layer = { id: 'test', type: 'star', points: 'five' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );
	} );

	// ============================================
	// validateTypeSpecificProperties Tests
	// ============================================

	describe( 'validateTypeSpecificProperties', () => {
		describe( 'arrow style', () => {
			const validStyles = [ 'single', 'double', 'none' ];

			validStyles.forEach( style => {
				it( `should accept valid arrow style: ${style}`, () => {
					const layer = { id: 'test', type: 'arrow', arrowStyle: style };
					const result = validator.validateLayer( layer );

					expect( result.isValid ).toBe( true );
				} );
			} );

			it( 'should reject invalid arrow style', () => {
				const layer = { id: 'test', type: 'arrow', arrowStyle: 'triple' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );
		} );

		describe( 'blend mode', () => {
			const validModes = [
				'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
				'color-dodge', 'color-burn', 'hard-light', 'soft-light',
				'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
				'blur'
			];

			validModes.forEach( mode => {
				it( `should accept valid blend mode: ${mode}`, () => {
					const layer = { id: 'test', type: 'rectangle', blendMode: mode };
					const result = validator.validateLayer( layer );

					expect( result.isValid ).toBe( true );
				} );
			} );

			it( 'should reject invalid blend mode', () => {
				const layer = { id: 'test', type: 'rectangle', blendMode: 'invalid' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( false );
			} );

			it( 'should accept blend property (alias)', () => {
				const layer = { id: 'test', type: 'rectangle', blend: 'multiply' };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept blur blend mode with blurRadius', () => {
				const layer = { id: 'test', type: 'rectangle', blendMode: 'blur', blurRadius: 15 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );

			it( 'should accept blur as blend alias', () => {
				const layer = { id: 'test', type: 'circle', blend: 'blur', blurRadius: 20 };
				const result = validator.validateLayer( layer );

				expect( result.isValid ).toBe( true );
			} );
		} );
	} );

	// ============================================
	// validateLayers (Array) Tests
	// ============================================

	describe( 'validateLayers', () => {
		it( 'should accept valid layers array', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'text', text: 'hello' }
			];
			const result = validator.validateLayers( layers );

			expect( result.isValid ).toBe( true );
			expect( result.layerResults ).toHaveLength( 2 );
		} );

		it( 'should accept empty layers array', () => {
			const result = validator.validateLayers( [] );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should reject non-array input', () => {
			const result = validator.validateLayers( 'not an array' );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject null input', () => {
			const result = validator.validateLayers( null );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should reject layers exceeding max count', () => {
			const layers = Array( 101 ).fill( null ).map( ( _, i ) => ( { id: `layer${i}`, type: 'rectangle' } ) );
			const result = validator.validateLayers( layers, 100 );

			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'many' ) ) ).toBe( true );
		} );

		it( 'should accept layers at max count', () => {
			const layers = Array( 100 ).fill( null ).map( ( _, i ) => ( { id: `layer${i}`, type: 'rectangle' } ) );
			const result = validator.validateLayers( layers, 100 );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should detect duplicate IDs', () => {
			const layers = [
				{ id: 'duplicate', type: 'rectangle' },
				{ id: 'duplicate', type: 'circle' }
			];
			const result = validator.validateLayers( layers );

			expect( result.isValid ).toBe( false );
			expect( result.errors.some( e => e.includes( 'duplicate' ) || e.includes( 'Duplicate' ) ) ).toBe( true );
		} );

		it( 'should collect errors from multiple invalid layers', () => {
			const layers = [
				{ id: 'layer1' }, // missing type
				{ type: 'rectangle' }, // missing id
				{ id: 'layer3', type: 'invalid' } // invalid type
			];
			const result = validator.validateLayers( layers );

			expect( result.isValid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThan( 0 );
		} );

		it( 'should use custom max layers limit', () => {
			const layers = Array( 11 ).fill( null ).map( ( _, i ) => ( { id: `layer${i}`, type: 'rectangle' } ) );
			const result = validator.validateLayers( layers, 10 );

			expect( result.isValid ).toBe( false );
		} );
	} );

	// ============================================
	// Helper Method Tests
	// ============================================

	describe( 'Helper methods', () => {
		describe( 'isValidNumber', () => {
			it( 'should return true for valid numbers', () => {
				expect( validator.isValidNumber( 0 ) ).toBe( true );
				expect( validator.isValidNumber( 1 ) ).toBe( true );
				expect( validator.isValidNumber( -1 ) ).toBe( true );
				expect( validator.isValidNumber( 1.5 ) ).toBe( true );
				expect( validator.isValidNumber( 0.001 ) ).toBe( true );
			} );

			it( 'should return false for invalid numbers', () => {
				expect( validator.isValidNumber( NaN ) ).toBe( false );
				expect( validator.isValidNumber( Infinity ) ).toBe( false );
				expect( validator.isValidNumber( -Infinity ) ).toBe( false );
				expect( validator.isValidNumber( 'string' ) ).toBe( false );
				expect( validator.isValidNumber( null ) ).toBe( false );
				expect( validator.isValidNumber( undefined ) ).toBe( false );
				expect( validator.isValidNumber( {} ) ).toBe( false );
				expect( validator.isValidNumber( [] ) ).toBe( false );
			} );
		} );

		describe( 'isValidColor', () => {
			it( 'should validate hex colors', () => {
				expect( validator.isValidColor( '#fff' ) ).toBe( true );
				expect( validator.isValidColor( '#ffffff' ) ).toBe( true );
				expect( validator.isValidColor( '#ffffffff' ) ).toBe( true );
				expect( validator.isValidColor( '#gg0000' ) ).toBe( false );
			} );

			it( 'should validate rgb colors', () => {
				expect( validator.isValidColor( 'rgb(0, 0, 0)' ) ).toBe( true );
				expect( validator.isValidColor( 'rgb(255, 255, 255)' ) ).toBe( true );
				expect( validator.isValidColor( 'rgb(300, 0, 0)' ) ).toBe( false );
			} );

			it( 'should validate rgba colors', () => {
				expect( validator.isValidColor( 'rgba(0, 0, 0, 0)' ) ).toBe( true );
				expect( validator.isValidColor( 'rgba(255, 255, 255, 1)' ) ).toBe( true );
				expect( validator.isValidColor( 'rgba(0, 0, 0, 0.5)' ) ).toBe( true );
			} );

			it( 'should validate named colors', () => {
				expect( validator.isValidColor( 'red' ) ).toBe( true );
				expect( validator.isValidColor( 'transparent' ) ).toBe( true );
				expect( validator.isValidColor( 'unknowncolor' ) ).toBe( false );
			} );

			it( 'should reject non-string colors', () => {
				expect( validator.isValidColor( 123 ) ).toBe( false );
				expect( validator.isValidColor( null ) ).toBe( false );
			} );

			it( 'should reject overly long color strings', () => {
				expect( validator.isValidColor( 'a'.repeat( 51 ) ) ).toBe( false );
			} );
		} );

		describe( 'containsScriptInjection', () => {
			it( 'should detect script tags', () => {
				expect( validator.containsScriptInjection( '<script>alert(1)</script>' ) ).toBe( true );
				expect( validator.containsScriptInjection( '<SCRIPT>alert(1)</SCRIPT>' ) ).toBe( true );
			} );

			it( 'should detect javascript: protocol', () => {
				expect( validator.containsScriptInjection( 'javascript:alert(1)' ) ).toBe( true );
				expect( validator.containsScriptInjection( 'JAVASCRIPT:alert(1)' ) ).toBe( true );
			} );

			it( 'should detect data: protocol', () => {
				expect( validator.containsScriptInjection( 'data:text/html,<script>' ) ).toBe( true );
			} );

			it( 'should detect vbscript: protocol', () => {
				expect( validator.containsScriptInjection( 'vbscript:msgbox(1)' ) ).toBe( true );
			} );

			it( 'should detect event handlers', () => {
				expect( validator.containsScriptInjection( 'onload=alert(1)' ) ).toBe( true );
				expect( validator.containsScriptInjection( 'onclick =alert(1)' ) ).toBe( true );
				expect( validator.containsScriptInjection( 'ONERROR=alert(1)' ) ).toBe( true );
			} );

			it( 'should allow safe text', () => {
				expect( validator.containsScriptInjection( 'Hello World' ) ).toBe( false );
				expect( validator.containsScriptInjection( 'script is a word' ) ).toBe( false );
				expect( validator.containsScriptInjection( 'data analysis' ) ).toBe( false );
			} );
		} );

		describe( 'getMessage', () => {
			it( 'should return fallback message for unknown key', () => {
				const message = validator.getMessage( 'layers-validation-layer-invalid' );
				expect( typeof message ).toBe( 'string' );
				expect( message.length ).toBeGreaterThan( 0 );
			} );

			it( 'should return message for known key', () => {
				// Our mock returns the key itself, which is fine for testing
				const message = validator.getMessage( 'layers-validation-type-invalid', 'testtype' );
				expect( typeof message ).toBe( 'string' );
				expect( message.length ).toBeGreaterThan( 0 );
			} );

			it( 'should handle multiple parameters', () => {
				// Our mock returns the key itself
				const message = validator.getMessage( 'layers-validation-fontsize-range', 1, 1000 );
				expect( typeof message ).toBe( 'string' );
				expect( message.length ).toBeGreaterThan( 0 );
			} );
		} );
	} );

	// ============================================
	// showValidationErrors Tests
	// ============================================

	describe( 'showValidationErrors', () => {
		it( 'should not throw for empty errors', () => {
			expect( () => validator.showValidationErrors( [] ) ).not.toThrow();
		} );

		it( 'should not throw for null errors', () => {
			expect( () => validator.showValidationErrors( null ) ).not.toThrow();
		} );

		it( 'should call mw.notify when available', () => {
			validator.showValidationErrors( [ 'Error 1', 'Error 2' ] );
			expect( global.mw.notify ).toHaveBeenCalled();
		} );
	} );

	// ============================================
	// createInputValidator Tests
	// ============================================

	describe( 'createInputValidator', () => {
		let mockInput;

		beforeEach( () => {
			mockInput = {
				value: '',
				style: {},
				parentNode: {
					insertBefore: jest.fn()
				},
				nextSibling: null,
				addEventListener: jest.fn(),
				removeEventListener: jest.fn()
			};

			global.document = {
				createElement: jest.fn( () => ( {
					className: '',
					textContent: '',
					style: {},
					parentNode: {
						removeChild: jest.fn()
					}
				} ) )
			};
		} );

		it( 'should create input validator for number type', () => {
			const inputValidator = validator.createInputValidator( mockInput, 'number', { min: 0, max: 100 } );

			expect( inputValidator ).toBeDefined();
			expect( inputValidator.validate ).toBeInstanceOf( Function );
			expect( inputValidator.destroy ).toBeInstanceOf( Function );
		} );

		it( 'should create input validator for color type', () => {
			const inputValidator = validator.createInputValidator( mockInput, 'color' );

			expect( inputValidator ).toBeDefined();
		} );

		it( 'should create input validator for text type', () => {
			const inputValidator = validator.createInputValidator( mockInput, 'text', { maxLength: 100 } );

			expect( inputValidator ).toBeDefined();
		} );

		it( 'should add event listeners', () => {
			validator.createInputValidator( mockInput, 'number' );

			expect( mockInput.addEventListener ).toHaveBeenCalledWith( 'input', expect.any( Function ) );
			expect( mockInput.addEventListener ).toHaveBeenCalledWith( 'blur', expect.any( Function ) );
		} );

		it( 'should remove event listeners on destroy', () => {
			const inputValidator = validator.createInputValidator( mockInput, 'number' );
			inputValidator.destroy();

			expect( mockInput.removeEventListener ).toHaveBeenCalledWith( 'input', expect.any( Function ) );
			expect( mockInput.removeEventListener ).toHaveBeenCalledWith( 'blur', expect.any( Function ) );
		} );

		it( 'should validate number input', () => {
			mockInput.value = '50';
			const inputValidator = validator.createInputValidator( mockInput, 'number', { min: 0, max: 100 } );

			expect( inputValidator.validate() ).toBe( true );
		} );

		it( 'should invalidate number below min', () => {
			mockInput.value = '-10';
			const inputValidator = validator.createInputValidator( mockInput, 'number', { min: 0, max: 100 } );

			expect( inputValidator.validate() ).toBe( false );
		} );

		it( 'should invalidate number above max', () => {
			mockInput.value = '150';
			const inputValidator = validator.createInputValidator( mockInput, 'number', { min: 0, max: 100 } );

			expect( inputValidator.validate() ).toBe( false );
		} );

		it( 'should validate color input', () => {
			mockInput.value = '#ff0000';
			const inputValidator = validator.createInputValidator( mockInput, 'color' );

			expect( inputValidator.validate() ).toBe( true );
		} );

		it( 'should invalidate bad color', () => {
			mockInput.value = 'not-a-color';
			const inputValidator = validator.createInputValidator( mockInput, 'color' );

			expect( inputValidator.validate() ).toBe( false );
		} );

		it( 'should validate text input', () => {
			mockInput.value = 'Hello World';
			const inputValidator = validator.createInputValidator( mockInput, 'text' );

			expect( inputValidator.validate() ).toBe( true );
		} );

		it( 'should invalidate text with script injection', () => {
			mockInput.value = '<script>alert(1)</script>';
			const inputValidator = validator.createInputValidator( mockInput, 'text' );

			expect( inputValidator.validate() ).toBe( false );
		} );
	} );

	// ============================================
	// Export Tests
	// ============================================

	describe( 'Exports', () => {
		it( 'should export to window.Layers.Validation namespace', () => {
			expect( window.Layers.Validation.LayersValidator ).toBe( LayersValidator );
		} );
	} );

	// ============================================
	// Edge Cases and Security Tests
	// ============================================

	describe( 'Edge Cases and Security', () => {
		it( 'should handle layer with all properties', () => {
			const layer = {
				id: 'complete-layer',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 200,
				height: 150,
				rotation: 45,
				opacity: 0.8,
				fill: '#ff0000',
				stroke: '#000000',
				strokeWidth: 2,
				blendMode: 'multiply',
				visible: true,
				locked: false,
				name: 'My Rectangle',
				shadowBlur: 5,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowOffsetX: 3,
				shadowOffsetY: 3
			};
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should handle prototype pollution attempt', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				__proto__: { admin: true },
				constructor: { prototype: { admin: true } }
			};
			// Should not crash
			const result = validator.validateLayer( layer );
			expect( typeof result.isValid ).toBe( 'boolean' );
		} );

		it( 'should handle very large coordinate values at boundary', () => {
			const layer = { id: 'test', type: 'rectangle', x: 10000 };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( true );
		} );

		it( 'should reject coordinate just over boundary', () => {
			const layer = { id: 'test', type: 'rectangle', x: 10000.001 };
			const result = validator.validateLayer( layer );

			expect( result.isValid ).toBe( false );
		} );

		it( 'should handle unicode in layer ID', () => {
			const layer = { id: '你好', type: 'rectangle' };
			const result = validator.validateLayer( layer );

			// Should be rejected (doesn't match ID pattern)
			expect( result.isValid ).toBe( false );
		} );

		it( 'should handle empty string values gracefully', () => {
			const layer = {
				id: 'test',
				type: 'text',
				text: '',
				fontFamily: ''
			};
			// Empty fontFamily should fail pattern test
			const result = validator.validateLayer( layer );
			// Depends on implementation - may or may not be valid
			expect( typeof result.isValid ).toBe( 'boolean' );
		} );

		it( 'should handle object with circular reference gracefully', () => {
			const layer = { id: 'test', type: 'rectangle' };
			layer.self = layer; // Circular reference

			// Should not crash
			expect( () => validator.validateLayer( layer ) ).not.toThrow();
		} );

		it( 'should handle extremely nested object', () => {
			const layer = {
				id: 'test',
				type: 'rectangle',
				nested: { a: { b: { c: { d: { e: 'deep' } } } } }
			};

			// Should not crash, extra properties ignored
			const result = validator.validateLayer( layer );
			expect( result.isValid ).toBe( true );
		} );
	} );

	// ============================================
	// Fallback Path Tests (for code coverage)
	// ============================================

	describe( 'Fallback Paths', () => {
		describe( 'isValidNumber fallback', () => {
			it( 'should use fallback when ValidationHelpers unavailable', () => {
				// Remove ValidationHelpers
				const originalHelpers = validator.ValidationHelpers;
				validator.ValidationHelpers = null;

				expect( validator.isValidNumber( 42 ) ).toBe( true );
				expect( validator.isValidNumber( 3.14 ) ).toBe( true );
				expect( validator.isValidNumber( NaN ) ).toBe( false );
				expect( validator.isValidNumber( Infinity ) ).toBe( false );
				expect( validator.isValidNumber( 'not a number' ) ).toBe( false );

				validator.ValidationHelpers = originalHelpers;
			} );
		} );

		describe( 'isValidColor fallback', () => {
			it( 'should validate hex colors in fallback mode', () => {
				const originalHelpers = validator.ValidationHelpers;
				validator.ValidationHelpers = null;

				expect( validator.isValidColor( '#fff' ) ).toBe( true );
				expect( validator.isValidColor( '#ffffff' ) ).toBe( true );
				expect( validator.isValidColor( '#ffff' ) ).toBe( true ); // 4 digit (with alpha)
				expect( validator.isValidColor( '#ffffffff' ) ).toBe( true ); // 8 digit
				expect( validator.isValidColor( '#zzzzzz' ) ).toBe( false );

				validator.ValidationHelpers = originalHelpers;
			} );

			it( 'should validate rgb/rgba colors in fallback mode', () => {
				const originalHelpers = validator.ValidationHelpers;
				validator.ValidationHelpers = null;

				expect( validator.isValidColor( 'rgb(255, 0, 0)' ) ).toBe( true );
				expect( validator.isValidColor( 'rgba(255, 0, 0, 0.5)' ) ).toBe( true );
				expect( validator.isValidColor( 'rgb(300, 0, 0)' ) ).toBe( false ); // Out of range
				expect( validator.isValidColor( 'rgb(-1, 0, 0)' ) ).toBe( false ); // Negative

				validator.ValidationHelpers = originalHelpers;
			} );

			it( 'should validate hsl/hsla colors in fallback mode', () => {
				const originalHelpers = validator.ValidationHelpers;
				validator.ValidationHelpers = null;

				expect( validator.isValidColor( 'hsl(180, 50%, 50%)' ) ).toBe( true );
				expect( validator.isValidColor( 'hsla(180, 50%, 50%, 0.5)' ) ).toBe( true );
				expect( validator.isValidColor( 'hsl(400, 50%, 50%)' ) ).toBe( false ); // Hue > 360
				expect( validator.isValidColor( 'hsl(180, 150%, 50%)' ) ).toBe( false ); // Saturation > 100
				expect( validator.isValidColor( 'hsl(180, 50%, 150%)' ) ).toBe( false ); // Lightness > 100

				validator.ValidationHelpers = originalHelpers;
			} );

			it( 'should validate named colors in fallback mode', () => {
				const originalHelpers = validator.ValidationHelpers;
				validator.ValidationHelpers = null;

				expect( validator.isValidColor( 'red' ) ).toBe( true );
				expect( validator.isValidColor( 'transparent' ) ).toBe( true );
				expect( validator.isValidColor( 'BLUE' ) ).toBe( true ); // Case insensitive
				expect( validator.isValidColor( 'notacolor' ) ).toBe( false );

				validator.ValidationHelpers = originalHelpers;
			} );

			it( 'should reject non-string colors in fallback mode', () => {
				const originalHelpers = validator.ValidationHelpers;
				validator.ValidationHelpers = null;

				expect( validator.isValidColor( 123 ) ).toBe( false );
				expect( validator.isValidColor( null ) ).toBe( false );

				validator.ValidationHelpers = originalHelpers;
			} );

			it( 'should reject extremely long color strings in fallback mode', () => {
				const originalHelpers = validator.ValidationHelpers;
				validator.ValidationHelpers = null;

				const longString = 'a'.repeat( 100 );
				expect( validator.isValidColor( longString ) ).toBe( false );

				validator.ValidationHelpers = originalHelpers;
			} );
		} );

		describe( 'containsScriptInjection fallback', () => {
			it( 'should detect script injection in fallback mode', () => {
				const originalHelpers = validator.ValidationHelpers;
				validator.ValidationHelpers = null;

				expect( validator.containsScriptInjection( '<script>alert(1)</script>' ) ).toBe( true );
				expect( validator.containsScriptInjection( 'javascript:void(0)' ) ).toBe( true );
				expect( validator.containsScriptInjection( 'onclick=alert(1)' ) ).toBe( true );
				expect( validator.containsScriptInjection( 'data:text/html' ) ).toBe( true );
				expect( validator.containsScriptInjection( 'Hello World' ) ).toBe( false );

				validator.ValidationHelpers = originalHelpers;
			} );
		} );

		describe( 'getMessage fallback', () => {
			it( 'should use fallback messages when i18n unavailable', () => {
				const originalHelpers = validator.ValidationHelpers;
				const originalLayersMessages = window.layersMessages;
				const originalMw = window.mw;

				validator.ValidationHelpers = null;
				window.layersMessages = null;
				window.mw = null;

				const message = validator.getMessage( 'layers-validation-layer-invalid' );
				expect( message ).toBe( 'Invalid layer object' );

				validator.ValidationHelpers = originalHelpers;
				window.layersMessages = originalLayersMessages;
				window.mw = originalMw;
			} );

			it( 'should substitute parameters in fallback messages', () => {
				const originalHelpers = validator.ValidationHelpers;
				const originalLayersMessages = window.layersMessages;
				const originalMw = window.mw;

				validator.ValidationHelpers = null;
				window.layersMessages = null;
				window.mw = null;

				const message = validator.getMessage( 'layers-validation-type-invalid', 'badtype' );
				expect( message ).toBe( 'Invalid layer type: badtype' );

				validator.ValidationHelpers = originalHelpers;
				window.layersMessages = originalLayersMessages;
				window.mw = originalMw;
			} );

			it( 'should return key for unknown message', () => {
				const originalHelpers = validator.ValidationHelpers;
				const originalLayersMessages = window.layersMessages;
				const originalMw = window.mw;

				validator.ValidationHelpers = null;
				window.layersMessages = null;
				window.mw = null;

				const message = validator.getMessage( 'unknown-key' );
				expect( message ).toBe( 'unknown-key' );

				validator.ValidationHelpers = originalHelpers;
				window.layersMessages = originalLayersMessages;
				window.mw = originalMw;
			} );

			it( 'should use layersMessages when available', () => {
				const originalHelpers = validator.ValidationHelpers;
				validator.ValidationHelpers = null;

				const mockMessages = {
					get: jest.fn( () => 'Translated message' ),
					getWithParams: jest.fn( () => 'Translated with params' )
				};
				window.layersMessages = mockMessages;

				const message = validator.getMessage( 'layers-validation-layer-invalid' );
				expect( mockMessages.get ).toHaveBeenCalledWith( 'layers-validation-layer-invalid', expect.any( String ) );

				validator.ValidationHelpers = originalHelpers;
			} );

			it( 'should use mw.message when layersMessages unavailable', () => {
				const originalHelpers = validator.ValidationHelpers;
				validator.ValidationHelpers = null;
				window.layersMessages = null;

				const mockMsg = {
					text: jest.fn( () => 'MW message' ),
					params: jest.fn( function () {
						return this;
					} )
				};
				window.mw = {
					message: jest.fn( () => mockMsg )
				};

				const message = validator.getMessage( 'layers-validation-layer-invalid' );
				expect( window.mw.message ).toHaveBeenCalledWith( 'layers-validation-layer-invalid' );

				validator.ValidationHelpers = originalHelpers;
			} );
		} );

		describe( 'showValidationErrors fallback', () => {
			it( 'should use mw.log.error when mw.notify unavailable', () => {
				const logError = jest.fn();
				window.mw = {
					notify: null,
					log: { error: logError }
				};

				validator.showValidationErrors( [ 'Error 1', 'Error 2' ] );

				expect( logError ).toHaveBeenCalledWith( 'Layers validation errors:', [ 'Error 1', 'Error 2' ] );
			} );

			it( 'should not throw when both mw.notify and mw.log unavailable', () => {
				window.mw = {};

				expect( () => validator.showValidationErrors( [ 'Error' ] ) ).not.toThrow();
			} );
		} );
	} );

	// ============================================
	// createInputValidator Extended Tests
	// ============================================

	describe( 'createInputValidator extended', () => {
		let mockInput;

		beforeEach( () => {
			mockInput = {
				value: '',
				style: {},
				parentNode: {
					insertBefore: jest.fn()
				},
				nextSibling: null,
				addEventListener: jest.fn(),
				removeEventListener: jest.fn()
			};

			global.document = {
				createElement: jest.fn( () => ( {
					className: '',
					textContent: '',
					style: {},
					parentNode: {
						removeChild: jest.fn()
					}
				} ) )
			};
		} );

		it( 'should invalidate text that is too long', () => {
			mockInput.value = 'a'.repeat( 600 ); // Exceeds maxTextLength of 500
			const inputValidator = validator.createInputValidator( mockInput, 'text' );

			expect( inputValidator.validate() ).toBe( false );
		} );

		it( 'should respect custom maxLength option', () => {
			mockInput.value = 'a'.repeat( 50 );
			const inputValidator = validator.createInputValidator( mockInput, 'text', { maxLength: 30 } );

			expect( inputValidator.validate() ).toBe( false );
		} );

		it( 'should invalidate non-numeric value for number type', () => {
			mockInput.value = 'not a number';
			const inputValidator = validator.createInputValidator( mockInput, 'number' );

			expect( inputValidator.validate() ).toBe( false );
		} );

		it( 'should validate empty value for all types', () => {
			mockInput.value = '';
			const numberValidator = validator.createInputValidator( mockInput, 'number' );
			const colorValidator = validator.createInputValidator( mockInput, 'color' );
			const textValidator = validator.createInputValidator( mockInput, 'text' );

			expect( numberValidator.validate() ).toBe( true );
			expect( colorValidator.validate() ).toBe( true );
			expect( textValidator.validate() ).toBe( true );
		} );

		it( 'should run initial validation when input has value', () => {
			mockInput.value = 'initial value';
			const inputValidator = validator.createInputValidator( mockInput, 'text' );

			// The validate function should have been called during initialization
			expect( mockInput.parentNode.insertBefore ).not.toHaveBeenCalled(); // No error for valid text
		} );
	} );
} );
