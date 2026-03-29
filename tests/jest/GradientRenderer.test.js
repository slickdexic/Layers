/**
 * Jest tests for GradientRenderer
 * Targets uncovered branches: validation, gradient creation, error paths
 */
'use strict';

describe( 'GradientRenderer', function () {
	let GradientRenderer;
	let renderer;
	let mockCtx;

	function createMockGradient() {
		return {
			addColorStop: jest.fn()
		};
	}

	function createMockCtx() {
		return {
			createLinearGradient: jest.fn( () => createMockGradient() ),
			createRadialGradient: jest.fn( () => createMockGradient() ),
			fillStyle: ''
		};
	}

	beforeAll( function () {
		window.Layers = window.Layers || {};
		window.Layers.Renderers = window.Layers.Renderers || {};
		require( '../../resources/ext.layers.shared/GradientRenderer.js' );
		GradientRenderer = window.Layers.GradientRenderer;
	} );

	beforeEach( function () {
		mockCtx = createMockCtx();
		renderer = new GradientRenderer( mockCtx );
	} );

	describe( 'hasGradient', function () {
		it( 'should return false for null layer', function () {
			expect( GradientRenderer.hasGradient( null ) ).toBe( false );
		} );

		it( 'should return false for layer without gradient', function () {
			expect( GradientRenderer.hasGradient( { fill: '#000' } ) ).toBe( false );
		} );

		it( 'should return false for gradient with < 2 colors', function () {
			expect( GradientRenderer.hasGradient( {
				gradient: { type: 'linear', colors: [ { offset: 0, color: '#f00' } ] }
			} ) ).toBe( false );
		} );

		it( 'should return true for valid linear gradient', function () {
			expect( GradientRenderer.hasGradient( {
				gradient: {
					type: 'linear',
					colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
				}
			} ) ).toBe( true );
		} );
	} );

	describe( 'createGradient', function () {
		it( 'should return null when ctx is null', function () {
			renderer.ctx = null;
			const result = renderer.createGradient(
				{ gradient: { type: 'linear', colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ] } },
				{ x: 0, y: 0, width: 100, height: 100 }
			);
			expect( result ).toBeNull();
		} );

		it( 'should return null when layer has no gradient', function () {
			const result = renderer.createGradient(
				{ fill: '#000' },
				{ x: 0, y: 0, width: 100, height: 100 }
			);
			expect( result ).toBeNull();
		} );

		it( 'should create a linear gradient', function () {
			const layer = {
				gradient: {
					type: 'linear',
					angle: 90,
					colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
				}
			};
			const result = renderer.createGradient( layer, { x: 0, y: 0, width: 100, height: 100 } );
			expect( result ).not.toBeNull();
			expect( mockCtx.createLinearGradient ).toHaveBeenCalled();
		} );

		it( 'should create a radial gradient', function () {
			const layer = {
				gradient: {
					type: 'radial',
					centerX: 0.5,
					centerY: 0.5,
					radius: 0.7,
					colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
				}
			};
			const result = renderer.createGradient( layer, { x: 0, y: 0, width: 100, height: 100 } );
			expect( result ).not.toBeNull();
			expect( mockCtx.createRadialGradient ).toHaveBeenCalled();
		} );

		it( 'should return null for unknown gradient type', function () {
			// hasGradient returns false for invalid type, so createGradient returns null
			const layer = {
				gradient: {
					type: 'conic',
					colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
				}
			};
			const result = renderer.createGradient( layer, { x: 0, y: 0, width: 100, height: 100 } );
			expect( result ).toBeNull();
		} );

		it( 'should apply scale option', function () {
			const layer = {
				gradient: {
					type: 'linear',
					angle: 0,
					colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
				}
			};
			renderer.createGradient( layer, { x: 10, y: 20, width: 100, height: 50 }, { scale: 2 } );
			// createLinearGradient should be called with scaled values
			expect( mockCtx.createLinearGradient ).toHaveBeenCalled();
		} );

		it( 'should catch errors and return null', function () {
			mockCtx.createLinearGradient = jest.fn( () => {
				throw new Error( 'canvas error' );
			} );
			window.mw = { log: { warn: jest.fn() } };
			const layer = {
				gradient: {
					type: 'linear',
					colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
				}
			};
			const result = renderer.createGradient( layer, { x: 0, y: 0, width: 100, height: 100 } );
			expect( result ).toBeNull();
			expect( window.mw.log.warn ).toHaveBeenCalled();
			delete window.mw;
		} );
	} );

	describe( '_createRadialGradient defaults', function () {
		it( 'should use defaults when centerX/centerY/radius are undefined', function () {
			const gradient = {
				type: 'radial',
				colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
			};
			const layer = { gradient: gradient };
			renderer.createGradient( layer, { x: 0, y: 0, width: 200, height: 100 } );
			// centerX=0.5 → 100, centerY=0.5 → 50, radius=0.5*100=50
			expect( mockCtx.createRadialGradient ).toHaveBeenCalledWith( 100, 50, 0, 100, 50, 50 );
		} );
	} );

	describe( '_addColorStops edge cases', function () {
		it( 'should handle missing offset with default 0', function () {
			const layer = {
				gradient: {
					type: 'linear',
					colors: [ { color: '#f00' }, { offset: 1, color: '#00f' } ]
				}
			};
			const result = renderer.createGradient( layer, { x: 0, y: 0, width: 100, height: 100 } );
			expect( result ).not.toBeNull();
			expect( result.addColorStop ).toHaveBeenCalledWith( 0, '#f00' );
		} );

		it( 'should handle missing color with default #000000', function () {
			const layer = {
				gradient: {
					type: 'linear',
					colors: [ { offset: 0 }, { offset: 1, color: '#00f' } ]
				}
			};
			const result = renderer.createGradient( layer, { x: 0, y: 0, width: 100, height: 100 } );
			expect( result ).not.toBeNull();
			expect( result.addColorStop ).toHaveBeenCalledWith( 0, '#000000' );
		} );

		it( 'should clamp offset to [0, 1]', function () {
			const layer = {
				gradient: {
					type: 'linear',
					colors: [ { offset: -0.5, color: '#f00' }, { offset: 1.5, color: '#00f' } ]
				}
			};
			const result = renderer.createGradient( layer, { x: 0, y: 0, width: 100, height: 100 } );
			expect( result.addColorStop ).toHaveBeenCalledWith( 0, '#f00' );
			expect( result.addColorStop ).toHaveBeenCalledWith( 1, '#00f' );
		} );

		it( 'should fall back to #000000 when addColorStop throws for invalid color', function () {
			const mockGrad = {
				addColorStop: jest.fn().mockImplementationOnce( () => {
					throw new Error( 'invalid color' );
				} )
			};
			mockCtx.createLinearGradient = jest.fn( () => mockGrad );
			window.mw = { log: { warn: jest.fn() } };

			const layer = {
				gradient: {
					type: 'linear',
					colors: [ { offset: 0, color: 'not-a-color' }, { offset: 1, color: '#00f' } ]
				}
			};
			renderer.createGradient( layer, { x: 0, y: 0, width: 100, height: 100 } );
			// First call throws, fallback adds #000000
			expect( mockGrad.addColorStop ).toHaveBeenCalledWith( 0, '#000000' );
			delete window.mw;
		} );
	} );

	describe( 'applyFill', function () {
		it( 'should apply gradient and return true', function () {
			const layer = {
				gradient: {
					type: 'linear',
					colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
				}
			};
			const result = renderer.applyFill( layer, { x: 0, y: 0, width: 100, height: 100 } );
			expect( result ).toBe( true );
		} );

		it( 'should fallback to solid fill when no gradient', function () {
			const layer = { fill: '#ff0000' };
			const result = renderer.applyFill( layer, { x: 0, y: 0, width: 100, height: 100 } );
			expect( result ).toBe( false );
			expect( mockCtx.fillStyle ).toBe( '#ff0000' );
		} );

		it( 'should not apply fill for none/transparent', function () {
			const layer = { fill: 'none' };
			renderer.applyFill( layer, { x: 0, y: 0, width: 100, height: 100 } );
			expect( mockCtx.fillStyle ).toBe( '' );
		} );
	} );

	describe( 'validate', function () {
		it( 'should reject non-object gradient', function () {
			const result = GradientRenderer.validate( null );
			expect( result.valid ).toBe( false );
		} );

		it( 'should reject invalid type', function () {
			const result = GradientRenderer.validate( { type: 'conic', colors: [] } );
			expect( result.valid ).toBe( false );
			expect( result.errors ).toContain( 'Gradient type must be "linear" or "radial"' );
		} );

		it( 'should reject non-array colors', function () {
			const result = GradientRenderer.validate( { type: 'linear', colors: 'red' } );
			expect( result.errors ).toContain( 'Gradient colors must be an array' );
		} );

		it( 'should reject fewer than 2 color stops', function () {
			const result = GradientRenderer.validate( { type: 'linear', colors: [ { offset: 0, color: '#f00' } ] } );
			expect( result.errors ).toContain( 'Gradient must have at least 2 color stops' );
		} );

		it( 'should reject invalid offset range', function () {
			const result = GradientRenderer.validate( {
				type: 'linear',
				colors: [ { offset: -1, color: '#f00' }, { offset: 2, color: '#00f' } ]
			} );
			expect( result.valid ).toBe( false );
			expect( result.errors.length ).toBeGreaterThanOrEqual( 2 );
		} );

		it( 'should reject non-string color', function () {
			const result = GradientRenderer.validate( {
				type: 'linear',
				colors: [ { offset: 0, color: 123 }, { offset: 1, color: '#00f' } ]
			} );
			expect( result.valid ).toBe( false );
			expect( result.errors.some( ( e ) => e.includes( 'color must be a string' ) ) ).toBe( true );
		} );

		it( 'should reject invalid linear angle', function () {
			const result = GradientRenderer.validate( {
				type: 'linear',
				angle: -10,
				colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
			} );
			expect( result.valid ).toBe( false );
		} );

		it( 'should reject invalid radial centerX', function () {
			const result = GradientRenderer.validate( {
				type: 'radial',
				centerX: 2,
				colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
			} );
			expect( result.valid ).toBe( false );
		} );

		it( 'should reject invalid radial radius', function () {
			const result = GradientRenderer.validate( {
				type: 'radial',
				radius: 3,
				colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
			} );
			expect( result.valid ).toBe( false );
		} );

		it( 'should accept valid linear gradient', function () {
			const result = GradientRenderer.validate( {
				type: 'linear',
				angle: 90,
				colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ]
			} );
			expect( result.valid ).toBe( true );
			expect( result.errors ).toHaveLength( 0 );
		} );
	} );

	describe( 'static utilities', function () {
		it( 'should create default linear gradient', function () {
			const grad = GradientRenderer.createDefaultGradient( 'linear' );
			expect( grad.type ).toBe( 'linear' );
			expect( grad.angle ).toBe( 90 );
			expect( grad.colors ).toHaveLength( 2 );
		} );

		it( 'should create default radial gradient', function () {
			const grad = GradientRenderer.createDefaultGradient( 'radial', '#ff0', '#0ff' );
			expect( grad.type ).toBe( 'radial' );
			expect( grad.centerX ).toBe( 0.5 );
			expect( grad.radius ).toBe( 0.7 );
		} );

		it( 'should clone gradient', function () {
			const original = { type: 'linear', angle: 45, colors: [ { offset: 0, color: '#f00' } ] };
			const clone = GradientRenderer.clone( original );
			expect( clone ).toEqual( original );
			expect( clone ).not.toBe( original );
			expect( clone.colors ).not.toBe( original.colors );
		} );

		it( 'should return null when cloning null', function () {
			expect( GradientRenderer.clone( null ) ).toBeNull();
		} );

		it( 'should return presets', function () {
			const presets = GradientRenderer.getPresets();
			expect( presets.sunset ).toBeDefined();
			expect( presets.rainbow.colors.length ).toBe( 7 );
		} );
	} );

	describe( 'setContext and destroy', function () {
		it( 'should set context', function () {
			const newCtx = createMockCtx();
			renderer.setContext( newCtx );
			expect( renderer.ctx ).toBe( newCtx );
		} );

		it( 'should nullify ctx on destroy', function () {
			renderer.destroy();
			expect( renderer.ctx ).toBeNull();
		} );
	} );
} );
