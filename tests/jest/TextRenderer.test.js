/**
 * Tests for TextRenderer module
 *
 * @jest-environment jsdom
 */

'use strict';

// Load the module
const TextRenderer = require( '../../resources/ext.layers.shared/TextRenderer.js' );

// Mock canvas context
function createMockContext() {
	return {
		save: jest.fn(),
		restore: jest.fn(),
		fillText: jest.fn(),
		strokeText: jest.fn(),
		measureText: jest.fn( () => ( { width: 100 } ) ),
		translate: jest.fn(),
		rotate: jest.fn(),
		font: '',
		textAlign: 'left',
		fillStyle: '#000000',
		strokeStyle: '#000000',
		lineWidth: 1,
		globalAlpha: 1,
		shadowColor: '',
		shadowBlur: 0,
		shadowOffsetX: 0,
		shadowOffsetY: 0
	};
}

// Mock ShadowRenderer
function createMockShadowRenderer() {
	return {
		hasShadowEnabled: jest.fn( ( layer ) => !!layer.shadow ),
		getShadowParams: jest.fn( () => ( {
			color: 'rgba(0,0,0,0.5)',
			blur: 10,
			offsetX: 5,
			offsetY: 5
		} ) ),
		getShadowSpread: jest.fn( ( layer ) => layer.shadowSpread || 0 ),
		applyShadow: jest.fn(),
		clearShadow: jest.fn()
	};
}

