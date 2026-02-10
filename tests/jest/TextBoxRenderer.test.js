/**
 * Tests for TextBoxRenderer module
 *
 * TextBoxRenderer handles rendering of text box shapes:
 * - Rectangle container with rounded corners
 * - Multi-line text with word wrapping
 * - Text alignment (horizontal and vertical)
 * - Text stroke and shadow effects
 *
 * @jest-environment jsdom
 */

'use strict';

// Load the module
const TextBoxRenderer = require( '../../resources/ext.layers.shared/TextBoxRenderer.js' );

// Mock canvas context with all required methods
function createMockContext() {
	return {
		save: jest.fn(),
		restore: jest.fn(),
		fillText: jest.fn(),
		strokeText: jest.fn(),
		measureText: jest.fn( ( text ) => ( { width: text.length * 8 } ) ),
		translate: jest.fn(),
		rotate: jest.fn(),
		beginPath: jest.fn(),
		rect: jest.fn(),
		roundRect: jest.fn(),
		moveTo: jest.fn(),
		lineTo: jest.fn(),
		arcTo: jest.fn(),
		closePath: jest.fn(),
		fill: jest.fn(),
		stroke: jest.fn(),
		clip: jest.fn(),
		fillRect: jest.fn(),
		font: '',
		textAlign: 'left',
		textBaseline: 'top',
		fillStyle: '#000000',
		strokeStyle: '#000000',
		lineWidth: 1,
		lineJoin: 'miter',
		miterLimit: 10,
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
		clearShadow: jest.fn(),
		drawSpreadShadow: jest.fn(),
		drawSpreadShadowStroke: jest.fn()
	};
}

