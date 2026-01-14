/**
 * Tests for GradientRenderer
 * @jest-environment jsdom
 */

'use strict';

// Mock mw
global.mw = {
	log: {
		warn: jest.fn()
	}
};

const GradientRenderer = require( '../../../resources/ext.layers.shared/GradientRenderer.js' );

describe( 'GradientRenderer', () => {
	let ctx;
	let renderer;
	let mockLinearGradient;
	let mockRadialGradient;

	beforeEach( () => {
		mockLinearGradient = {
			addColorStop: jest.fn()
		};
		mockRadialGradient = {
			addColorStop: jest.fn()
		};

		ctx = {
			createLinearGradient: jest.fn().mockReturnValue( mockLinearGradient ),
			createRadialGradient: jest.fn().mockReturnValue( mockRadialGradient ),
			fillStyle: null,
			fill: jest.fn()
		};

		renderer = new GradientRenderer( ctx );
	} );

	afterEach( () => {
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should create instance with context', () => {
			expect( renderer.ctx ).toBe( ctx );
		} );
	} );

	describe( 'setContext', () => {
		it( 'should update the context', () => {
			const newCtx = { createLinearGradient: jest.fn() };
			renderer.setContext( newCtx );
			expect( renderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'hasGradient', () => {
		it( 'should return true for valid linear gradient', () => {
			const layer = {
				gradient: {
					type: 'linear',
					colors: [
						{ offset: 0, color: '#ff0000' },
						{ offset: 1, color: '#0000ff' }
					]
				}
			};
			expect( GradientRenderer.hasGradient( layer ) ).toBe( true );
		} );

		it( 'should return true for valid radial gradient', () => {
			const layer = {
				gradient: {
					type: 'radial',
					colors: [
						{ offset: 0, color: '#ffffff' },
						{ offset: 1, color: '#000000' }
					]
				}
			};
			expect( GradientRenderer.hasGradient( layer ) ).toBe( true );
		} );

		it( 'should return falsy for null layer', () => {
			expect( GradientRenderer.hasGradient( null ) ).toBeFalsy();
		} );

		it( 'should return falsy for layer without gradient', () => {
			expect( GradientRenderer.hasGradient( { fill: '#ff0000' } ) ).toBeFalsy();
		} );

		it( 'should return false for invalid gradient type', () => {
			const layer = {
				gradient: {
					type: 'invalid',
					colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ]
				}
			};
			expect( GradientRenderer.hasGradient( layer ) ).toBe( false );
		} );

		it( 'should return false for less than 2 colors', () => {
			const layer = {
				gradient: {
					type: 'linear',
					colors: [ { offset: 0, color: '#fff' } ]
				}
			};
			expect( GradientRenderer.hasGradient( layer ) ).toBe( false );
		} );

		it( 'should return false for non-array colors', () => {
			const layer = {
				gradient: {
					type: 'linear',
					colors: 'not an array'
				}
			};
			expect( GradientRenderer.hasGradient( layer ) ).toBe( false );
		} );
	} );

	describe( 'createGradient', () => {
		const bounds = { x: 0, y: 0, width: 100, height: 100 };

		it( 'should create linear gradient', () => {
			const layer = {
				gradient: {
					type: 'linear',
					angle: 90,
					colors: [
						{ offset: 0, color: '#ff0000' },
						{ offset: 1, color: '#0000ff' }
					]
				}
			};

			const result = renderer.createGradient( layer, bounds );

			expect( ctx.createLinearGradient ).toHaveBeenCalled();
			expect( result ).toBe( mockLinearGradient );
			expect( mockLinearGradient.addColorStop ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'should create radial gradient', () => {
			const layer = {
				gradient: {
					type: 'radial',
					centerX: 0.5,
					centerY: 0.5,
					radius: 0.5,
					colors: [
						{ offset: 0, color: '#ffffff' },
						{ offset: 1, color: '#000000' }
					]
				}
			};

			const result = renderer.createGradient( layer, bounds );

			expect( ctx.createRadialGradient ).toHaveBeenCalled();
			expect( result ).toBe( mockRadialGradient );
		} );

		it( 'should return null for layer without gradient', () => {
			const layer = { fill: '#ff0000' };
			const result = renderer.createGradient( layer, bounds );
			expect( result ).toBeNull();
		} );

		it( 'should apply scale factor', () => {
			const layer = {
				gradient: {
					type: 'linear',
					angle: 0,
					colors: [
						{ offset: 0, color: '#fff' },
						{ offset: 1, color: '#000' }
					]
				}
			};

			renderer.createGradient( layer, bounds, { scale: 2 } );

			// With scale 2, coordinates should be doubled
			expect( ctx.createLinearGradient ).toHaveBeenCalled();
		} );

		it( 'should use default angle of 0 for linear gradient', () => {
			const layer = {
				gradient: {
					type: 'linear',
					// no angle specified
					colors: [
						{ offset: 0, color: '#fff' },
						{ offset: 1, color: '#000' }
					]
				}
			};

			renderer.createGradient( layer, bounds );
			expect( ctx.createLinearGradient ).toHaveBeenCalled();
		} );

		it( 'should use default center for radial gradient', () => {
			const layer = {
				gradient: {
					type: 'radial',
					// no centerX, centerY, radius specified
					colors: [
						{ offset: 0, color: '#fff' },
						{ offset: 1, color: '#000' }
					]
				}
			};

			renderer.createGradient( layer, bounds );
			// Default center is 0.5, 0.5 -> 50, 50 with 100x100 bounds
			// Default radius is 0.5 (50% of max dimension = 50)
			expect( ctx.createRadialGradient ).toHaveBeenCalledWith( 50, 50, 0, 50, 50, 50 );
		} );

		it( 'should handle invalid color gracefully', () => {
			mockLinearGradient.addColorStop.mockImplementationOnce( () => {
				throw new Error( 'Invalid color' );
			} );

			const layer = {
				gradient: {
					type: 'linear',
					colors: [
						{ offset: 0, color: 'invalid' },
						{ offset: 1, color: '#000' }
					]
				}
			};

			const result = renderer.createGradient( layer, bounds );
			expect( result ).toBe( mockLinearGradient );
			expect( mw.log.warn ).toHaveBeenCalled();
		} );

		it( 'should sort color stops by offset', () => {
			const layer = {
				gradient: {
					type: 'linear',
					colors: [
						{ offset: 1, color: '#0000ff' },
						{ offset: 0, color: '#ff0000' },
						{ offset: 0.5, color: '#00ff00' }
					]
				}
			};

			renderer.createGradient( layer, bounds );

			// Should be sorted: 0, 0.5, 1
			expect( mockLinearGradient.addColorStop ).toHaveBeenNthCalledWith( 1, 0, '#ff0000' );
			expect( mockLinearGradient.addColorStop ).toHaveBeenNthCalledWith( 2, 0.5, '#00ff00' );
			expect( mockLinearGradient.addColorStop ).toHaveBeenNthCalledWith( 3, 1, '#0000ff' );
		} );

		it( 'should clamp offset values to 0-1 range', () => {
			const layer = {
				gradient: {
					type: 'linear',
					colors: [
						{ offset: -0.5, color: '#ff0000' },
						{ offset: 1.5, color: '#0000ff' }
					]
				}
			};

			renderer.createGradient( layer, bounds );

			expect( mockLinearGradient.addColorStop ).toHaveBeenCalledWith( 0, '#ff0000' );
			expect( mockLinearGradient.addColorStop ).toHaveBeenCalledWith( 1, '#0000ff' );
		} );
	} );

	describe( 'applyFill', () => {
		const bounds = { x: 0, y: 0, width: 100, height: 100 };

		it( 'should apply gradient and return true', () => {
			const layer = {
				gradient: {
					type: 'linear',
					colors: [
						{ offset: 0, color: '#fff' },
						{ offset: 1, color: '#000' }
					]
				}
			};

			const result = renderer.applyFill( layer, bounds );

			expect( result ).toBe( true );
			expect( ctx.fillStyle ).toBe( mockLinearGradient );
		} );

		it( 'should fall back to solid fill and return false', () => {
			const layer = { fill: '#ff0000' };

			const result = renderer.applyFill( layer, bounds );

			expect( result ).toBe( false );
			expect( ctx.fillStyle ).toBe( '#ff0000' );
		} );

		it( 'should not apply fill for none/transparent', () => {
			const layer = { fill: 'none' };

			const result = renderer.applyFill( layer, bounds );

			expect( result ).toBe( false );
		} );
	} );

	describe( 'createDefaultGradient', () => {
		it( 'should create default linear gradient', () => {
			const gradient = GradientRenderer.createDefaultGradient( 'linear', '#ff0000', '#0000ff' );

			expect( gradient.type ).toBe( 'linear' );
			expect( gradient.angle ).toBe( 90 );
			expect( gradient.colors ).toHaveLength( 2 );
			expect( gradient.colors[ 0 ].color ).toBe( '#ff0000' );
			expect( gradient.colors[ 1 ].color ).toBe( '#0000ff' );
		} );

		it( 'should create default radial gradient', () => {
			const gradient = GradientRenderer.createDefaultGradient( 'radial' );

			expect( gradient.type ).toBe( 'radial' );
			expect( gradient.centerX ).toBe( 0.5 );
			expect( gradient.centerY ).toBe( 0.5 );
			expect( gradient.radius ).toBe( 0.7 );
		} );

		it( 'should use default colors when not specified', () => {
			const gradient = GradientRenderer.createDefaultGradient( 'linear' );

			expect( gradient.colors[ 0 ].color ).toBe( '#ffffff' );
			expect( gradient.colors[ 1 ].color ).toBe( '#000000' );
		} );
	} );

	describe( 'getPresets', () => {
		it( 'should return preset gradients', () => {
			const presets = GradientRenderer.getPresets();

			expect( presets ).toHaveProperty( 'sunset' );
			expect( presets ).toHaveProperty( 'ocean' );
			expect( presets ).toHaveProperty( 'forest' );
			expect( presets ).toHaveProperty( 'fire' );
			expect( presets ).toHaveProperty( 'steel' );
			expect( presets ).toHaveProperty( 'rainbow' );
		} );

		it( 'should have valid gradient structures', () => {
			const presets = GradientRenderer.getPresets();

			Object.values( presets ).forEach( ( preset ) => {
				expect( [ 'linear', 'radial' ] ).toContain( preset.type );
				expect( Array.isArray( preset.colors ) ).toBe( true );
				expect( preset.colors.length ).toBeGreaterThanOrEqual( 2 );
			} );
		} );
	} );

	describe( 'validate', () => {
		it( 'should validate correct linear gradient', () => {
			const gradient = {
				type: 'linear',
				angle: 90,
				colors: [
					{ offset: 0, color: '#fff' },
					{ offset: 1, color: '#000' }
				]
			};

			const result = GradientRenderer.validate( gradient );
			expect( result.valid ).toBe( true );
			expect( result.errors ).toHaveLength( 0 );
		} );

		it( 'should validate correct radial gradient', () => {
			const gradient = {
				type: 'radial',
				centerX: 0.5,
				centerY: 0.5,
				radius: 0.5,
				colors: [
					{ offset: 0, color: '#fff' },
					{ offset: 1, color: '#000' }
				]
			};

			const result = GradientRenderer.validate( gradient );
			expect( result.valid ).toBe( true );
		} );

		it( 'should reject null gradient', () => {
			const result = GradientRenderer.validate( null );
			expect( result.valid ).toBe( false );
			expect( result.errors ).toContain( 'Gradient must be an object' );
		} );

		it( 'should reject invalid type', () => {
			const gradient = { type: 'invalid', colors: [] };
			const result = GradientRenderer.validate( gradient );
			expect( result.valid ).toBe( false );
			expect( result.errors ).toContain( 'Gradient type must be "linear" or "radial"' );
		} );

		it( 'should reject non-array colors', () => {
			const gradient = { type: 'linear', colors: 'not array' };
			const result = GradientRenderer.validate( gradient );
			expect( result.valid ).toBe( false );
			expect( result.errors ).toContain( 'Gradient colors must be an array' );
		} );

		it( 'should reject less than 2 colors', () => {
			const gradient = { type: 'linear', colors: [ { offset: 0, color: '#fff' } ] };
			const result = GradientRenderer.validate( gradient );
			expect( result.valid ).toBe( false );
			expect( result.errors ).toContain( 'Gradient must have at least 2 color stops' );
		} );

		it( 'should reject invalid offset', () => {
			const gradient = {
				type: 'linear',
				colors: [
					{ offset: -1, color: '#fff' },
					{ offset: 1, color: '#000' }
				]
			};
			const result = GradientRenderer.validate( gradient );
			expect( result.valid ).toBe( false );
		} );

		it( 'should reject invalid angle', () => {
			const gradient = {
				type: 'linear',
				angle: 500,
				colors: [
					{ offset: 0, color: '#fff' },
					{ offset: 1, color: '#000' }
				]
			};
			const result = GradientRenderer.validate( gradient );
			expect( result.valid ).toBe( false );
		} );

		it( 'should reject invalid radial properties', () => {
			const gradient = {
				type: 'radial',
				centerX: 2,
				colors: [
					{ offset: 0, color: '#fff' },
					{ offset: 1, color: '#000' }
				]
			};
			const result = GradientRenderer.validate( gradient );
			expect( result.valid ).toBe( false );
		} );
	} );

	describe( 'clone', () => {
		it( 'should clone gradient definition', () => {
			const original = {
				type: 'linear',
				angle: 45,
				colors: [
					{ offset: 0, color: '#ff0000' },
					{ offset: 1, color: '#0000ff' }
				]
			};

			const cloned = GradientRenderer.clone( original );

			expect( cloned ).not.toBe( original );
			expect( cloned.colors ).not.toBe( original.colors );
			expect( cloned ).toEqual( {
				type: 'linear',
				angle: 45,
				centerX: undefined,
				centerY: undefined,
				radius: undefined,
				colors: [
					{ offset: 0, color: '#ff0000' },
					{ offset: 1, color: '#0000ff' }
				]
			} );
		} );

		it( 'should return null for null input', () => {
			expect( GradientRenderer.clone( null ) ).toBeNull();
		} );

		it( 'should handle gradient without colors', () => {
			const original = { type: 'linear' };
			const cloned = GradientRenderer.clone( original );
			expect( cloned.colors ).toEqual( [] );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up resources', () => {
			renderer.destroy();
			expect( renderer.ctx ).toBeNull();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export GradientRenderer class', () => {
			expect( GradientRenderer ).toBeDefined();
			expect( typeof GradientRenderer ).toBe( 'function' );
		} );
	} );
} );
