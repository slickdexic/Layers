/**
 * Tests for CalloutRenderer class
 *
 * CalloutRenderer handles rendering of callout (speech bubble) shapes
 * with rounded rectangles and configurable tail/pointer.
 */

'use strict';

// Mock dependencies before requiring module
const mockShadowRenderer = {
	clearShadow: jest.fn(),
	hasShadowEnabled: jest.fn( () => false ),
	getShadowSpread: jest.fn( () => 0 ),
	applyShadow: jest.fn(),
	drawSpreadShadow: jest.fn()
};

const mockEffectsRenderer = {
	drawBlurFill: jest.fn()
};

const mockTextBoxRenderer = {
	drawTextContent: jest.fn()
};

// Mock canvas context
function createMockContext() {
	return {
		save: jest.fn(),
		restore: jest.fn(),
		beginPath: jest.fn(),
		closePath: jest.fn(),
		moveTo: jest.fn(),
		lineTo: jest.fn(),
		arc: jest.fn(),
		arcTo: jest.fn(),
		fill: jest.fn(),
		stroke: jest.fn(),
		fillText: jest.fn(),
		translate: jest.fn(),
		rotate: jest.fn(),
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 1,
		globalAlpha: 1,
		font: '',
		textAlign: 'left',
		shadowColor: 'transparent',
		shadowBlur: 0,
		shadowOffsetX: 0,
		shadowOffsetY: 0
	};
}

// Set up global before loading module
beforeAll( () => {
	// Set up Layers namespace
	window.Layers = window.Layers || {};
	window.Layers.MathUtils = {
		clampOpacity: ( v ) => {
			if ( typeof v !== 'number' || Number.isNaN( v ) ) {
				return 1;
			}
			return Math.max( 0, Math.min( 1, v ) );
		}
	};

	// Load the module
	require( '../../resources/ext.layers.shared/CalloutRenderer.js' );
} );

beforeEach( () => {
	jest.clearAllMocks();
} );