describe( 'TextBoxRenderer', () => {
	let ctx;
	let renderer;

	beforeEach( () => {
		ctx = createMockContext();
		renderer = new TextBoxRenderer( ctx );
	} );

	afterEach( () => {
		if ( renderer ) {
			renderer.destroy();
		}
	} );

	// ========================================================================
	// Constructor and Configuration Tests
	// ========================================================================

	describe( 'constructor', () => {
		it( 'should create instance with context', () => {
			expect( renderer ).toBeInstanceOf( TextBoxRenderer );
			expect( renderer.ctx ).toBe( ctx );
		} );

		it( 'should accept shadow renderer config', () => {
			const shadowRenderer = createMockShadowRenderer();
			const r = new TextBoxRenderer( ctx, { shadowRenderer } );
			expect( r.shadowRenderer ).toBe( shadowRenderer );
			r.destroy();
		} );

		it( 'should handle missing config', () => {
			const r = new TextBoxRenderer( ctx );
			expect( r.shadowRenderer ).toBe( null );
			r.destroy();
		} );

		it( 'should handle empty config object', () => {
			const r = new TextBoxRenderer( ctx, {} );
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

	// ========================================================================
	// Shadow Helper Tests
	// ========================================================================

	describe( 'shadow helpers', () => {
		describe( 'clearShadow', () => {
			it( 'should delegate to shadowRenderer if available', () => {
				const shadowRenderer = createMockShadowRenderer();
				renderer.setShadowRenderer( shadowRenderer );
				renderer.clearShadow();
				expect( shadowRenderer.clearShadow ).toHaveBeenCalled();
			} );

			it( 'should clear shadow manually without shadowRenderer', () => {
				renderer.clearShadow();
				expect( ctx.shadowColor ).toBe( 'transparent' );
				expect( ctx.shadowBlur ).toBe( 0 );
				expect( ctx.shadowOffsetX ).toBe( 0 );
				expect( ctx.shadowOffsetY ).toBe( 0 );
			} );
		} );

		describe( 'hasShadowEnabled', () => {
			it( 'should delegate to shadowRenderer if available', () => {
				const shadowRenderer = createMockShadowRenderer();
				renderer.setShadowRenderer( shadowRenderer );
				const layer = { shadow: true };
				renderer.hasShadowEnabled( layer );
				expect( shadowRenderer.hasShadowEnabled ).toHaveBeenCalledWith( layer );
			} );

			it( 'should check layer.shadow directly without shadowRenderer', () => {
				expect( renderer.hasShadowEnabled( { shadow: true } ) ).toBe( true );
				expect( renderer.hasShadowEnabled( { shadow: 'true' } ) ).toBe( true );
				expect( renderer.hasShadowEnabled( { shadow: 1 } ) ).toBe( true );
				expect( renderer.hasShadowEnabled( { shadow: '1' } ) ).toBe( true );
				expect( !!renderer.hasShadowEnabled( { shadow: {} } ) ).toBe( true );
				expect( renderer.hasShadowEnabled( { shadow: false } ) ).toBe( false );
				expect( renderer.hasShadowEnabled( {} ) ).toBe( false );
			} );
		} );

		describe( 'getShadowSpread', () => {
			it( 'should delegate to shadowRenderer if available', () => {
				const shadowRenderer = createMockShadowRenderer();
				renderer.setShadowRenderer( shadowRenderer );
				const layer = { shadow: true, shadowSpread: 5 };
				const scale = { avg: 2 };
				renderer.getShadowSpread( layer, scale );
				expect( shadowRenderer.getShadowSpread ).toHaveBeenCalledWith( layer, scale );
			} );

			it( 'should calculate spread without shadowRenderer', () => {
				const layer = { shadow: true, shadowSpread: 5 };
				const scale = { avg: 2 };
				expect( renderer.getShadowSpread( layer, scale ) ).toBe( 10 );
			} );

			it( 'should return 0 if shadow not enabled', () => {
				const layer = { shadow: false, shadowSpread: 5 };
				const scale = { avg: 2 };
				expect( renderer.getShadowSpread( layer, scale ) ).toBe( 0 );
			} );
		} );
	} );

	// ========================================================================
	// drawRoundedRectPath Tests
	// ========================================================================

	describe( 'drawRoundedRectPath', () => {
		it( 'should draw a rounded rectangle path', () => {
			renderer.drawRoundedRectPath( 10, 20, 100, 50, 5 );
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalled();
			expect( ctx.lineTo ).toHaveBeenCalled();
			expect( ctx.arcTo ).toHaveBeenCalled();
			expect( ctx.closePath ).toHaveBeenCalled();
		} );

		it( 'should use provided context if specified', () => {
			const otherCtx = createMockContext();
			renderer.drawRoundedRectPath( 10, 20, 100, 50, 5, otherCtx );
			expect( otherCtx.beginPath ).toHaveBeenCalled();
			expect( ctx.beginPath ).not.toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// wrapText Tests
	// ========================================================================

	describe( 'wrapText', () => {
		it( 'should return array of wrapped lines', () => {
			const lines = renderer.wrapText( 'Hello world', 1000, 16, 'Arial' );
			expect( Array.isArray( lines ) ).toBe( true );
			expect( lines.length ).toBeGreaterThan( 0 );
		} );

		it( 'should wrap long text into multiple lines', () => {
			// With our mock measureText (8px per char), 100px width fits ~12 chars
			const lines = renderer.wrapText( 'This is a very long text that needs wrapping', 100, 16, 'Arial' );
			expect( lines.length ).toBeGreaterThan( 1 );
		} );

		it( 'should preserve empty lines from newlines', () => {
			const lines = renderer.wrapText( 'Line1\n\nLine3', 1000, 16, 'Arial' );
			expect( lines ).toContain( '' );
			expect( lines.length ).toBe( 3 );
		} );

		it( 'should handle newlines in text', () => {
			const lines = renderer.wrapText( 'Line1\nLine2\nLine3', 1000, 16, 'Arial' );
			expect( lines.length ).toBe( 3 );
			expect( lines[ 0 ] ).toBe( 'Line1' );
			expect( lines[ 1 ] ).toBe( 'Line2' );
			expect( lines[ 2 ] ).toBe( 'Line3' );
		} );

		it( 'should apply font weight and style', () => {
			renderer.wrapText( 'Test', 100, 16, 'Arial', 'bold', 'italic' );
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should return at least one line for empty text', () => {
			const lines = renderer.wrapText( '', 100, 16, 'Arial' );
			expect( lines.length ).toBeGreaterThanOrEqual( 1 );
		} );

		it( 'should handle single word that exceeds width', () => {
			// A single long word should still appear (not be dropped)
			const lines = renderer.wrapText( 'Supercalifragilisticexpialidocious', 50, 16, 'Arial' );
			expect( lines.length ).toBeGreaterThanOrEqual( 1 );
			expect( lines.join( '' ) ).toContain( 'Supercalifragilisticexpialidocious' );
		} );

		it( 'should break long words character-by-character (P2-019)', () => {
			// Mock: 8px per char, maxWidth=48px fits 6 chars
			// 'abcdefghijklmnop' = 16 chars = 128px, should break into 3+ lines
			const lines = renderer.wrapText( 'abcdefghijklmnop', 48, 16, 'Arial' );
			expect( lines.length ).toBeGreaterThan( 1 );
			// All characters should be preserved across all lines
			expect( lines.join( '' ) ).toBe( 'abcdefghijklmnop' );
			// Each line (except possibly the last) should fit within maxWidth
			for ( let i = 0; i < lines.length - 1; i++ ) {
				expect( lines[ i ].length ).toBeLessThanOrEqual( 6 );
			}
		} );

		it( 'should break long URL words in mixed text (P2-019)', () => {
			// 'See https://example.com/very/long/path end' with 80px (10 chars)
			const lines = renderer.wrapText(
				'See https://example.com/very/long/path end', 80, 16, 'Arial'
			);
			// All chars preserved (join without separator since breaks are mid-word)
			const allText = lines.join( '' );
			expect( allText ).toContain( 'https://example.com/very/long/path' );
			// The URL should be broken across multiple lines
			expect( lines.length ).toBeGreaterThan( 2 );
		} );
	} );

	// ========================================================================
	// wrapRichText Tests (P1-014)
	// ========================================================================

	describe( 'wrapRichText', () => {
		it( 'should return empty line for empty input', () => {
			const lines = renderer.wrapRichText( [], 100, { fontSize: 16, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal' }, { avg: 1 } );
			expect( lines ).toEqual( [ '' ] );
		} );

		it( 'should wrap simple single-run text', () => {
			// Mock: 8px per char, maxWidth=80 fits 10 chars
			const richText = [ { text: 'Hello world from rich text' } ];
			const baseStyle = { fontSize: 16, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal' };
			const lines = renderer.wrapRichText( richText, 80, baseStyle, { avg: 1 } );
			expect( lines.length ).toBeGreaterThan( 1 );
			expect( lines.join( '' ).replace( /\s/g, '' ) ).toBe( 'Helloworldfromrichtext' );
		} );

		it( 'should handle newlines in runs', () => {
			const richText = [ { text: 'Line1\nLine2' } ];
			const baseStyle = { fontSize: 16, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal' };
			const lines = renderer.wrapRichText( richText, 1000, baseStyle, { avg: 1 } );
			expect( lines.length ).toBe( 2 );
			expect( lines[ 0 ] ).toBe( 'Line1' );
			expect( lines[ 1 ] ).toBe( 'Line2' );
		} );

		it( 'should use per-run font size for measurement (P1-014)', () => {
			// Two runs: first at base size (16px→8px/char), second at double (32px→16px/char)
			// The mock measureText returns text.length * 8 regardless of font,
			// so we verify the method sets ctx.font correctly per-run
			const richText = [
				{ text: 'Small ' },
				{ text: 'BIG', style: { fontSize: 32 } }
			];
			const baseStyle = { fontSize: 16, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal' };
			const lines = renderer.wrapRichText( richText, 1000, baseStyle, { avg: 1 } );
			// Just verify font was set at least twice (once per distinct run)
			expect( ctx.font ).toContain( '32px' );
			// All text preserved
			expect( lines.join( '' ).replace( /\s/g, '' ) ).toBe( 'SmallBIG' );
		} );

		it( 'should break long words in rich text (P1-014)', () => {
			const richText = [ { text: 'abcdefghijklmnop' } ];
			const baseStyle = { fontSize: 16, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal' };
			// 48px maxWidth, 8px/char = 6 chars per line
			const lines = renderer.wrapRichText( richText, 48, baseStyle, { avg: 1 } );
			expect( lines.length ).toBeGreaterThan( 1 );
			expect( lines.join( '' ) ).toBe( 'abcdefghijklmnop' );
		} );
	} );

	// ========================================================================
	// draw() Method Tests
	// ========================================================================

	describe( 'draw', () => {
		it( 'should save and restore context', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				text: 'Hello'
			};
			renderer.draw( layer );
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should draw basic text box with fill', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				text: 'Test'
			};
			renderer.draw( layer );
			expect( ctx.fill ).toHaveBeenCalled();
			// fillStyle is set then overwritten for text; verify fill was called
		} );

		it( 'should draw text box with stroke', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				stroke: '#0000ff',
				strokeWidth: 2,
				text: 'Test'
			};
			renderer.draw( layer );
			expect( ctx.stroke ).toHaveBeenCalled();
			expect( ctx.strokeStyle ).toBe( '#0000ff' );
		} );

		it( 'should draw text inside the box', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				text: 'Hello World'
			};
			renderer.draw( layer );
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		it( 'should skip text rendering if no text', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000'
			};
			renderer.draw( layer );
			expect( ctx.fillText ).not.toHaveBeenCalled();
		} );

		it( 'should apply corner radius when specified', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				cornerRadius: 10,
				fill: '#ff0000',
				text: 'Test'
			};
			renderer.draw( layer );
			// Should use roundRect if available
			expect( ctx.roundRect ).toHaveBeenCalled();
		} );

		it( 'should apply rotation when specified', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				rotation: 45,
				fill: '#ff0000',
				text: 'Test'
			};
			renderer.draw( layer );
			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		it( 'should clamp corner radius to half of smallest dimension', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 40,
				cornerRadius: 50, // Would be clamped to 20 (half of 40)
				fill: '#ff0000',
				text: 'Test'
			};
			renderer.draw( layer );
			// Should still render without error
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should apply opacity correctly', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				opacity: 0.5,
				fill: '#ff0000',
				text: 'Test'
			};
			renderer.draw( layer );
			expect( ctx.globalAlpha ).toBe( 0.5 );
		} );

		it( 'should use scale options if provided', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				stroke: '#0000ff',
				strokeWidth: 2,
				fill: '#ff0000',
				text: 'Test'
			};
			renderer.draw( layer, { scale: { sx: 2, sy: 2, avg: 2 } } );
			// strokeWidth should be scaled - verify stroke was called
			expect( ctx.stroke ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Text Alignment Tests
	// ========================================================================

	describe( 'text alignment', () => {
		it( 'should apply left text alignment', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				textAlign: 'left',
				text: 'Test'
			};
			renderer.draw( layer );
			expect( ctx.textAlign ).toBe( 'left' );
		} );

		it( 'should apply center text alignment', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				textAlign: 'center',
				text: 'Test'
			};
			renderer.draw( layer );
			expect( ctx.textAlign ).toBe( 'center' );
		} );

		it( 'should apply right text alignment', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				textAlign: 'right',
				text: 'Test'
			};
			renderer.draw( layer );
			expect( ctx.textAlign ).toBe( 'right' );
		} );
	} );

	// ========================================================================
	// Text Effects Tests
	// ========================================================================

	describe( 'text effects', () => {
		it( 'should apply text stroke when specified', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				text: 'Test',
				textStrokeWidth: 2,
				textStrokeColor: '#000000'
			};
			renderer.draw( layer );
			expect( ctx.strokeText ).toHaveBeenCalled();
		} );

		it( 'should apply text shadow when enabled', () => {
			// Track shadow color history to verify it's set before fillText
			const shadowColorHistory = [];
			let shadowColorWhenFillTextCalled = null;
			const originalFillText = ctx.fillText;

			Object.defineProperty( ctx, 'shadowColor', {
				get: function () {
					return this._shadowColor || '';
				},
				set: function ( value ) {
					shadowColorHistory.push( value );
					this._shadowColor = value;
				},
				configurable: true
			} );

			ctx.fillText = jest.fn( () => {
				shadowColorWhenFillTextCalled = ctx.shadowColor;
			} );

			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				text: 'Test',
				textShadow: true,
				textShadowColor: 'rgba(255,0,0,0.8)',
				textShadowBlur: 4
			};
			renderer.draw( layer );

			// Verify fillText was called
			expect( ctx.fillText ).toHaveBeenCalled();

			// Verify shadow color was set to the layer's textShadowColor
			expect( shadowColorHistory ).toContain( 'rgba(255,0,0,0.8)' );

			// Most importantly: verify shadow was set WHEN fillText was called
			expect( shadowColorWhenFillTextCalled ).toBe( 'rgba(255,0,0,0.8)' );
		} );

		it( 'should apply font styling', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				text: 'Test',
				fontSize: 24,
				fontFamily: 'Georgia',
				fontWeight: 'bold',
				fontStyle: 'italic'
			};
			renderer.draw( layer );
			expect( ctx.font ).toContain( 'italic' );
			expect( ctx.font ).toContain( 'bold' );
			expect( ctx.font ).toContain( '24' );
			expect( ctx.font ).toContain( 'Georgia' );
		} );

		it( 'should apply text color', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				text: 'Test',
				color: '#ff6600'
			};
			renderer.draw( layer );
			// Text fillStyle should be set to color
			expect( ctx.fillText ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Shadow Tests
	// ========================================================================

	describe( 'box shadow', () => {
		it( 'should draw shadow when enabled', () => {
			const shadowRenderer = createMockShadowRenderer();
			renderer.setShadowRenderer( shadowRenderer );

			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				shadow: true,
				text: 'Test'
			};
			renderer.draw( layer );
			expect( shadowRenderer.hasShadowEnabled ).toHaveBeenCalled();
		} );

		it( 'should draw spread shadow when shadowSpread > 0', () => {
			const shadowRenderer = createMockShadowRenderer();
			shadowRenderer.getShadowSpread.mockReturnValue( 5 );
			renderer.setShadowRenderer( shadowRenderer );

			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				shadow: true,
				shadowSpread: 5,
				text: 'Test'
			};
			renderer.draw( layer );
			expect( shadowRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Edge Cases
	// ========================================================================

	describe( 'edge cases', () => {
		it( 'should handle layer with zero dimensions', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 0,
				height: 0,
				fill: '#ff0000',
				text: 'Test'
			};
			expect( () => renderer.draw( layer ) ).not.toThrow();
		} );

		it( 'should handle layer with negative dimensions', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: -100,
				height: -50,
				fill: '#ff0000',
				text: 'Test'
			};
			expect( () => renderer.draw( layer ) ).not.toThrow();
		} );

		it( 'should handle missing optional properties', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50
			};
			expect( () => renderer.draw( layer ) ).not.toThrow();
		} );

		it( 'should handle empty options object', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				text: 'Test'
			};
			expect( () => renderer.draw( layer, {} ) ).not.toThrow();
		} );

		it( 'should handle browser without roundRect', () => {
			delete ctx.roundRect;
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				cornerRadius: 10,
				fill: '#ff0000',
				text: 'Test'
			};
			// Should fall back to drawRoundedRectPath
			expect( () => renderer.draw( layer ) ).not.toThrow();
			expect( ctx.arcTo ).toHaveBeenCalled();
		} );

		it( 'should handle transparent fill', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: 'transparent',
				text: 'Test'
			};
			renderer.draw( layer );
			// fill should not be called for transparent fill
			expect( ctx.fill ).not.toHaveBeenCalled();
		} );

		it( 'should handle fill value of none', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: 'none',
				text: 'Test'
			};
			renderer.draw( layer );
			expect( ctx.fill ).not.toHaveBeenCalled();
		} );

		it( 'should handle zero opacity for fill', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				fillOpacity: 0,
				text: 'Test'
			};
			renderer.draw( layer );
			expect( ctx.fill ).not.toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Shadow Delegation Tests
	// ========================================================================

	describe( 'drawSpreadShadow', () => {
		it( 'should delegate to shadowRenderer when available', () => {
			const mockShadowRenderer = {
				drawSpreadShadow: jest.fn()
			};
			renderer.shadowRenderer = mockShadowRenderer;

			const layer = { shadow: true };
			const scale = { x: 1, y: 1, avg: 1 };
			const spread = 5;
			const drawFn = jest.fn();
			const opacity = 0.8;

			renderer.drawSpreadShadow( layer, scale, spread, drawFn, opacity );

			expect( mockShadowRenderer.drawSpreadShadow ).toHaveBeenCalledWith( layer, scale, spread, drawFn, opacity );
		} );

		it( 'should do nothing when shadowRenderer is not available', () => {
			renderer.shadowRenderer = null;

			// Should not throw
			expect( () => renderer.drawSpreadShadow( {}, {}, 5, jest.fn(), 1 ) ).not.toThrow();
		} );
	} );

	describe( 'drawSpreadShadowStroke', () => {
		it( 'should delegate to shadowRenderer when available', () => {
			const mockShadowRenderer = {
				drawSpreadShadowStroke: jest.fn()
			};
			renderer.shadowRenderer = mockShadowRenderer;

			const layer = { shadow: true };
			const scale = { x: 1, y: 1, avg: 1 };
			const strokeWidth = 3;
			const drawFn = jest.fn();
			const opacity = 0.9;

			renderer.drawSpreadShadowStroke( layer, scale, strokeWidth, drawFn, opacity );

			expect( mockShadowRenderer.drawSpreadShadowStroke ).toHaveBeenCalledWith( layer, scale, strokeWidth, drawFn, opacity );
		} );

		it( 'should do nothing when shadowRenderer is not available', () => {
			renderer.shadowRenderer = null;

			// Should not throw
			expect( () => renderer.drawSpreadShadowStroke( {}, {}, 3, jest.fn(), 1 ) ).not.toThrow();
		} );
	} );

	describe( 'stroke shadow rendering', () => {
		it( 'should draw stroke shadow with spread when enabled', () => {
			const mockShadowRenderer = {
				hasShadowEnabled: jest.fn().mockReturnValue( true ),
				getShadowSpread: jest.fn().mockReturnValue( 5 ),
				drawSpreadShadow: jest.fn(),
				drawSpreadShadowStroke: jest.fn(),
				clearShadow: jest.fn()
			};
			renderer.shadowRenderer = mockShadowRenderer;

			const layer = {
				type: 'textbox',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				stroke: '#0000ff',
				fill: 'transparent',
				strokeWidth: 2,
				text: 'Test',
				shadow: true,
				shadowSpread: 5
			};

			renderer.draw( layer );

			expect( mockShadowRenderer.drawSpreadShadowStroke ).toHaveBeenCalled();
		} );

		it( 'should draw both fill and stroke shadows when both present', () => {
			const mockShadowRenderer = {
				hasShadowEnabled: jest.fn().mockReturnValue( true ),
				getShadowSpread: jest.fn().mockReturnValue( 3 ),
				drawSpreadShadow: jest.fn(),
				drawSpreadShadowStroke: jest.fn(),
				clearShadow: jest.fn()
			};
			renderer.shadowRenderer = mockShadowRenderer;

			const layer = {
				type: 'textbox',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ff0000',
				stroke: '#0000ff',
				strokeWidth: 2,
				text: 'Test',
				shadow: true,
				shadowSpread: 3
			};

			renderer.draw( layer );

			expect( mockShadowRenderer.drawSpreadShadow ).toHaveBeenCalled();
			expect( mockShadowRenderer.drawSpreadShadowStroke ).toHaveBeenCalled();
		} );
	} );

	describe( 'vertical alignment', () => {
		it( 'should apply middle vertical alignment', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 10,
				width: 100,
				height: 80,
				fill: '#ffffff',
				text: 'Test',
				verticalAlign: 'middle'
			};

			renderer.draw( layer );

			// Check that fillText was called (text was rendered with middle alignment)
			expect( ctx.fillText ).toHaveBeenCalled();
		} );

		it( 'should apply bottom vertical alignment', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 10,
				width: 100,
				height: 80,
				fill: '#ffffff',
				text: 'Test',
				verticalAlign: 'bottom'
			};

			renderer.draw( layer );

			expect( ctx.fillText ).toHaveBeenCalled();
		} );
	} );

	describe( 'text stroke with shadow', () => {
		it( 'should temporarily disable shadow for text stroke', () => {
			// Track shadowColor changes
			let shadowColorHistory = [];
			Object.defineProperty( ctx, 'shadowColor', {
				get: function() { return this._shadowColor || 'transparent'; },
				set: function( val ) {
					shadowColorHistory.push( val );
					this._shadowColor = val;
				},
				configurable: true
			} );

			const layer = {
				type: 'textbox',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ffffff',
				text: 'Test',
				textStrokeWidth: 2,
				textStrokeColor: '#000000',
				textShadow: true,
				textShadowColor: '#333333'
			};

			renderer.draw( layer );

			// Should have set shadow color to transparent during stroke
			expect( shadowColorHistory ).toContain( 'transparent' );
			expect( ctx.strokeText ).toHaveBeenCalled();
		} );
	} );

	describe( 'text clipping to box', () => {
		it( 'should not draw text that exceeds box height', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 10,
				width: 100,
				height: 20, // Very small height
				fill: '#ffffff',
				text: 'Line 1\nLine 2\nLine 3\nLine 4', // Many lines
				fontSize: 16,
				padding: 2
			};

			const fillTextCalls = [];
			ctx.fillText = jest.fn( ( text, x, y ) => fillTextCalls.push( { text, x, y } ) );

			renderer.draw( layer );

			// With small height, not all lines should be drawn
			// Box height 20 - padding*2 (4) = 16 available, with fontSize 16 only 1 line fits
			expect( fillTextCalls.length ).toBeLessThanOrEqual( 2 );
		} );
	} );

	// ========================================================================
	// Blur Fill Tests
	// ========================================================================

	describe( 'blur fill', () => {
		it( 'should call effectsRenderer.drawBlurFill when fill is blur', () => {
			const mockEffectsRenderer = {
				drawBlurFill: jest.fn()
			};
			renderer.setEffectsRenderer( mockEffectsRenderer );

			const layer = {
				type: 'textbox',
				x: 50,
				y: 50,
				width: 200,
				height: 100,
				fill: 'blur',
				stroke: '#000000',
				strokeWidth: 2,
				text: 'Blur Test'
			};

			renderer.draw( layer );

			expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalledTimes( 1 );
			expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalledWith(
				layer,
				expect.any( Function ), // drawBlurPath function
				expect.objectContaining( { x: 50, y: 50, width: 200, height: 100 } ),
				expect.any( Object ) // options
			);
		} );

		it( 'should not call effectsRenderer.drawBlurFill when fillOpacity is 0', () => {
			const mockEffectsRenderer = {
				drawBlurFill: jest.fn()
			};
			renderer.setEffectsRenderer( mockEffectsRenderer );

			const layer = {
				type: 'textbox',
				x: 50,
				y: 50,
				width: 200,
				height: 100,
				fill: 'blur',
				fillOpacity: 0
			};

			renderer.draw( layer );

			expect( mockEffectsRenderer.drawBlurFill ).not.toHaveBeenCalled();
		} );

		it( 'should not draw regular fill when fill is blur', () => {
			const mockEffectsRenderer = {
				drawBlurFill: jest.fn()
			};
			renderer.setEffectsRenderer( mockEffectsRenderer );

			const layer = {
				type: 'textbox',
				x: 50,
				y: 50,
				width: 200,
				height: 100,
				fill: 'blur',
				stroke: '#000000'
			};

			ctx.fill.mockClear();
			renderer.draw( layer );

			// fill() should NOT be called for blur fill (only for regular color fill)
			expect( ctx.fill ).not.toHaveBeenCalled();
		} );

		it( 'should handle blur fill with rotation', () => {
			const mockEffectsRenderer = {
				drawBlurFill: jest.fn()
			};
			renderer.setEffectsRenderer( mockEffectsRenderer );

			const layer = {
				type: 'textbox',
				x: 50,
				y: 50,
				width: 200,
				height: 100,
				fill: 'blur',
				rotation: 45
			};

			renderer.draw( layer );

			expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalledTimes( 1 );

			// Verify rotation was applied to the main context BEFORE drawBlurFill was called
			// The context should have translate and rotate called on it
			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();

			// Get the drawBlurPath function that was passed
			const drawBlurPath = mockEffectsRenderer.drawBlurFill.mock.calls[ 0 ][ 1 ];

			// Call the path function to verify it works
			const mockCtx = createMockContext();
			drawBlurPath( mockCtx );

			// The path function should just draw the rect (rotation is already on the context)
			expect( mockCtx.beginPath ).toHaveBeenCalled();
			expect( mockCtx.rect ).toHaveBeenCalled();

			// Verify the bounds passed use AABB (axis-aligned bounding box) coordinates
			// For a 200x100 rect at (50,50) rotated 45°, center is at (150, 100)
			// AABB for 45° rotation: both dimensions become width*cos(45)+height*sin(45)
			const bounds = mockEffectsRenderer.drawBlurFill.mock.calls[ 0 ][ 2 ];
			const angleRad = ( 45 * Math.PI ) / 180;
			const cos45 = Math.abs( Math.cos( angleRad ) );
			const sin45 = Math.abs( Math.sin( angleRad ) );
			const expectedWidth = 200 * cos45 + 100 * sin45;
			const expectedHeight = 200 * sin45 + 100 * cos45;
			const centerX = 50 + 200 / 2; // 150
			const centerY = 50 + 100 / 2; // 100
			expect( bounds.x ).toBeCloseTo( centerX - expectedWidth / 2 );
			expect( bounds.y ).toBeCloseTo( centerY - expectedHeight / 2 );
			expect( bounds.width ).toBeCloseTo( expectedWidth );
			expect( bounds.height ).toBeCloseTo( expectedHeight );
		} );

		it( 'should handle blur fill with corner radius', () => {
			const mockEffectsRenderer = {
				drawBlurFill: jest.fn()
			};
			renderer.setEffectsRenderer( mockEffectsRenderer );

			const layer = {
				type: 'textbox',
				x: 50,
				y: 50,
				width: 200,
				height: 100,
				fill: 'blur',
				cornerRadius: 10
			};

			renderer.draw( layer );

			expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalledTimes( 1 );

			// Get the drawBlurPath function
			const drawBlurPath = mockEffectsRenderer.drawBlurFill.mock.calls[ 0 ][ 1 ];

			// Call the path function
			const mockCtx = createMockContext();
			drawBlurPath( mockCtx );

			// Should have used roundRect or fallback
			expect( mockCtx.beginPath ).toHaveBeenCalled();
			// Either roundRect was called or the manual path (moveTo, lineTo, arcTo)
			const usedRoundRect = mockCtx.roundRect.mock.calls.length > 0;
			const usedManualPath = mockCtx.moveTo.mock.calls.length > 0;
			expect( usedRoundRect || usedManualPath ).toBe( true );
		} );
	} );

	// ========================================================================
	// Cleanup Tests
	// ========================================================================

	describe( 'destroy', () => {
		it( 'should clean up resources', () => {
			renderer.destroy();
			expect( renderer.ctx ).toBe( null );
			expect( renderer.config ).toBe( null );
			expect( renderer.shadowRenderer ).toBe( null );
		} );
	} );

	// ========================================================================
	// drawTextOnly Tests
	// ========================================================================

	describe( 'drawTextOnly', () => {
		it( 'should draw only text content without box', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				text: 'Hello World',
				fontSize: 16,
				fontFamily: 'Arial'
			};

			renderer.drawTextOnly( layer );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should apply scale and offset options', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 20,
				width: 200,
				height: 100,
				text: 'Test',
				fontSize: 14
			};

			renderer.drawTextOnly( layer, {
				scale: { sx: 2, sy: 2, avg: 2 },
				offset: { x: 50, y: 50 }
			} );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should handle layer opacity', () => {
			const layer = {
				type: 'textbox',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				text: 'Opacity test',
				opacity: 0.5
			};

			renderer.drawTextOnly( layer );

			expect( ctx.save ).toHaveBeenCalled();
		} );

		it( 'should not draw anything when text is empty', () => {
			const layer = {
				type: 'textbox',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				text: ''
			};

			renderer.drawTextOnly( layer );

			// Should not call save when no text
			// Actually it only calls save if text exists
		} );

		it( 'should use default dimensions when not provided', () => {
			const layer = {
				type: 'textbox',
				text: 'Default test'
			};

			renderer.drawTextOnly( layer );

			expect( ctx.save ).toHaveBeenCalled();
		} );
	} );

	// ========================================================================
	// Shadow with spread Tests
	// ========================================================================

	describe( 'shadow with spread drawing', () => {
		it( 'should draw fill shadow with spread', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ffffff',
				shadow: true,
				shadowSpread: 5,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			expect( () => renderer.draw( layer ) ).not.toThrow();
		} );

		it( 'should draw stroke shadow separately', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				stroke: '#000000',
				strokeWidth: 2,
				shadow: true,
				shadowSpread: 5
			};

			expect( () => renderer.draw( layer ) ).not.toThrow();
		} );

		it( 'should draw shadow with rounded corners and spread', () => {
			const layer = {
				type: 'textbox',
				x: 10,
				y: 10,
				width: 100,
				height: 50,
				fill: '#ffffff',
				cornerRadius: 10,
				shadow: true,
				shadowSpread: 8
			};

			expect( () => renderer.draw( layer ) ).not.toThrow();
		} );
	} );

	// ========================================================================
	// Rich Text Support Tests
	// ========================================================================

	describe( 'rich text support', () => {
		describe( 'hasRichText', () => {
			it( 'should return true for valid rich text array', () => {
				const layer = {
					richText: [
						{ text: 'Hello', style: { fontWeight: 'bold' } },
						{ text: ' World', style: { color: '#ff0000' } }
					]
				};
				expect( renderer.hasRichText( layer ) ).toBe( true );
			} );

			it( 'should return false for empty richText array', () => {
				const layer = { richText: [] };
				expect( renderer.hasRichText( layer ) ).toBe( false );
			} );

			it( 'should return false for missing richText', () => {
				const layer = { text: 'Hello World' };
				expect( renderer.hasRichText( layer ) ).toBe( false );
			} );

			it( 'should return false for richText with no valid runs', () => {
				const layer = { richText: [ null, undefined, {} ] };
				expect( renderer.hasRichText( layer ) ).toBe( false );
			} );

			it( 'should return true if at least one run has text', () => {
				const layer = { richText: [ null, { text: 'Valid' } ] };
				expect( renderer.hasRichText( layer ) ).toBe( true );
			} );
		} );

		describe( 'getRichTextPlainText', () => {
			it( 'should combine all run texts', () => {
				const richText = [
					{ text: 'Hello' },
					{ text: ' ' },
					{ text: 'World' }
				];
				expect( renderer.getRichTextPlainText( richText ) ).toBe( 'Hello World' );
			} );

			it( 'should ignore invalid runs', () => {
				const richText = [
					{ text: 'Hello' },
					null,
					{ text: ' World' },
					{ noText: true }
				];
				expect( renderer.getRichTextPlainText( richText ) ).toBe( 'Hello World' );
			} );

			it( 'should return empty string for empty array', () => {
				expect( renderer.getRichTextPlainText( [] ) ).toBe( '' );
			} );

			it( 'should return empty string for non-array', () => {
				expect( renderer.getRichTextPlainText( null ) ).toBe( '' );
				expect( renderer.getRichTextPlainText( undefined ) ).toBe( '' );
				expect( renderer.getRichTextPlainText( 'string' ) ).toBe( '' );
			} );
		} );

		describe( 'buildCharToRunMap', () => {
			it( 'should build correct map for simple runs', () => {
				const richText = [
					{ text: 'AB' },
					{ text: 'CD' }
				];
				const map = renderer.buildCharToRunMap( richText );

				expect( map[ 0 ] ).toEqual( { runIndex: 0, localIndex: 0 } );
				expect( map[ 1 ] ).toEqual( { runIndex: 0, localIndex: 1 } );
				expect( map[ 2 ] ).toEqual( { runIndex: 1, localIndex: 0 } );
				expect( map[ 3 ] ).toEqual( { runIndex: 1, localIndex: 1 } );
			} );

			it( 'should skip invalid runs', () => {
				const richText = [
					{ text: 'A' },
					null,
					{ text: 'B' }
				];
				const map = renderer.buildCharToRunMap( richText );

				expect( map[ 0 ] ).toEqual( { runIndex: 0, localIndex: 0 } );
				expect( map[ 1 ] ).toEqual( { runIndex: 2, localIndex: 0 } );
			} );
		} );

		describe( 'drawRichTextLine', () => {
			it( 'should draw text for runs within line range', () => {
				const richText = [
					{ text: 'Hello ', style: { fontWeight: 'bold' } },
					{ text: 'World', style: { color: '#ff0000' } }
				];
				const baseStyle = {
					fontSize: 16,
					fontFamily: 'Arial',
					fontWeight: 'normal',
					fontStyle: 'normal',
					color: '#000000'
				};
				const textStyle = {
					hasTextShadow: false,
					hasTextStroke: false
				};
				const scale = { sx: 1, sy: 1, avg: 1 };

				expect( () => {
					renderer.drawRichTextLine( richText, 0, 11, 10, 10, baseStyle, textStyle, scale );
				} ).not.toThrow();

				expect( ctx.fillText ).toHaveBeenCalled();
			} );

			it( 'should handle partial run on line', () => {
				const richText = [ { text: 'Hello World' } ];
				const baseStyle = {
					fontSize: 16,
					fontFamily: 'Arial',
					fontWeight: 'normal',
					fontStyle: 'normal',
					color: '#000000'
				};
				const textStyle = {
					hasTextShadow: false,
					hasTextStroke: false
				};
				const scale = { sx: 1, sy: 1, avg: 1 };

				// Draw just "Hello" (chars 0-5)
				renderer.drawRichTextLine( richText, 0, 5, 10, 10, baseStyle, textStyle, scale );

				expect( ctx.fillText ).toHaveBeenCalledWith( 'Hello', 10, 10 );
			} );

			it( 'should apply text decoration', () => {
				const richText = [
					{ text: 'Underlined', style: { textDecoration: 'underline' } }
				];
				const baseStyle = {
					fontSize: 16,
					fontFamily: 'Arial',
					fontWeight: 'normal',
					fontStyle: 'normal',
					color: '#000000'
				};
				const textStyle = {
					hasTextShadow: false,
					hasTextStroke: false
				};
				const scale = { sx: 1, sy: 1, avg: 1 };

				renderer.drawRichTextLine( richText, 0, 10, 10, 10, baseStyle, textStyle, scale );

				// Should have drawn underline
				expect( ctx.stroke ).toHaveBeenCalled();
			} );

			it( 'should draw background highlight', () => {
				const richText = [
					{ text: 'Highlighted', style: { backgroundColor: '#ffff00' } }
				];
				const baseStyle = {
					fontSize: 16,
					fontFamily: 'Arial',
					fontWeight: 'normal',
					fontStyle: 'normal',
					color: '#000000'
				};
				const textStyle = {
					hasTextShadow: false,
					hasTextStroke: false
				};
				const scale = { sx: 1, sy: 1, avg: 1 };

				renderer.drawRichTextLine( richText, 0, 11, 10, 10, baseStyle, textStyle, scale );

				// Should have used fillRect for background (one more save/restore pair)
				expect( ctx.save ).toHaveBeenCalled();
			} );
		} );

		describe( 'drawRichTextContent', () => {
			it( 'should render full rich text with word wrapping', () => {
				const layer = {
					type: 'textbox',
					x: 10,
					y: 10,
					width: 200,
					height: 100,
					padding: 8,
					richText: [
						{ text: 'Bold text ', style: { fontWeight: 'bold' } },
						{ text: 'and normal text', style: {} }
					]
				};
				const scale = { sx: 1, sy: 1, avg: 1 };

				expect( () => {
					renderer.drawRichTextContent( layer, 10, 10, 200, 100, 8, scale, scale, 1 );
				} ).not.toThrow();

				expect( ctx.fillText ).toHaveBeenCalled();
			} );

			it( 'should respect vertical alignment', () => {
				const layer = {
					type: 'textbox',
					richText: [ { text: 'Centered' } ],
					verticalAlign: 'middle'
				};
				const scale = { sx: 1, sy: 1, avg: 1 };

				expect( () => {
					renderer.drawRichTextContent( layer, 0, 0, 100, 100, 8, scale, scale, 1 );
				} ).not.toThrow();
			} );
		} );

		describe( 'integration with draw method', () => {
			it( 'should use rich text when layer has richText property', () => {
				const layer = {
					type: 'textbox',
					x: 10,
					y: 10,
					width: 200,
					height: 100,
					fill: '#ffffff',
					richText: [
						{ text: 'Hello ', style: { fontWeight: 'bold' } },
						{ text: 'World', style: { color: '#ff0000', fontStyle: 'italic' } }
					]
				};

				expect( () => renderer.draw( layer ) ).not.toThrow();
				expect( ctx.fillText ).toHaveBeenCalled();
			} );

			it( 'should fall back to plain text when richText is empty', () => {
				const layer = {
					type: 'textbox',
					x: 10,
					y: 10,
					width: 200,
					height: 100,
					text: 'Plain text',
					richText: []
				};

				expect( () => renderer.draw( layer ) ).not.toThrow();
				// Should use plain text path
				expect( ctx.fillText ).toHaveBeenCalledWith( 'Plain text', expect.any( Number ), expect.any( Number ) );
			} );

			it( 'should render mixed formatting across multiple lines', () => {
				const layer = {
					type: 'textbox',
					x: 0,
					y: 0,
					width: 80, // Force wrapping
					height: 100,
					fontSize: 12,
					richText: [
						{ text: 'This is a long text that should wrap to multiple lines', style: {} }
					]
				};

				expect( () => renderer.draw( layer ) ).not.toThrow();
			} );
		} );

		describe( 'drawTextOnly with rich text', () => {
			it( 'should render rich text content', () => {
				const layer = {
					type: 'textbox',
					x: 10,
					y: 10,
					width: 200,
					height: 100,
					richText: [
						{ text: 'Rich text content', style: { color: '#0000ff' } }
					]
				};

				expect( () => renderer.drawTextOnly( layer ) ).not.toThrow();
				expect( ctx.fillText ).toHaveBeenCalled();
			} );

			it( 'should not render when no text content', () => {
				const layer = {
					type: 'textbox',
					x: 10,
					y: 10,
					width: 200,
					height: 100
					// No text or richText
				};

				ctx.fillText.mockClear();
				renderer.drawTextOnly( layer );
				expect( ctx.fillText ).not.toHaveBeenCalled();
			} );
		} );
	} );
} );
