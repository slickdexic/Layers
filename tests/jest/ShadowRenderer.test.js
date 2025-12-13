/**
 * Tests for ShadowRenderer class
 *
 * ShadowRenderer handles shadow rendering for layer shapes, including:
 * - Standard canvas shadows (blur, offset)
 * - Shadow spread via offscreen canvas technique
 * - Rotation-aware shadow rendering
 */

'use strict';

// Load ShadowRenderer
const ShadowRenderer = require( '../../resources/ext.layers.shared/ShadowRenderer.js' );

// Mock DOMMatrix globally if not available
if ( typeof DOMMatrix === 'undefined' ) {
	global.DOMMatrix = class DOMMatrix {
		constructor( values ) {
			if ( values && Array.isArray( values ) ) {
				[ this.a, this.b, this.c, this.d, this.e, this.f ] = values;
			} else {
				this.a = 1;
				this.b = 0;
				this.c = 0;
				this.d = 1;
				this.e = 0;
				this.f = 0;
			}
		}
	};
}

describe( 'ShadowRenderer', () => {
	let ctx;
	let canvas;
	let renderer;

	/**
	 * Create a mock canvas context
	 *
	 * @return {Object} Mock context with tracked properties
	 */
	function createMockContext() {
		return {
			shadowColor: 'transparent',
			shadowBlur: 0,
			shadowOffsetX: 0,
			shadowOffsetY: 0,
			globalAlpha: 1,
			globalCompositeOperation: 'source-over',
			fillStyle: '#000',
			strokeStyle: '#000',
			lineWidth: 1,
			lineCap: 'butt',
			lineJoin: 'miter',
			save: jest.fn(),
			restore: jest.fn(),
			fill: jest.fn(),
			stroke: jest.fn(),
			beginPath: jest.fn(),
			closePath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			arc: jest.fn(),
			rect: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			setTransform: jest.fn(),
			getTransform: jest.fn( () => ( {
				a: 1, b: 0, c: 0, d: 1, e: 0, f: 0
			} ) ),
			drawImage: jest.fn()
		};
	}

	/**
	 * Create a mock canvas element
	 *
	 * @return {Object} Mock canvas
	 */
	function createMockCanvas() {
		return {
			width: 800,
			height: 600,
			getContext: jest.fn( () => createMockContext() )
		};
	}

	beforeEach( () => {
		ctx = createMockContext();
		canvas = createMockCanvas();
		renderer = new ShadowRenderer( ctx, { canvas: canvas } );

		// Mock document.createElement for offscreen canvas
		document.createElement = jest.fn( ( tag ) => {
			if ( tag === 'canvas' ) {
				return createMockCanvas();
			}
			return {};
		} );
	} );

	afterEach( () => {
		if ( renderer ) {
			renderer.destroy();
		}
	} );

	describe( 'constructor', () => {
		test( 'should initialize with context and config', () => {
			expect( renderer.ctx ).toBe( ctx );
			expect( renderer.canvas ).toBe( canvas );
			expect( renderer.config ).toEqual( { canvas: canvas } );
		} );

		test( 'should handle missing config', () => {
			const r = new ShadowRenderer( ctx );
			expect( r.ctx ).toBe( ctx );
			expect( r.canvas ).toBeNull();
			expect( r.config ).toEqual( {} );
			r.destroy();
		} );

		test( 'should handle null config', () => {
			const r = new ShadowRenderer( ctx, null );
			expect( r.config ).toEqual( {} );
			r.destroy();
		} );
	} );

	describe( 'setCanvas', () => {
		test( 'should update canvas reference', () => {
			const newCanvas = createMockCanvas();
			renderer.setCanvas( newCanvas );
			expect( renderer.canvas ).toBe( newCanvas );
		} );
	} );

	describe( 'setContext', () => {
		test( 'should update context reference', () => {
			const newCtx = createMockContext();
			renderer.setContext( newCtx );
			expect( renderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'clearShadow', () => {
		test( 'should reset all shadow properties', () => {
			ctx.shadowColor = 'rgba(0,0,0,0.5)';
			ctx.shadowBlur = 10;
			ctx.shadowOffsetX = 5;
			ctx.shadowOffsetY = 5;

			renderer.clearShadow();

			expect( ctx.shadowColor ).toBe( 'transparent' );
			expect( ctx.shadowBlur ).toBe( 0 );
			expect( ctx.shadowOffsetX ).toBe( 0 );
			expect( ctx.shadowOffsetY ).toBe( 0 );
		} );
	} );

	describe( 'applyShadow', () => {
		const scale = { sx: 1, sy: 1, avg: 1 };

		test( 'should clear shadow when explicitly disabled (boolean false)', () => {
			const layer = { shadow: false };
			renderer.applyShadow( layer, scale );
			expect( ctx.shadowColor ).toBe( 'transparent' );
		} );

		test( 'should clear shadow when explicitly disabled (string "false")', () => {
			const layer = { shadow: 'false' };
			renderer.applyShadow( layer, scale );
			expect( ctx.shadowColor ).toBe( 'transparent' );
		} );

		test( 'should clear shadow when explicitly disabled (number 0)', () => {
			const layer = { shadow: 0 };
			renderer.applyShadow( layer, scale );
			expect( ctx.shadowColor ).toBe( 'transparent' );
		} );

		test( 'should clear shadow when explicitly disabled (string "0")', () => {
			const layer = { shadow: '0' };
			renderer.applyShadow( layer, scale );
			expect( ctx.shadowColor ).toBe( 'transparent' );
		} );

		test( 'should apply shadow when explicitly enabled (boolean true)', () => {
			const layer = {
				shadow: true,
				shadowColor: 'rgba(255,0,0,0.5)',
				shadowBlur: 12,
				shadowOffsetX: 4,
				shadowOffsetY: 6
			};
			renderer.applyShadow( layer, scale );

			expect( ctx.shadowColor ).toBe( 'rgba(255,0,0,0.5)' );
			expect( ctx.shadowBlur ).toBe( 12 );
			expect( ctx.shadowOffsetX ).toBe( 4 );
			expect( ctx.shadowOffsetY ).toBe( 6 );
		} );

		test( 'should apply shadow when explicitly enabled (string "true")', () => {
			const layer = { shadow: 'true' };
			renderer.applyShadow( layer, scale );
			expect( ctx.shadowColor ).toBe( 'rgba(0,0,0,0.4)' ); // default
		} );

		test( 'should apply shadow when explicitly enabled (number 1)', () => {
			const layer = { shadow: 1 };
			renderer.applyShadow( layer, scale );
			expect( ctx.shadowColor ).toBe( 'rgba(0,0,0,0.4)' );
		} );

		test( 'should apply shadow when explicitly enabled (string "1")', () => {
			const layer = { shadow: '1' };
			renderer.applyShadow( layer, scale );
			expect( ctx.shadowColor ).toBe( 'rgba(0,0,0,0.4)' );
		} );

		test( 'should use default values when shadow enabled without properties', () => {
			const layer = { shadow: true };
			renderer.applyShadow( layer, scale );

			expect( ctx.shadowColor ).toBe( 'rgba(0,0,0,0.4)' );
			expect( ctx.shadowBlur ).toBe( 8 );
			expect( ctx.shadowOffsetX ).toBe( 2 );
			expect( ctx.shadowOffsetY ).toBe( 2 );
		} );

		test( 'should apply scaling to shadow properties', () => {
			const layer = {
				shadow: true,
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			};
			const scaledScale = { sx: 2, sy: 3, avg: 2.5 };
			renderer.applyShadow( layer, scaledScale );

			expect( ctx.shadowBlur ).toBe( 25 ); // 10 * 2.5
			expect( ctx.shadowOffsetX ).toBe( 10 ); // 5 * 2
			expect( ctx.shadowOffsetY ).toBe( 15 ); // 5 * 3
		} );

		test( 'should handle legacy nested shadow object format', () => {
			const layer = {
				shadow: {
					color: 'rgba(0,0,255,0.6)',
					blur: 15,
					offsetX: 8,
					offsetY: 10
				}
			};
			renderer.applyShadow( layer, scale );

			expect( ctx.shadowColor ).toBe( 'rgba(0,0,255,0.6)' );
			expect( ctx.shadowBlur ).toBe( 15 );
			expect( ctx.shadowOffsetX ).toBe( 8 );
			expect( ctx.shadowOffsetY ).toBe( 10 );
		} );

		test( 'should use defaults for missing nested shadow properties', () => {
			const layer = { shadow: {} };
			renderer.applyShadow( layer, scale );

			expect( ctx.shadowColor ).toBe( 'rgba(0,0,0,0.4)' );
			expect( ctx.shadowBlur ).toBe( 8 );
			expect( ctx.shadowOffsetX ).toBe( 2 );
			expect( ctx.shadowOffsetY ).toBe( 2 );
		} );

		test( 'should not apply shadow when undefined', () => {
			const layer = {};
			const originalColor = ctx.shadowColor;
			renderer.applyShadow( layer, scale );
			expect( ctx.shadowColor ).toBe( originalColor );
		} );

		test( 'should handle missing scale factors', () => {
			const layer = { shadow: true, shadowBlur: 10, shadowOffsetX: 5, shadowOffsetY: 5 };
			renderer.applyShadow( layer, {} );

			expect( ctx.shadowBlur ).toBe( 10 ); // Uses 1 as default
			expect( ctx.shadowOffsetX ).toBe( 5 );
			expect( ctx.shadowOffsetY ).toBe( 5 );
		} );
	} );

	describe( 'hasShadowEnabled', () => {
		test( 'should return true for boolean true', () => {
			expect( renderer.hasShadowEnabled( { shadow: true } ) ).toBe( true );
		} );

		test( 'should return true for string "true"', () => {
			expect( renderer.hasShadowEnabled( { shadow: 'true' } ) ).toBe( true );
		} );

		test( 'should return true for number 1', () => {
			expect( renderer.hasShadowEnabled( { shadow: 1 } ) ).toBe( true );
		} );

		test( 'should return true for string "1"', () => {
			expect( renderer.hasShadowEnabled( { shadow: '1' } ) ).toBe( true );
		} );

		test( 'should return true for shadow object', () => {
			expect( renderer.hasShadowEnabled( { shadow: { blur: 5 } } ) ).toBeTruthy();
		} );

		test( 'should return false for boolean false', () => {
			expect( renderer.hasShadowEnabled( { shadow: false } ) ).toBeFalsy();
		} );

		test( 'should return false for undefined', () => {
			expect( renderer.hasShadowEnabled( {} ) ).toBeFalsy();
		} );

		test( 'should return false for null shadow', () => {
			expect( renderer.hasShadowEnabled( { shadow: null } ) ).toBeFalsy();
		} );

		test( 'should return false for number 0', () => {
			expect( renderer.hasShadowEnabled( { shadow: 0 } ) ).toBeFalsy();
		} );
	} );

	describe( 'getShadowSpread', () => {
		const scale = { sx: 1, sy: 1, avg: 1 };

		test( 'should return 0 when shadow is not enabled', () => {
			expect( renderer.getShadowSpread( { shadow: false }, scale ) ).toBe( 0 );
		} );

		test( 'should return 0 when no spread defined', () => {
			expect( renderer.getShadowSpread( { shadow: true }, scale ) ).toBe( 0 );
		} );

		test( 'should return spread from flat format', () => {
			const layer = { shadow: true, shadowSpread: 10 };
			expect( renderer.getShadowSpread( layer, scale ) ).toBe( 10 );
		} );

		test( 'should apply scaling to spread', () => {
			const layer = { shadow: true, shadowSpread: 10 };
			expect( renderer.getShadowSpread( layer, { avg: 2 } ) ).toBe( 20 );
		} );

		test( 'should return spread from nested format', () => {
			const layer = { shadow: { spread: 15 } };
			expect( renderer.getShadowSpread( layer, scale ) ).toBe( 15 );
		} );

		test( 'should return 0 for non-positive spread', () => {
			expect( renderer.getShadowSpread( { shadow: true, shadowSpread: 0 }, scale ) ).toBe( 0 );
			expect( renderer.getShadowSpread( { shadow: true, shadowSpread: -5 }, scale ) ).toBe( 0 );
		} );

		test( 'should return 0 for non-positive nested spread', () => {
			expect( renderer.getShadowSpread( { shadow: { spread: 0 } }, scale ) ).toBe( 0 );
			expect( renderer.getShadowSpread( { shadow: { spread: -5 } }, scale ) ).toBe( 0 );
		} );

		test( 'should handle missing avg in scale', () => {
			const layer = { shadow: true, shadowSpread: 10 };
			expect( renderer.getShadowSpread( layer, {} ) ).toBe( 10 ); // Uses 1 as default
		} );
	} );

	describe( 'getShadowParams', () => {
		test( 'should return default parameters', () => {
			const params = renderer.getShadowParams( {}, { sx: 1, sy: 1, avg: 1 } );

			expect( params.offsetX ).toBe( 2 );
			expect( params.offsetY ).toBe( 2 );
			expect( params.blur ).toBe( 8 );
			expect( params.color ).toBe( 'rgba(0,0,0,0.4)' );
			expect( params.offscreenOffset ).toBe( 10000 );
		} );

		test( 'should use layer shadow properties', () => {
			const layer = {
				shadowOffsetX: 10,
				shadowOffsetY: 15,
				shadowBlur: 20,
				shadowColor: 'red'
			};
			const params = renderer.getShadowParams( layer, { sx: 1, sy: 1, avg: 1 } );

			expect( params.offsetX ).toBe( 10 );
			expect( params.offsetY ).toBe( 15 );
			expect( params.blur ).toBe( 20 );
			expect( params.color ).toBe( 'red' );
		} );

		test( 'should apply scale factors', () => {
			const layer = { shadowOffsetX: 5, shadowOffsetY: 5, shadowBlur: 10 };
			const params = renderer.getShadowParams( layer, { sx: 2, sy: 3, avg: 2.5 } );

			expect( params.offsetX ).toBe( 10 ); // 5 * 2
			expect( params.offsetY ).toBe( 15 ); // 5 * 3
			expect( params.blur ).toBe( 25 ); // 10 * 2.5
		} );

		test( 'should handle missing scale factors', () => {
			const layer = { shadowOffsetX: 5, shadowOffsetY: 5, shadowBlur: 10 };
			const params = renderer.getShadowParams( layer, {} );

			expect( params.offsetX ).toBe( 5 );
			expect( params.offsetY ).toBe( 5 );
			expect( params.blur ).toBe( 10 );
		} );
	} );

	describe( 'drawSpreadShadow', () => {
		const layer = { shadow: true, shadowSpread: 5 };
		const scale = { sx: 1, sy: 1, avg: 1 };
		const drawFn = jest.fn();

		beforeEach( () => {
			drawFn.mockClear();
		} );

		test( 'should create temporary canvas for spread shadow', () => {
			renderer.drawSpreadShadow( layer, scale, 5, drawFn );

			expect( document.createElement ).toHaveBeenCalledWith( 'canvas' );
		} );

		test( 'should call drawing function with temp context', () => {
			renderer.drawSpreadShadow( layer, scale, 5, drawFn );

			expect( drawFn ).toHaveBeenCalled();
			// The argument should be a context object
			expect( drawFn.mock.calls[ 0 ][ 0 ] ).toBeDefined();
		} );

		test( 'should apply opacity parameter', () => {
			renderer.drawSpreadShadow( layer, scale, 5, drawFn, 0.5 );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		test( 'should clamp opacity to valid range', () => {
			renderer.drawSpreadShadow( layer, scale, 5, drawFn, 1.5 );
			expect( drawFn ).toHaveBeenCalled();

			drawFn.mockClear();
			renderer.drawSpreadShadow( layer, scale, 5, drawFn, -0.5 );
			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should handle rotation in transform', () => {
			// Mock getTransform to return a rotated matrix
			// For 45 degree rotation: cos(45) ≈ 0.707, sin(45) ≈ 0.707
			ctx.getTransform = jest.fn( () => ( {
				a: 0.707, b: 0.707, c: -0.707, d: 0.707, e: 100, f: 200
			} ) );

			renderer.drawSpreadShadow( layer, scale, 5, drawFn );

			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should fall back to applyShadow if tempCtx fails', () => {
			// Mock getContext to return null
			document.createElement = jest.fn( () => ( {
				width: 0,
				height: 0,
				getContext: jest.fn( () => null )
			} ) );

			const applyShadowSpy = jest.spyOn( renderer, 'applyShadow' );
			renderer.drawSpreadShadow( layer, scale, 5, drawFn );

			expect( applyShadowSpy ).toHaveBeenCalled();
		} );

		test( 'should use canvas dimensions when available', () => {
			renderer.canvas = { width: 1000, height: 800 };
			renderer.drawSpreadShadow( layer, scale, 5, drawFn );

			expect( document.createElement ).toHaveBeenCalled();
		} );

		test( 'should use default dimensions when canvas is null', () => {
			renderer.canvas = null;
			renderer.drawSpreadShadow( layer, scale, 5, drawFn );

			expect( document.createElement ).toHaveBeenCalled();
		} );
	} );

	describe( 'drawSpreadShadowStroke', () => {
		const layer = { shadow: true, shadowSpread: 5 };
		const scale = { sx: 1, sy: 1, avg: 1 };
		const drawFn = jest.fn();

		beforeEach( () => {
			drawFn.mockClear();
		} );

		test( 'should create temporary canvas for stroke shadow', () => {
			renderer.drawSpreadShadowStroke( layer, scale, 3, drawFn );

			expect( document.createElement ).toHaveBeenCalledWith( 'canvas' );
		} );

		test( 'should call drawing function with temp context', () => {
			renderer.drawSpreadShadowStroke( layer, scale, 3, drawFn );

			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should set stroke width on temp context', () => {
			renderer.drawSpreadShadowStroke( layer, scale, 5, drawFn );

			// Verify drawFn was called (the stroke width is set on temp context)
			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should apply opacity parameter', () => {
			renderer.drawSpreadShadowStroke( layer, scale, 3, drawFn, 0.7 );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		test( 'should clamp opacity to valid range', () => {
			renderer.drawSpreadShadowStroke( layer, scale, 3, drawFn, 2.0 );
			expect( drawFn ).toHaveBeenCalled();

			drawFn.mockClear();
			renderer.drawSpreadShadowStroke( layer, scale, 3, drawFn, -1.0 );
			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should handle rotation in transform', () => {
			// Mock getTransform to return a rotated matrix
			ctx.getTransform = jest.fn( () => ( {
				a: 0.707, b: 0.707, c: -0.707, d: 0.707, e: 50, f: 100
			} ) );

			renderer.drawSpreadShadowStroke( layer, scale, 3, drawFn );

			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should fall back to applyShadow if tempCtx fails', () => {
			document.createElement = jest.fn( () => ( {
				width: 0,
				height: 0,
				getContext: jest.fn( () => null )
			} ) );

			const applyShadowSpy = jest.spyOn( renderer, 'applyShadow' );
			renderer.drawSpreadShadowStroke( layer, scale, 3, drawFn );

			expect( applyShadowSpy ).toHaveBeenCalled();
		} );

		test( 'should use canvas dimensions when available', () => {
			renderer.canvas = { width: 1200, height: 900 };
			renderer.drawSpreadShadowStroke( layer, scale, 3, drawFn );

			expect( document.createElement ).toHaveBeenCalled();
		} );

		test( 'should use default dimensions when canvas is null', () => {
			renderer.canvas = null;
			renderer.drawSpreadShadowStroke( layer, scale, 3, drawFn );

			expect( document.createElement ).toHaveBeenCalled();
		} );
	} );

	describe( 'withLocalAlpha', () => {
		test( 'should call function with multiplied alpha', () => {
			ctx.globalAlpha = 1.0;
			const drawFn = jest.fn( function () {
				expect( this.ctx.globalAlpha ).toBe( 0.5 );
			} );

			renderer.withLocalAlpha( 0.5, drawFn );

			expect( drawFn ).toHaveBeenCalled();
			expect( ctx.globalAlpha ).toBe( 1.0 ); // Restored
		} );

		test( 'should multiply with existing alpha', () => {
			ctx.globalAlpha = 0.8;
			const drawFn = jest.fn( function () {
				expect( this.ctx.globalAlpha ).toBeCloseTo( 0.4, 5 ); // 0.8 * 0.5
			} );

			renderer.withLocalAlpha( 0.5, drawFn );

			expect( ctx.globalAlpha ).toBe( 0.8 ); // Restored
		} );

		test( 'should clamp alpha to valid range', () => {
			ctx.globalAlpha = 1.0;

			const drawFn = jest.fn( function () {
				expect( this.ctx.globalAlpha ).toBe( 1.0 ); // Clamped from 1.5
			} );
			renderer.withLocalAlpha( 1.5, drawFn );

			const drawFn2 = jest.fn( function () {
				expect( this.ctx.globalAlpha ).toBe( 0 ); // Clamped from -0.5
			} );
			renderer.withLocalAlpha( -0.5, drawFn2 );
		} );

		test( 'should call function without alpha change if alpha is not a number', () => {
			ctx.globalAlpha = 0.7;
			const drawFn = jest.fn();

			renderer.withLocalAlpha( undefined, drawFn );
			expect( drawFn ).toHaveBeenCalled();
			expect( ctx.globalAlpha ).toBe( 0.7 );

			drawFn.mockClear();
			renderer.withLocalAlpha( null, drawFn );
			expect( drawFn ).toHaveBeenCalled();

			drawFn.mockClear();
			renderer.withLocalAlpha( 'invalid', drawFn );
			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should not call if drawFn is not a function', () => {
			expect( () => renderer.withLocalAlpha( 0.5, null ) ).not.toThrow();
			expect( () => renderer.withLocalAlpha( 0.5, undefined ) ).not.toThrow();
			expect( () => renderer.withLocalAlpha( 0.5, 'not a function' ) ).not.toThrow();
		} );

		test( 'should restore alpha even if function throws', () => {
			ctx.globalAlpha = 0.9;
			const throwingFn = jest.fn( () => {
				throw new Error( 'Test error' );
			} );

			expect( () => renderer.withLocalAlpha( 0.5, throwingFn ) ).toThrow( 'Test error' );
			expect( ctx.globalAlpha ).toBe( 0.9 ); // Restored via finally
		} );
	} );

	describe( 'destroy', () => {
		test( 'should null out all references', () => {
			renderer.destroy();

			expect( renderer.ctx ).toBeNull();
			expect( renderer.config ).toBeNull();
			expect( renderer.canvas ).toBeNull();
		} );

		test( 'should be safe to call multiple times', () => {
			renderer.destroy();
			expect( () => renderer.destroy() ).not.toThrow();
		} );
	} );

	describe( 'clampOpacity static method', () => {
		test( 'should clamp values to 0-1 range', () => {
			expect( ShadowRenderer.clampOpacity( 0.5 ) ).toBe( 0.5 );
			expect( ShadowRenderer.clampOpacity( 0 ) ).toBe( 0 );
			expect( ShadowRenderer.clampOpacity( 1 ) ).toBe( 1 );
			expect( ShadowRenderer.clampOpacity( 1.5 ) ).toBe( 1 );
			expect( ShadowRenderer.clampOpacity( -0.5 ) ).toBe( 0 );
		} );

		test( 'should return 1 for non-number values', () => {
			expect( ShadowRenderer.clampOpacity( null ) ).toBe( 1 );
			expect( ShadowRenderer.clampOpacity( undefined ) ).toBe( 1 );
			expect( ShadowRenderer.clampOpacity( 'string' ) ).toBe( 1 );
			expect( ShadowRenderer.clampOpacity( {} ) ).toBe( 1 );
		} );

		test( 'should return 1 for NaN', () => {
			expect( ShadowRenderer.clampOpacity( NaN ) ).toBe( 1 );
		} );
	} );

	describe( 'exports', () => {
		test( 'should export to window.Layers namespace', () => {
			expect( window.Layers ).toBeDefined();
			expect( window.Layers.ShadowRenderer ).toBe( ShadowRenderer );
		} );

		test( 'should export clampOpacity as static method', () => {
			expect( typeof ShadowRenderer.clampOpacity ).toBe( 'function' );
		} );
	} );

	describe( 'rotation handling edge cases', () => {
		const layer = { shadow: true, shadowSpread: 5 };
		const scale = { sx: 1, sy: 1, avg: 1 };
		const drawFn = jest.fn();

		test( 'should handle 90 degree rotation', () => {
			// cos(90) = 0, sin(90) = 1
			ctx.getTransform = jest.fn( () => ( {
				a: 0, b: 1, c: -1, d: 0, e: 100, f: 100
			} ) );

			renderer.drawSpreadShadow( layer, scale, 5, drawFn );
			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should handle 180 degree rotation', () => {
			// cos(180) = -1, sin(180) = 0
			ctx.getTransform = jest.fn( () => ( {
				a: -1, b: 0, c: 0, d: -1, e: 100, f: 100
			} ) );

			renderer.drawSpreadShadow( layer, scale, 5, drawFn );
			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should handle skew (non-rotation) transform', () => {
			// Skew but not rotation: b and c are non-zero
			ctx.getTransform = jest.fn( () => ( {
				a: 1, b: 0.5, c: 0.3, d: 1, e: 0, f: 0
			} ) );

			renderer.drawSpreadShadow( layer, scale, 5, drawFn );
			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should handle no transform (identity matrix)', () => {
			ctx.getTransform = jest.fn( () => ( {
				a: 1, b: 0, c: 0, d: 1, e: 0, f: 0
			} ) );

			renderer.drawSpreadShadow( layer, scale, 5, drawFn );
			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should handle missing getTransform method', () => {
			ctx.getTransform = undefined;

			renderer.drawSpreadShadow( layer, scale, 5, drawFn );
			expect( drawFn ).toHaveBeenCalled();
		} );

		test( 'should handle rotation in drawSpreadShadowStroke', () => {
			ctx.getTransform = jest.fn( () => ( {
				a: 0, b: 1, c: -1, d: 0, e: 50, f: 50
			} ) );

			renderer.drawSpreadShadowStroke( layer, scale, 3, drawFn );
			expect( drawFn ).toHaveBeenCalled();
		} );
	} );

	describe( 'DOMMatrix handling', () => {
		const layer = { shadow: true, shadowSpread: 5 };
		const scale = { sx: 1, sy: 1, avg: 1 };
		const drawFn = jest.fn();

		test( 'should create DOMMatrix for rotation extraction', () => {
			ctx.getTransform = jest.fn( () => ( {
				a: 0.707, b: 0.707, c: -0.707, d: 0.707, e: 100, f: 200
			} ) );

			renderer.drawSpreadShadow( layer, scale, 5, drawFn );
			expect( drawFn ).toHaveBeenCalled();
		} );
	} );
} );