describe( 'CalloutRenderer', () => {
	describe( 'constructor', () => {
		test( 'should create instance with context', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer.ctx ).toBe( ctx );
			expect( renderer.shadowRenderer ).toBeNull();
			expect( renderer.effectsRenderer ).toBeNull();
			expect( renderer.textBoxRenderer ).toBeNull();
		} );

		test( 'should accept configuration options', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx, {
				shadowRenderer: mockShadowRenderer,
				effectsRenderer: mockEffectsRenderer,
				textBoxRenderer: mockTextBoxRenderer
			} );

			expect( renderer.shadowRenderer ).toBe( mockShadowRenderer );
			expect( renderer.effectsRenderer ).toBe( mockEffectsRenderer );
			expect( renderer.textBoxRenderer ).toBe( mockTextBoxRenderer );
		} );
	} );

	describe( 'setters', () => {
		test( 'should set shadow renderer', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.setShadowRenderer( mockShadowRenderer );
			expect( renderer.shadowRenderer ).toBe( mockShadowRenderer );
		} );

		test( 'should set effects renderer', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.setEffectsRenderer( mockEffectsRenderer );
			expect( renderer.effectsRenderer ).toBe( mockEffectsRenderer );
		} );

		test( 'should set text box renderer', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.setTextBoxRenderer( mockTextBoxRenderer );
			expect( renderer.textBoxRenderer ).toBe( mockTextBoxRenderer );
		} );

		test( 'should set context', () => {
			const ctx1 = createMockContext();
			const ctx2 = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx1 );

			renderer.setContext( ctx2 );
			expect( renderer.ctx ).toBe( ctx2 );
		} );
	} );

	describe( 'getTailCoordinates', () => {
		test( 'should return bottom tail coordinates', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const coords = renderer.getTailCoordinates( 0, 0, 200, 100, 'bottom', 0.5, 20, 8 );

			expect( coords.tip.y ).toBe( 120 ); // y + height + tailSize
			expect( coords.base1.y ).toBe( 100 ); // y + height
			expect( coords.base2.y ).toBe( 100 );
		} );

		test( 'should return top tail coordinates', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const coords = renderer.getTailCoordinates( 0, 0, 200, 100, 'top', 0.5, 20, 8 );

			expect( coords.tip.y ).toBe( -20 ); // y - tailSize
			expect( coords.base1.y ).toBe( 0 ); // y
			expect( coords.base2.y ).toBe( 0 );
		} );

		test( 'should return left tail coordinates', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const coords = renderer.getTailCoordinates( 0, 0, 200, 100, 'left', 0.5, 20, 8 );

			expect( coords.tip.x ).toBe( -20 ); // x - tailSize
			expect( coords.base1.x ).toBe( 0 ); // x
			expect( coords.base2.x ).toBe( 0 );
		} );

		test( 'should return right tail coordinates', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const coords = renderer.getTailCoordinates( 0, 0, 200, 100, 'right', 0.5, 20, 8 );

			expect( coords.tip.x ).toBe( 220 ); // x + width + tailSize
			expect( coords.base1.x ).toBe( 200 ); // x + width
			expect( coords.base2.x ).toBe( 200 );
		} );

		test( 'should handle bottom-left direction', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const coords = renderer.getTailCoordinates( 0, 0, 200, 100, 'bottom-left', 0.5, 20, 8 );

			// Position should be forced to 0.2 for bottom-left
			expect( coords.tip.y ).toBe( 120 );
			expect( coords.tip.x ).toBeLessThan( 100 ); // Should be left of center
		} );

		test( 'should handle bottom-right direction', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const coords = renderer.getTailCoordinates( 0, 0, 200, 100, 'bottom-right', 0.5, 20, 8 );

			// Position should be forced to 0.8 for bottom-right
			expect( coords.tip.y ).toBe( 120 );
			expect( coords.tip.x ).toBeGreaterThan( 100 ); // Should be right of center
		} );

		test( 'should return default bottom center for unknown direction', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const coords = renderer.getTailCoordinates( 0, 0, 200, 100, 'unknown', 0.5, 20, 8 );

			expect( coords.tip.y ).toBe( 120 );
			expect( coords.tip.x ).toBe( 100 ); // Center of width
		} );
	} );

	describe( 'draw', () => {
		test( 'should draw a basic callout shape', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				stroke: '#000000',
				strokeWidth: 2,
				cornerRadius: 8,
				tailDirection: 'bottom',
				tailPosition: 0.5,
				tailSize: 20
			};

			renderer.draw( layer );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		test( 'should handle rotation', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				rotation: 45,
				tailDirection: 'bottom'
			};

			renderer.draw( layer );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		test( 'should handle opacity', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				opacity: 0.5,
				fillOpacity: 0.8
			};

			renderer.draw( layer );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'should not draw fill for transparent', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: 'transparent',
				stroke: '#000000'
			};

			renderer.draw( layer );

			// stroke should still be called, but fill called only 0 times
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'should draw text using textBoxRenderer if available', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx, {
				textBoxRenderer: mockTextBoxRenderer
			} );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				text: 'Hello World'
			};

			renderer.draw( layer );

			expect( mockTextBoxRenderer.drawTextContent ).toHaveBeenCalled();
		} );

		test( 'should draw simple text fallback without textBoxRenderer', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				text: 'Hello World',
				fontSize: 16,
				color: '#000000'
			};

			renderer.draw( layer );

			expect( ctx.fillText ).toHaveBeenCalledWith( 'Hello World', expect.any( Number ), expect.any( Number ) );
		} );

		test( 'should handle blur fill', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx, {
				effectsRenderer: mockEffectsRenderer
			} );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: 'blur',
				tailDirection: 'bottom'
			};

			renderer.draw( layer );

			expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalled();
		} );

		test( 'should use default tail values when not specified', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff'
				// No tail properties - should use defaults
			};

			renderer.draw( layer );

			expect( ctx.fill ).toHaveBeenCalled();
		} );
	} );

	describe( 'shadow handling', () => {
		test( 'should check shadow enabled via shadowRenderer', () => {
			const ctx = createMockContext();
			mockShadowRenderer.hasShadowEnabled.mockReturnValue( true );

			const renderer = new window.Layers.CalloutRenderer( ctx, {
				shadowRenderer: mockShadowRenderer
			} );

			expect( renderer.hasShadowEnabled( { shadow: true } ) ).toBe( true );
			expect( mockShadowRenderer.hasShadowEnabled ).toHaveBeenCalled();
		} );

		test( 'should use fallback shadow check without shadowRenderer', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer.hasShadowEnabled( { shadow: true } ) ).toBe( true );
			expect( renderer.hasShadowEnabled( { shadow: 'true' } ) ).toBe( true );
			expect( renderer.hasShadowEnabled( { shadow: 1 } ) ).toBe( true );
			expect( renderer.hasShadowEnabled( { shadow: '1' } ) ).toBe( true );
			expect( renderer.hasShadowEnabled( { shadow: false } ) ).toBe( false );
		} );

		test( 'should clear shadow without shadowRenderer', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.clearShadow();

			expect( ctx.shadowColor ).toBe( 'transparent' );
			expect( ctx.shadowBlur ).toBe( 0 );
		} );
	} );

	describe( 'text alignment', () => {
		test( 'should handle center text alignment', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				text: 'Centered',
				textAlign: 'center'
			};

			renderer.draw( layer );

			expect( ctx.textAlign ).toBe( 'center' );
		} );

		test( 'should handle right text alignment', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				text: 'Right aligned',
				textAlign: 'right'
			};

			renderer.draw( layer );

			expect( ctx.textAlign ).toBe( 'right' );
		} );

		test( 'should handle middle vertical alignment', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				text: 'Middle',
				verticalAlign: 'middle'
			};

			renderer.draw( layer );

			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		test( 'should handle bottom vertical alignment', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				text: 'Bottom',
				verticalAlign: 'bottom'
			};

			renderer.draw( layer );

			expect( ctx.fillText ).toHaveBeenCalled();
		} );
	} );

	describe( 'exports', () => {
		test( 'should export to window.Layers namespace', () => {
			expect( window.Layers.CalloutRenderer ).toBeDefined();
			expect( typeof window.Layers.CalloutRenderer ).toBe( 'function' );
		} );
	} );

	describe( 'drawCalloutPath edge cases', () => {
		test( 'should handle invalid NaN inputs gracefully', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// NaN values should abort with empty path
			renderer.drawCalloutPath( NaN, 0, 200, 100, 8, 'bottom', 0.5, 20 );
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).not.toHaveBeenCalled();
		} );

		test( 'should handle very small shapes (width < 5)', () => {
			const ctx = createMockContext();
			ctx.rect = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 3, 100, 8, 'bottom', 0.5, 20 );
			expect( ctx.rect ).toHaveBeenCalled();
		} );

		test( 'should handle very small shapes (height < 5)', () => {
			const ctx = createMockContext();
			ctx.rect = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 3, 8, 'bottom', 0.5, 20 );
			expect( ctx.rect ).toHaveBeenCalled();
		} );

		test( 'should handle zero corner radius (simple path)', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 0, 'bottom', 0.5, 20 );
			expect( ctx.moveTo ).toHaveBeenCalled();
			expect( ctx.lineTo ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
			// arcTo should NOT be called for zero radius
			expect( ctx.arcTo ).not.toHaveBeenCalled();
		} );

		test( 'should draw simple path with top tail and zero radius', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 0, 'top', 0.5, 20 );
			expect( ctx.lineTo ).toHaveBeenCalled();
		} );

		test( 'should draw simple path with right tail and zero radius', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 0, 'right', 0.5, 20 );
			expect( ctx.lineTo ).toHaveBeenCalled();
		} );

		test( 'should draw simple path with left tail and zero radius', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 0, 'left', 0.5, 20 );
			expect( ctx.lineTo ).toHaveBeenCalled();
		} );

		test( 'should fallback to rect when tail coordinates invalid', () => {
			const ctx = createMockContext();
			ctx.rect = jest.fn();
			ctx.roundRect = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Spy on getTailCoordinates to return invalid data
			const originalGetTail = renderer.getTailCoordinates.bind( renderer );
			renderer.getTailCoordinates = jest.fn( () => ( { base1: null, base2: null, tip: null } ) );

			renderer.drawCalloutPath( 0, 0, 200, 100, 8, 'bottom', 0.5, 20 );
			// Should use roundRect or rect fallback
			expect( ctx.roundRect ).toHaveBeenCalled();

			renderer.getTailCoordinates = originalGetTail;
		} );

		test( 'should use rect fallback when roundRect not available and tail invalid', () => {
			const ctx = createMockContext();
			ctx.rect = jest.fn();
			// roundRect not available
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.getTailCoordinates = jest.fn( () => ( { base1: null, base2: null, tip: null } ) );

			renderer.drawCalloutPath( 0, 0, 200, 100, 0.3, 'bottom', 0.5, 20 );
			expect( ctx.rect ).toHaveBeenCalled();
		} );
	} );

	describe( 'draw edge cases', () => {
		test( 'should skip rendering for zero width', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 0,
				height: 80,
				fill: '#ffffff'
			};

			renderer.draw( layer );
			// Should return early without save/restore
			expect( ctx.save ).not.toHaveBeenCalled();
		} );

		test( 'should skip rendering for zero height', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 0,
				fill: '#ffffff'
			};

			renderer.draw( layer );
			expect( ctx.save ).not.toHaveBeenCalled();
		} );

		test( 'should handle negative width dimensions', () => {
			const ctx = createMockContext();
			ctx.rect = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 200,
				y: 50,
				width: -150,
				height: 80,
				fill: '#ffffff'
			};

			renderer.draw( layer );
			expect( ctx.save ).toHaveBeenCalled();
		} );

		test( 'should handle negative height dimensions', () => {
			const ctx = createMockContext();
			ctx.rect = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 130,
				width: 150,
				height: -80,
				fill: '#ffffff'
			};

			renderer.draw( layer );
			expect( ctx.save ).toHaveBeenCalled();
		} );

		test( 'should draw simple rect for small shapes (width < 20)', () => {
			const ctx = createMockContext();
			ctx.rect = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 15,
				height: 80,
				fill: '#ffffff',
				stroke: '#000000',
				strokeWidth: 2
			};

			renderer.draw( layer );
			expect( ctx.rect ).toHaveBeenCalled();
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'should draw simple rect for small shapes (height < 20)', () => {
			const ctx = createMockContext();
			ctx.rect = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 15,
				fill: '#ffffff'
			};

			renderer.draw( layer );
			expect( ctx.rect ).toHaveBeenCalled();
		} );

		test( 'should handle errors in draw gracefully', () => {
			const ctx = createMockContext();
			const consoleError = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Force an error by making save throw
			ctx.save = jest.fn( () => {
				throw new Error( 'Test error' );
			} );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff'
			};

			// Should not throw
			expect( () => renderer.draw( layer ) ).not.toThrow();
			expect( consoleError ).toHaveBeenCalled();

			consoleError.mockRestore();
		} );

		test( 'should handle scaled option correctly', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				strokeWidth: 2,
				cornerRadius: 8,
				tailSize: 20
			};

			renderer.draw( layer, { scaled: true, scale: { sx: 2, sy: 2, avg: 2 } } );
			expect( ctx.save ).toHaveBeenCalled();
		} );
	} );

	describe( 'blur fill edge cases', () => {
		test( 'should calculate rotated blur bounds', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx, {
				effectsRenderer: mockEffectsRenderer
			} );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: 'blur',
				rotation: 45,
				tailDirection: 'bottom'
			};

			renderer.draw( layer );

			expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalled();
			// bounds is the 3rd argument (index 2): drawBlurFill(layer, drawPathFn, bounds, options)
			const blurBounds = mockEffectsRenderer.drawBlurFill.mock.calls[ 0 ][ 2 ];
			expect( blurBounds ).toHaveProperty( 'x' );
			expect( blurBounds ).toHaveProperty( 'y' );
			expect( blurBounds ).toHaveProperty( 'width' );
			expect( blurBounds ).toHaveProperty( 'height' );
		} );

		test( 'should adjust blur bounds for top tail direction', () => {
			const ctx = createMockContext();
			mockEffectsRenderer.drawBlurFill.mockClear();
			const renderer = new window.Layers.CalloutRenderer( ctx, {
				effectsRenderer: mockEffectsRenderer
			} );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: 'blur',
				tailDirection: 'top'
			};

			renderer.draw( layer );

			expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalled();
			// bounds is the 3rd argument (index 2): drawBlurFill(layer, drawPathFn, bounds, options)
			const blurBounds = mockEffectsRenderer.drawBlurFill.mock.calls[ 0 ][ 2 ];
			// Top tail should shift bounds Y up
			expect( blurBounds.y ).toBeLessThan( 50 );
		} );

		test( 'should not call blur fill when fillOpacity is 0', () => {
			const ctx = createMockContext();
			mockEffectsRenderer.drawBlurFill.mockClear();
			const renderer = new window.Layers.CalloutRenderer( ctx, {
				effectsRenderer: mockEffectsRenderer
			} );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: 'blur',
				fillOpacity: 0
			};

			renderer.draw( layer );
			expect( mockEffectsRenderer.drawBlurFill ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'shadow spread', () => {
		test( 'should call drawSpreadShadow when spread > 0', () => {
			const ctx = createMockContext();
			mockShadowRenderer.getShadowSpread.mockReturnValue( 5 );
			mockShadowRenderer.hasShadowEnabled.mockReturnValue( true );
			const renderer = new window.Layers.CalloutRenderer( ctx, {
				shadowRenderer: mockShadowRenderer
			} );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				shadow: true,
				shadowSpread: 5
			};

			renderer.draw( layer );
			expect( mockShadowRenderer.drawSpreadShadow ).toHaveBeenCalled();

			// Reset
			mockShadowRenderer.getShadowSpread.mockReturnValue( 0 );
		} );

		test( 'should apply shadow on fill when no spread', () => {
			const ctx = createMockContext();
			mockShadowRenderer.getShadowSpread.mockReturnValue( 0 );
			mockShadowRenderer.hasShadowEnabled.mockReturnValue( true );
			const renderer = new window.Layers.CalloutRenderer( ctx, {
				shadowRenderer: mockShadowRenderer
			} );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				shadow: true
			};

			renderer.draw( layer );
			expect( mockShadowRenderer.applyShadow ).toHaveBeenCalled();
		} );

		test( 'should apply shadow on stroke when no fill', () => {
			const ctx = createMockContext();
			mockShadowRenderer.getShadowSpread.mockReturnValue( 0 );
			mockShadowRenderer.hasShadowEnabled.mockReturnValue( true );
			mockShadowRenderer.applyShadow.mockClear();
			const renderer = new window.Layers.CalloutRenderer( ctx, {
				shadowRenderer: mockShadowRenderer
			} );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				stroke: '#000000',
				strokeWidth: 2,
				shadow: true
				// no fill
			};

			renderer.draw( layer );
			expect( mockShadowRenderer.applyShadow ).toHaveBeenCalled();
		} );
	} );

	describe( 'setContext with textBoxRenderer', () => {
		test( 'should update textBoxRenderer context when available', () => {
			const ctx1 = createMockContext();
			const ctx2 = createMockContext();
			const mockTBR = {
				setContext: jest.fn(),
				drawTextContent: jest.fn()
			};
			const renderer = new window.Layers.CalloutRenderer( ctx1, {
				textBoxRenderer: mockTBR
			} );

			renderer.setContext( ctx2 );

			expect( renderer.ctx ).toBe( ctx2 );
			expect( mockTBR.setContext ).toHaveBeenCalledWith( ctx2 );
		} );
	} );

	describe( 'getShadowSpread fallback', () => {
		test( 'should return 0 when shadow not enabled', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const result = renderer.getShadowSpread( { shadow: false }, { avg: 1 } );
			expect( result ).toBe( 0 );
		} );

		test( 'should return scaled spread when shadow enabled with spread', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const result = renderer.getShadowSpread(
				{ shadow: true, shadowSpread: 10 },
				{ avg: 2 }
			);
			expect( result ).toBe( 20 ); // 10 * 2
		} );

		test( 'should return 0 when shadow enabled but no spread value', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const result = renderer.getShadowSpread( { shadow: true }, { avg: 1 } );
			expect( result ).toBe( 0 );
		} );
	} );

	describe( 'getTailCoordinates corner cases', () => {
		test( 'should handle top-left direction', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const coords = renderer.getTailCoordinates( 0, 0, 200, 100, 'top-left', 0.5, 20, 8 );

			expect( coords.tip.y ).toBe( -20 );
			expect( coords.tip.x ).toBeLessThan( 100 );
		} );

		test( 'should handle top-right direction', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const coords = renderer.getTailCoordinates( 0, 0, 200, 100, 'top-right', 0.5, 20, 8 );

			expect( coords.tip.y ).toBe( -20 );
			expect( coords.tip.x ).toBeGreaterThan( 100 );
		} );

		test( 'should clamp tail size to shape dimensions', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Very large tail size should be clamped
			const coords = renderer.getTailCoordinates( 0, 0, 50, 40, 'bottom', 0.5, 200, 8 );

			// Tail size clamped to 80% of min dimension (40 * 0.8 = 32)
			expect( coords.tip.y ).toBeLessThan( 200 );
		} );

		test( 'should handle zero safe zone width', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Very large corner radius relative to width
			const coords = renderer.getTailCoordinates( 0, 0, 20, 100, 'bottom', 0.5, 10, 15 );

			// Should still return valid coordinates
			expect( coords.tip ).toBeDefined();
			expect( coords.base1 ).toBeDefined();
			expect( coords.base2 ).toBeDefined();
		} );

		test( 'should handle zero safe zone height', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Very large corner radius relative to height
			const coords = renderer.getTailCoordinates( 0, 0, 200, 20, 'left', 0.5, 10, 15 );

			// Should still return valid coordinates
			expect( coords.tip ).toBeDefined();
			expect( coords.base1 ).toBeDefined();
			expect( coords.base2 ).toBeDefined();
		} );
	} );

	describe( 'drawCalloutPath with all tail directions', () => {
		test( 'should draw rounded path with left tail', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'left', 0.5, 20 );

			expect( ctx.arc ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		test( 'should draw rounded path with right tail', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'right', 0.5, 20 );

			expect( ctx.arc ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		test( 'should draw rounded path with top tail', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'top', 0.5, 20 );

			expect( ctx.arc ).toHaveBeenCalled();
		} );

		test( 'should draw rounded path with bottom-left tail', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'bottom-left', 0.5, 20 );

			expect( ctx.arc ).toHaveBeenCalled();
		} );

		test( 'should draw rounded path with bottom-right tail', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'bottom-right', 0.5, 20 );

			expect( ctx.arc ).toHaveBeenCalled();
		} );

		test( 'should draw rounded path with top-left tail', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'top-left', 0.5, 20 );

			expect( ctx.arc ).toHaveBeenCalled();
		} );

		test( 'should draw rounded path with top-right tail', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'top-right', 0.5, 20 );

			expect( ctx.arc ).toHaveBeenCalled();
		} );
	} );

	describe( 'tail styles', () => {
		test( 'should draw triangle tail style (default)', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'bottom', 0.5, 20, ctx, 'triangle' );

			expect( ctx.lineTo ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		test( 'should draw curved tail style with quadratic curves', () => {
			const ctx = createMockContext();
			ctx.quadraticCurveTo = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'bottom', 0.5, 20, ctx, 'curved' );

			expect( ctx.quadraticCurveTo ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		test( 'should draw line tail style', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'bottom', 0.5, 20, ctx, 'line' );

			expect( ctx.lineTo ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		// Note: 'none' tail style was removed - use textbox layer type if no tail is needed

		test( 'should use tailStyle from layer in draw method', () => {
			const ctx = createMockContext();
			ctx.quadraticCurveTo = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				stroke: '#000000',
				tailStyle: 'curved',
				tailDirection: 'bottom',
				tailSize: 20
			};

			renderer.draw( layer );

			expect( ctx.quadraticCurveTo ).toHaveBeenCalled();
		} );

		test( 'should default to triangle when tailStyle not specified', () => {
			const ctx = createMockContext();
			ctx.quadraticCurveTo = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				stroke: '#000000',
				// no tailStyle specified
				tailDirection: 'bottom',
				tailSize: 20
			};

			renderer.draw( layer );

			// Should NOT use quadraticCurveTo (triangle uses lineTo)
			expect( ctx.quadraticCurveTo ).not.toHaveBeenCalled();
			expect( ctx.lineTo ).toHaveBeenCalled();
		} );

		test( 'should draw curved tail on left direction', () => {
			const ctx = createMockContext();
			ctx.quadraticCurveTo = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'left', 0.5, 20, ctx, 'curved' );

			expect( ctx.quadraticCurveTo ).toHaveBeenCalled();
		} );

		test( 'should draw line tail on top direction', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 10, 'top', 0.5, 20, ctx, 'line' );

			expect( ctx.lineTo ).toHaveBeenCalled();
		} );

		test( 'should draw curved tail with zero corner radius', () => {
			const ctx = createMockContext();
			ctx.quadraticCurveTo = jest.fn();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer.drawCalloutPath( 0, 0, 200, 100, 0, 'bottom', 0.5, 20, ctx, 'curved' );

			expect( ctx.quadraticCurveTo ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
		} );
	} );

	describe( 'fill none handling', () => {
		test( 'should not fill when fill is "none"', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: 'none',
				stroke: '#000000'
			};

			renderer.draw( layer );
			// fill() should not be called
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		test( 'should not stroke when stroke is "none"', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				stroke: 'none'
			};

			renderer.draw( layer );
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'should not stroke when strokeWidth is 0', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				stroke: '#000000',
				strokeWidth: 0
			};

			renderer.draw( layer );
			expect( ctx.fill ).toHaveBeenCalled();
		} );
	} );

	describe( 'clampOpacity edge cases', () => {
		test( 'should handle invalid opacity values', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				fillOpacity: 'invalid',
				strokeOpacity: null
			};

			// Should not throw
			expect( () => renderer.draw( layer ) ).not.toThrow();
		} );

		test( 'should clamp opacity above 1', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				fillOpacity: 5
			};

			renderer.draw( layer );
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'should clamp opacity below 0', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 150,
				height: 80,
				fill: '#ffffff',
				fillOpacity: -0.5
			};

			renderer.draw( layer );
			expect( ctx.fill ).toHaveBeenCalled();
		} );
	} );

	describe( 'hasShadowEnabled with object shadow', () => {
		test( 'should detect shadow as object', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Returns the shadow object which is truthy
			expect( renderer.hasShadowEnabled( { shadow: { color: '#000' } } ) ).toBeTruthy();
		} );

		test( 'should detect shadow as empty object', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Empty object is truthy
			expect( renderer.hasShadowEnabled( { shadow: {} } ) ).toBeTruthy();
		} );
	} );
} );
