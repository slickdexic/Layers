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
			const mwLogError = jest.spyOn( mw.log, 'error' ).mockImplementation( () => {} );
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
			expect( mwLogError ).toHaveBeenCalled();

			mwLogError.mockRestore();
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

	describe( 'getClosestPerimeterPoint', () => {
		test( 'should return bottom edge for tip at center', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Tip at center of rectangle (100, 50, 200, 100)
			// Center is at (200, 100)
			const result = renderer.getClosestPerimeterPoint( 200, 100, 100, 50, 200, 100, 10 );

			expect( result.edge ).toBe( 'bottom' );
			expect( result.baseX ).toBe( 200 );
			expect( result.baseY ).toBe( 150 );
		} );

		test( 'should find closest point on bottom edge', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Rectangle at (0, 0, 100, 50), corner radius 5
			// Tip below the rectangle at (50, 100)
			const result = renderer.getClosestPerimeterPoint( 50, 100, 0, 0, 100, 50, 5 );

			expect( result.edge ).toBe( 'bottom' );
			expect( result.baseX ).toBe( 50 );
			expect( result.baseY ).toBe( 50 );
		} );

		test( 'should find closest point on top edge', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Rectangle at (0, 50, 100, 50), corner radius 5
			// Tip above the rectangle at (50, 0)
			const result = renderer.getClosestPerimeterPoint( 50, 0, 0, 50, 100, 50, 5 );

			expect( result.edge ).toBe( 'top' );
			expect( result.baseX ).toBe( 50 );
			expect( result.baseY ).toBe( 50 );
		} );

		test( 'should find closest point on left edge', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Rectangle at (50, 0, 100, 50), corner radius 5
			// Tip to the left at (0, 25)
			const result = renderer.getClosestPerimeterPoint( 0, 25, 50, 0, 100, 50, 5 );

			expect( result.edge ).toBe( 'left' );
			expect( result.baseX ).toBe( 50 );
			expect( result.baseY ).toBe( 25 );
		} );

		test( 'should find closest point on right edge', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Rectangle at (0, 0, 100, 50), corner radius 5
			// Tip to the right at (200, 25)
			const result = renderer.getClosestPerimeterPoint( 200, 25, 0, 0, 100, 50, 5 );

			expect( result.edge ).toBe( 'right' );
			expect( result.baseX ).toBe( 100 );
			expect( result.baseY ).toBe( 25 );
		} );

		test( 'should handle corner arcs with significant radius', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Rectangle at (0, 0, 100, 100), corner radius 20
			// Tip near bottom-right corner
			const result = renderer.getClosestPerimeterPoint( 110, 110, 0, 0, 100, 100, 20 );

			// Should find closest point on corner arc
			expect( result.edge ).toBe( 'br' );
			expect( result.baseX ).toBeGreaterThan( 80 );
			expect( result.baseY ).toBeGreaterThan( 80 );
		} );

		test( 'should handle corner with tip near top-left', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Rectangle at (0, 0, 100, 100), corner radius 20
			// Tip near top-left corner
			const result = renderer.getClosestPerimeterPoint( -20, -20, 0, 0, 100, 100, 20 );

			// Should find closest point on tl corner arc
			expect( result.edge ).toBe( 'tl' );
		} );

		test( 'should handle corner with tip near top-right', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Rectangle at (0, 0, 100, 100), corner radius 20
			// Tip near top-right corner
			const result = renderer.getClosestPerimeterPoint( 120, -20, 0, 0, 100, 100, 20 );

			expect( result.edge ).toBe( 'tr' );
		} );

		test( 'should handle corner with tip near bottom-left', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Rectangle at (0, 0, 100, 100), corner radius 20
			// Tip near bottom-left corner
			const result = renderer.getClosestPerimeterPoint( -20, 120, 0, 0, 100, 100, 20 );

			expect( result.edge ).toBe( 'bl' );
		} );

		test( 'should handle zero corner radius', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Rectangle with no rounded corners
			const result = renderer.getClosestPerimeterPoint( 150, 150, 0, 0, 100, 100, 0 );

			// Should find closest edge point
			expect( [ 'bottom', 'right' ] ).toContain( result.edge );
		} );

		test( 'should handle very large corner radius', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Corner radius larger than half the dimensions (will be clamped)
			const result = renderer.getClosestPerimeterPoint( 50, 200, 0, 0, 100, 100, 100 );

			expect( result ).toBeDefined();
			expect( result.baseY ).toBeLessThanOrEqual( 100 );
		} );

		test( 'should skip degenerate edges', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Very small rectangle where corner radius fills entire edges
			const result = renderer.getClosestPerimeterPoint( 50, 100, 0, 0, 20, 20, 10 );

			expect( result ).toBeDefined();
		} );

		test( 'should return tangent vectors for corners', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const result = renderer.getClosestPerimeterPoint( 110, 110, 0, 0, 100, 100, 20 );

			// Corners should have tangent vectors
			expect( result.tangentX ).toBeDefined();
			expect( result.tangentY ).toBeDefined();
		} );
	} );

	describe( 'getTailFromTipPosition', () => {
		test( 'should calculate tail for tip below rectangle', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const result = renderer.getTailFromTipPosition( 0, 0, 200, 100, 100, 200, 10 );

			expect( result.edge ).toBe( 'bottom' );
			expect( result.tip ).toBeDefined();
			expect( result.base1 ).toBeDefined();
			expect( result.base2 ).toBeDefined();
		} );

		test( 'should calculate tail for tip to the right', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const result = renderer.getTailFromTipPosition( 0, 0, 100, 200, 200, 100, 10 );

			expect( result.edge ).toBe( 'right' );
		} );

		test( 'should calculate tail for tip above rectangle', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const result = renderer.getTailFromTipPosition( 0, 100, 200, 100, 100, -50, 10 );

			expect( result.edge ).toBe( 'top' );
		} );

		test( 'should calculate tail for tip to the left', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			const result = renderer.getTailFromTipPosition( 100, 0, 100, 200, -50, 100, 10 );

			expect( result.edge ).toBe( 'left' );
		} );

		test( 'should handle corner attachment', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Large corner radius, tip near corner
			const result = renderer.getTailFromTipPosition( 0, 0, 100, 100, 130, 130, 20 );

			// Should attach to bottom-right corner
			expect( result.edge ).toBe( 'br' );
		} );

		test( 'should scale base width with distance', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Short distance tail
			const shortResult = renderer.getTailFromTipPosition( 0, 0, 200, 100, 100, 120, 10 );

			// Long distance tail
			const longResult = renderer.getTailFromTipPosition( 0, 0, 200, 100, 100, 300, 10 );

			// Base1 and base2 define the base width
			const shortWidth = Math.abs( shortResult.base1.x - shortResult.base2.x ) +
				Math.abs( shortResult.base1.y - shortResult.base2.y );
			const longWidth = Math.abs( longResult.base1.x - longResult.base2.x ) +
				Math.abs( longResult.base1.y - longResult.base2.y );

			// Long tail should have wider base (up to cap)
			expect( longWidth ).toBeGreaterThanOrEqual( shortWidth );
		} );

		test( 'should handle all corner positions', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Top-left corner
			const tlResult = renderer.getTailFromTipPosition( 0, 0, 100, 100, -30, -30, 20 );
			expect( tlResult.edge ).toBe( 'tl' );

			// Top-right corner
			const trResult = renderer.getTailFromTipPosition( 0, 0, 100, 100, 130, -30, 20 );
			expect( trResult.edge ).toBe( 'tr' );

			// Bottom-left corner
			const blResult = renderer.getTailFromTipPosition( 0, 0, 100, 100, -30, 130, 20 );
			expect( blResult.edge ).toBe( 'bl' );
		} );
	} );

	describe( '_getEdgeBeforeCorner and _getEdgeAfterCorner', () => {
		test( 'should return correct edge before top-left corner', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer._getEdgeBeforeCorner( 'tl' ) ).toBe( 'left' );
		} );

		test( 'should return correct edge before top-right corner', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer._getEdgeBeforeCorner( 'tr' ) ).toBe( 'top' );
		} );

		test( 'should return correct edge before bottom-right corner', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer._getEdgeBeforeCorner( 'br' ) ).toBe( 'right' );
		} );

		test( 'should return correct edge before bottom-left corner', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer._getEdgeBeforeCorner( 'bl' ) ).toBe( 'bottom' );
		} );

		test( 'should return default edge for unknown corner', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer._getEdgeBeforeCorner( 'invalid' ) ).toBe( 'top' );
		} );

		test( 'should return correct edge after top-left corner', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer._getEdgeAfterCorner( 'tl' ) ).toBe( 'top' );
		} );

		test( 'should return correct edge after top-right corner', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer._getEdgeAfterCorner( 'tr' ) ).toBe( 'right' );
		} );

		test( 'should return correct edge after bottom-right corner', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer._getEdgeAfterCorner( 'br' ) ).toBe( 'bottom' );
		} );

		test( 'should return correct edge after bottom-left corner', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer._getEdgeAfterCorner( 'bl' ) ).toBe( 'left' );
		} );

		test( 'should return default edge for unknown corner in _getEdgeAfterCorner', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			expect( renderer._getEdgeAfterCorner( 'invalid' ) ).toBe( 'bottom' );
		} );
	} );

	describe( '_drawRoundedRect', () => {
		test( 'should draw rounded rectangle path', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer._drawRoundedRect( ctx, 0, 0, 100, 50, 10 );

			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalled();
			expect( ctx.arcTo ).toHaveBeenCalledTimes( 4 );
			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		test( 'should handle zero radius', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			renderer._drawRoundedRect( ctx, 0, 0, 100, 50, 0 );

			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		test( 'should clamp radius to half of minimum dimension', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Radius larger than half the height (25)
			renderer._drawRoundedRect( ctx, 0, 0, 100, 50, 100 );

			// Should not throw and should still create path
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.arcTo ).toHaveBeenCalled();
		} );
	} );

	describe( 'drawCalloutPath with tip position', () => {
		test( 'should draw callout with custom tip position', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Draw callout with custom tip position
			renderer.drawCalloutPath(
				0, 0, 200, 100, 10,
				null, null, 20, ctx,
				'triangle', 100, 200 // tipX, tipY
			);

			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalled();
		} );

		test( 'should handle tip position at each edge', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Tip below (bottom edge)
			renderer.drawCalloutPath( 0, 0, 100, 100, 10, null, null, 20, ctx, 'triangle', 50, 150 );
			expect( ctx.beginPath ).toHaveBeenCalled();

			jest.clearAllMocks();

			// Tip above (top edge)
			renderer.drawCalloutPath( 0, 100, 100, 100, 10, null, null, 20, ctx, 'triangle', 50, 0 );
			expect( ctx.beginPath ).toHaveBeenCalled();

			jest.clearAllMocks();

			// Tip to right (right edge)
			renderer.drawCalloutPath( 0, 0, 100, 100, 10, null, null, 20, ctx, 'triangle', 150, 50 );
			expect( ctx.beginPath ).toHaveBeenCalled();

			jest.clearAllMocks();

			// Tip to left (left edge)
			renderer.drawCalloutPath( 50, 0, 100, 100, 10, null, null, 20, ctx, 'triangle', 0, 50 );
			expect( ctx.beginPath ).toHaveBeenCalled();
		} );

		test( 'should handle tip position at corners', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx );

			// Tip at bottom-right corner
			renderer.drawCalloutPath( 0, 0, 100, 100, 20, null, null, 20, ctx, 'triangle', 130, 130 );
			expect( ctx.beginPath ).toHaveBeenCalled();

			jest.clearAllMocks();

			// Tip at top-left corner
			renderer.drawCalloutPath( 0, 0, 100, 100, 20, null, null, 20, ctx, 'triangle', -30, -30 );
			expect( ctx.beginPath ).toHaveBeenCalled();
		} );
	} );

	describe( 'draw with tailTipX/tailTipY', () => {
		test( 'should render callout with custom tail tip position', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx, {
				shadowRenderer: mockShadowRenderer,
				effectsRenderer: mockEffectsRenderer
			} );

			const layer = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 200,
				height: 100,
				cornerRadius: 10,
				tailSize: 20,
				tailStyle: 'triangle',
				tailTipX: 150, // Custom tip position
				tailTipY: 250,
				fill: '#ffffff'
			};

			renderer.draw( layer, { scale: 1 } );

			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		test( 'should handle tailTipX/tailTipY with all corners', () => {
			const ctx = createMockContext();
			const renderer = new window.Layers.CalloutRenderer( ctx, {
				shadowRenderer: mockShadowRenderer
			} );

			// Test tip near each corner
			const corners = [
				{ tipX: -30, tipY: -30 }, // near top-left
				{ tipX: 230, tipY: -30 }, // near top-right
				{ tipX: 230, tipY: 230 }, // near bottom-right
				{ tipX: -30, tipY: 230 } // near bottom-left
			];

			for ( const corner of corners ) {
				jest.clearAllMocks();
				const layer = {
					type: 'callout',
					x: 50,
					y: 50,
					width: 200,
					height: 100,
					cornerRadius: 20,
					tailSize: 20,
					tailStyle: 'triangle',
					tailTipX: corner.tipX,
					tailTipY: corner.tipY,
					fill: '#ffffff'
				};

				renderer.draw( layer, { scale: 1 } );
				expect( ctx.beginPath ).toHaveBeenCalled();
			}
		} );
	} );
} );