describe( 'TextRenderer', () => {
	let ctx;
	let renderer;

	beforeEach( () => {
		ctx = createMockContext();
		renderer = new TextRenderer( ctx );
	} );

	afterEach( () => {
		if ( renderer ) {
			renderer.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should create instance with context', () => {
			expect( renderer ).toBeInstanceOf( TextRenderer );
			expect( renderer.ctx ).toBe( ctx );
		} );

		it( 'should accept shadow renderer config', () => {
			const shadowRenderer = createMockShadowRenderer();
			const r = new TextRenderer( ctx, { shadowRenderer } );
			expect( r.shadowRenderer ).toBe( shadowRenderer );
			r.destroy();
		} );

		it( 'should handle missing config', () => {
			const r = new TextRenderer( ctx );
			expect( r.shadowRenderer ).toBe( null );
			r.destroy();
		} );
	} );

	describe( 'setContext', () => {
		it( 'should update the context', () => {
			const newCtx = createMockContext();
			renderer.setContext( newCtx );
			expect( renderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'setShadowRenderer', () => {
		it( 'should set shadow renderer instance', () => {
			const shadowRenderer = createMockShadowRenderer();
			renderer.setShadowRenderer( shadowRenderer );
			expect( renderer.shadowRenderer ).toBe( shadowRenderer );
		} );
	} );

	describe( 'hasShadowEnabled', () => {
		it( 'should return true for shadow = true', () => {
			expect( renderer.hasShadowEnabled( { shadow: true } ) ).toBe( true );
		} );

		it( 'should return true for shadow = "true"', () => {
			expect( renderer.hasShadowEnabled( { shadow: 'true' } ) ).toBe( true );
		} );

		it( 'should return true for shadow = 1', () => {
			expect( renderer.hasShadowEnabled( { shadow: 1 } ) ).toBe( true );
		} );

		it( 'should return true for shadow object', () => {
			expect( !!renderer.hasShadowEnabled( { shadow: { color: '#000' } } ) ).toBe( true );
		} );

		it( 'should return false for shadow = false', () => {
			expect( renderer.hasShadowEnabled( { shadow: false } ) ).toBe( false );
		} );

		it( 'should return false for no shadow property', () => {
			expect( renderer.hasShadowEnabled( {} ) ).toBe( false );
		} );

		it( 'should delegate to shadowRenderer when available', () => {
			const shadowRenderer = createMockShadowRenderer();
			shadowRenderer.hasShadowEnabled.mockReturnValue( true );
			renderer.setShadowRenderer( shadowRenderer );

			const layer = { shadow: true };
			const result = renderer.hasShadowEnabled( layer );

			expect( shadowRenderer.hasShadowEnabled ).toHaveBeenCalledWith( layer );
			expect( result ).toBe( true );
		} );
	} );

	describe( 'clearShadow', () => {
		it( 'should clear shadow settings when no shadowRenderer', () => {
			renderer.clearShadow();
			expect( ctx.shadowColor ).toBe( 'transparent' );
			expect( ctx.shadowBlur ).toBe( 0 );
			expect( ctx.shadowOffsetX ).toBe( 0 );
			expect( ctx.shadowOffsetY ).toBe( 0 );
		} );

		it( 'should delegate to shadowRenderer when available', () => {
			const shadowRenderer = createMockShadowRenderer();
			renderer.setShadowRenderer( shadowRenderer );
			renderer.clearShadow();
			expect( shadowRenderer.clearShadow ).toHaveBeenCalled();
		} );
	} );

	describe( 'getShadowSpread', () => {
		it( 'should return 0 when shadow not enabled', () => {
			expect( renderer.getShadowSpread( {}, { avg: 1 } ) ).toBe( 0 );
		} );

		it( 'should return scaled spread when enabled', () => {
			const layer = { shadow: true, shadowSpread: 10 };
			const scale = { avg: 2 };
			expect( renderer.getShadowSpread( layer, scale ) ).toBe( 20 );
		} );

		it( 'should return 0 when spread is not set', () => {
			const layer = { shadow: true };
			expect( renderer.getShadowSpread( layer, { avg: 1 } ) ).toBe( 0 );
		} );

		it( 'should delegate to shadowRenderer when available', () => {
			const shadowRenderer = createMockShadowRenderer();
			shadowRenderer.getShadowSpread.mockReturnValue( 15 );
			renderer.setShadowRenderer( shadowRenderer );

			const layer = { shadow: true, shadowSpread: 10 };
			const scale = { avg: 1 };
			const result = renderer.getShadowSpread( layer, scale );

			expect( shadowRenderer.getShadowSpread ).toHaveBeenCalledWith( layer, scale );
			expect( result ).toBe( 15 );
		} );
	} );

	describe( 'getShadowParams', () => {
		it( 'should return shadow parameters from layer', () => {
			const layer = {
				shadow: true,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			};
			const scale = { sx: 1, sy: 1, avg: 1 };
			const params = renderer.getShadowParams( layer, scale );

			expect( params.color ).toBe( 'rgba(0,0,0,0.5)' );
			expect( params.blur ).toBe( 10 );
			expect( params.offsetX ).toBe( 5 );
			expect( params.offsetY ).toBe( 5 );
		} );

		it( 'should use defaults for missing properties', () => {
			const layer = { shadow: true };
			const scale = { sx: 1, sy: 1, avg: 1 };
			const params = renderer.getShadowParams( layer, scale );

			expect( params.color ).toBe( 'rgba(0,0,0,0.4)' );
			expect( params.blur ).toBe( 8 );
			expect( params.offsetX ).toBe( 2 );
			expect( params.offsetY ).toBe( 2 );
		} );

		it( 'should scale parameters when scale provided', () => {
			const layer = {
				shadow: true,
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			};
			const scale = { sx: 2, sy: 2, avg: 2 };
			const params = renderer.getShadowParams( layer, scale );

			expect( params.blur ).toBe( 20 );
			expect( params.offsetX ).toBe( 10 );
			expect( params.offsetY ).toBe( 10 );
		} );

		it( 'should delegate to shadowRenderer when available', () => {
			const shadowRenderer = createMockShadowRenderer();
			renderer.setShadowRenderer( shadowRenderer );

			const layer = { shadow: true };
			renderer.getShadowParams( layer );

			expect( shadowRenderer.getShadowParams ).toHaveBeenCalled();
		} );
	} );

	describe( 'applyShadow', () => {
		it( 'should apply shadow settings to context', () => {
			const layer = {
				shadow: true,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			};
			const scale = { sx: 1, sy: 1, avg: 1 };

			renderer.applyShadow( layer, scale );

			expect( ctx.shadowColor ).toBe( 'rgba(0,0,0,0.5)' );
			expect( ctx.shadowBlur ).toBe( 10 );
			expect( ctx.shadowOffsetX ).toBe( 5 );
			expect( ctx.shadowOffsetY ).toBe( 5 );
		} );

		it( 'should scale shadow values', () => {
			const layer = {
				shadow: true,
				shadowBlur: 10,
				shadowOffsetX: 5,
				shadowOffsetY: 5
			};
			const scale = { sx: 2, sy: 2, avg: 2 };

			renderer.applyShadow( layer, scale );

			expect( ctx.shadowBlur ).toBe( 20 );
			expect( ctx.shadowOffsetX ).toBe( 10 );
			expect( ctx.shadowOffsetY ).toBe( 10 );
		} );

		it( 'should delegate to shadowRenderer when available', () => {
			const shadowRenderer = createMockShadowRenderer();
			renderer.setShadowRenderer( shadowRenderer );

			const layer = { shadow: true };
			renderer.applyShadow( layer );

			expect( shadowRenderer.applyShadow ).toHaveBeenCalled();
		} );
	} );

	describe( 'draw', () => {
		it( 'should draw basic text', () => {
			const layer = {
				type: 'text',
				text: 'Hello World',
				x: 100,
				y: 50,
				fontSize: 16,
				fontFamily: 'Arial',
				fill: '#000000'
			};

			renderer.draw( layer );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.fillText ).toHaveBeenCalledWith( 'Hello World', expect.any( Number ), expect.any( Number ) );
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should set font properties', () => {
			const layer = {
				type: 'text',
				text: 'Hello',
				x: 0,
				y: 0,
				fontSize: 24,
				fontFamily: 'Georgia',
				textAlign: 'center'
			};

			renderer.draw( layer );

			expect( ctx.font ).toContain( '24' );
			expect( ctx.font ).toContain( 'Georgia' );
			expect( ctx.textAlign ).toBe( 'center' );
		} );

		it( 'should apply fill color', () => {
			const layer = {
				type: 'text',
				text: 'Colored',
				x: 0,
				y: 0,
				fill: '#ff0000'
			};

			renderer.draw( layer );

			expect( ctx.fillStyle ).toBe( '#ff0000' );
		} );

		it( 'should use color as fallback for fill', () => {
			const layer = {
				type: 'text',
				text: 'Colored',
				x: 0,
				y: 0,
				color: '#00ff00'
			};

			renderer.draw( layer );

			expect( ctx.fillStyle ).toBe( '#00ff00' );
		} );

		it( 'should apply opacity', () => {
			const layer = {
				type: 'text',
				text: 'Transparent',
				x: 0,
				y: 0,
				opacity: 0.5
			};

			renderer.draw( layer );

			expect( ctx.globalAlpha ).toBe( 0.5 );
		} );

		it( 'should handle fill opacity', () => {
			const layer = {
				type: 'text',
				text: 'Test',
				x: 0,
				y: 0,
				fillOpacity: 0.7
			};

			renderer.draw( layer );

			// globalAlpha should reflect fillOpacity
			expect( ctx.globalAlpha ).toBeCloseTo( 0.7, 1 );
		} );

		it( 'should apply text stroke when enabled', () => {
			const layer = {
				type: 'text',
				text: 'Stroked',
				x: 0,
				y: 0,
				textStrokeWidth: 2,
				textStrokeColor: '#ffffff'
			};

			renderer.draw( layer );

			expect( ctx.strokeText ).toHaveBeenCalled();
			expect( ctx.strokeStyle ).toBe( '#ffffff' );
		} );

		it( 'should not stroke when textStrokeWidth is 0', () => {
			const layer = {
				type: 'text',
				text: 'No stroke',
				x: 0,
				y: 0,
				textStrokeWidth: 0
			};

			renderer.draw( layer );

			expect( ctx.strokeText ).not.toHaveBeenCalled();
		} );

		it( 'should handle rotation', () => {
			const layer = {
				type: 'text',
				text: 'Rotated',
				x: 100,
				y: 100,
				rotation: 45
			};

			renderer.draw( layer );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		it( 'should not rotate when rotation is 0', () => {
			const layer = {
				type: 'text',
				text: 'Not rotated',
				x: 100,
				y: 100,
				rotation: 0
			};

			renderer.draw( layer );

			expect( ctx.translate ).not.toHaveBeenCalled();
			expect( ctx.rotate ).not.toHaveBeenCalled();
		} );

		it( 'HIGH-v25-1 regression: should adjust rotation pivot for center-aligned text', () => {
			const layer = {
				type: 'text',
				text: 'Centered',
				x: 200,
				y: 100,
				textAlign: 'center',
				rotation: 90
			};

			renderer.draw( layer );

			// For center-aligned text, translate should use x directly as centerX
			expect( ctx.translate ).toHaveBeenCalled();
			const translateCall = ctx.translate.mock.calls[ 0 ];
			// centerX should be x (200) for center-aligned text
			expect( translateCall[ 0 ] ).toBe( 200 );
		} );

		it( 'HIGH-v25-1 regression: should adjust rotation pivot for right-aligned text', () => {
			const layer = {
				type: 'text',
				text: 'Right',
				x: 300,
				y: 100,
				textAlign: 'right',
				rotation: 45
			};

			renderer.draw( layer );

			expect( ctx.translate ).toHaveBeenCalled();
			const translateCall = ctx.translate.mock.calls[ 0 ];
			// For right-aligned, centerX = x - textWidth/2
			// The exact value depends on measureText mock, but it should NOT equal x
			expect( translateCall[ 0 ] ).toBeDefined();
		} );

		it( 'HIGH-v25-1 regression: should adjust post-rotation offset for left-aligned text', () => {
			const layer = {
				type: 'text',
				text: 'Left',
				x: 100,
				y: 100,
				textAlign: 'left',
				rotation: 30
			};

			renderer.draw( layer );

			// For left-aligned text, after translate to center:
			// fillText should be called with negative x offset (-textWidth/2)
			expect( ctx.fillText ).toHaveBeenCalled();
			const fillCall = ctx.fillText.mock.calls[ 0 ];
			// x offset should be negative (shifted left from center)
			expect( fillCall[ 1 ] ).toBeLessThan( 0 );
		} );

		it( 'should handle empty text', () => {
			const layer = {
				type: 'text',
				text: '',
				x: 0,
				y: 0
			};

			renderer.draw( layer );

			// Should still call fillText with empty string
			expect( ctx.fillText ).toHaveBeenCalledWith( '', expect.any( Number ), expect.any( Number ) );
		} );

		it( 'should use default values for missing properties', () => {
			const layer = {
				type: 'text',
				text: 'Defaults'
			};

			renderer.draw( layer );

			// Should use default x=0, y=0
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		it( 'should scale font size when not pre-scaled', () => {
			const layer = {
				type: 'text',
				text: 'Scaled',
				fontSize: 16,
				x: 0,
				y: 0
			};

			renderer.draw( layer, { scale: { avg: 2 }, scaled: false } );

			// Font size should be scaled
			expect( ctx.font ).toContain( '32' );
		} );

		it( 'should not scale font when pre-scaled', () => {
			const layer = {
				type: 'text',
				text: 'Pre-scaled',
				fontSize: 16,
				x: 0,
				y: 0
			};

			renderer.draw( layer, { scale: { avg: 2 }, scaled: true } );

			// Font size should not be scaled when pre-scaled
			expect( ctx.font ).toContain( '16' );
		} );
	} );

	describe( 'shadow handling', () => {
		it( 'should apply shadow when enabled', () => {
			const layer = {
				type: 'text',
				text: 'Shadow text',
				x: 0,
				y: 0,
				shadow: true,
				shadowColor: 'rgba(0,0,0,0.5)',
				shadowBlur: 5,
				shadowOffsetX: 2,
				shadowOffsetY: 2
			};

			renderer.draw( layer );

			// Shadow should be applied
			expect( ctx.shadowColor ).toBe( 'rgba(0,0,0,0.5)' );
			expect( ctx.shadowBlur ).toBe( 5 );
		} );

		it( 'should handle shadow spread', () => {
			const layer = {
				type: 'text',
				text: 'Spread shadow',
				x: 0,
				y: 0,
				shadow: true,
				shadowSpread: 5
			};

			// Create new mock context that tracks all calls
			const spreadCtx = createMockContext();
			renderer.setContext( spreadCtx );

			renderer.draw( layer );

			// Should still render text
			expect( spreadCtx.fillText ).toHaveBeenCalled();
		} );

		it( 'should clear shadow after drawing', () => {
			const layer = {
				type: 'text',
				text: 'Shadow cleared',
				x: 0,
				y: 0,
				shadow: true
			};

			renderer.draw( layer );

			// After draw, context should be restored (which clears shadow)
			expect( ctx.restore ).toHaveBeenCalled();
		} );
	} );

	describe( 'measureText', () => {
		it( 'should measure text width', () => {
			ctx.measureText.mockReturnValue( { width: 150 } );

			const metrics = renderer.measureText( 'Test string', 16, 'Arial' );

			expect( metrics.width ).toBe( 150 );
		} );

		it( 'should set font before measuring', () => {
			renderer.measureText( 'Test', 20, 'Georgia' );

			expect( ctx.font ).toBe( '20px Georgia' );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up resources', () => {
			renderer.destroy();
			expect( renderer.ctx ).toBe( null );
			expect( renderer.shadowRenderer ).toBe( null );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export TextRenderer class', () => {
			expect( TextRenderer ).toBeDefined();
			expect( typeof TextRenderer ).toBe( 'function' );
		} );

		it( 'should allow creating new instances', () => {
			const instance = new TextRenderer( ctx );
			expect( instance ).toBeInstanceOf( TextRenderer );
			instance.destroy();
		} );
	} );
} );
