/**
 * TextUtils Test Suite
 * Tests for text measurement and sanitization utilities
 */

describe( 'TextUtils', () => {
	let TextUtils;
	let mockCtx;

	beforeEach( () => {
		jest.resetModules();

		// Setup window
		global.window = {
			Layers: {}
		};

		// Create mock canvas context
		mockCtx = {
			save: jest.fn(),
			restore: jest.fn(),
			font: '',
			measureText: jest.fn( ( text ) => ( {
				width: text.length * 10,
				actualBoundingBoxAscent: 12,
				actualBoundingBoxDescent: 3
			} ) )
		};

		TextUtils = require( '../../resources/ext.layers.editor/TextUtils.js' );
	} );

	afterEach( () => {
		delete global.window;
	} );

	describe( 'sanitizeTextContent', () => {
		it( 'should return empty string for null', () => {
			expect( TextUtils.sanitizeTextContent( null ) ).toBe( '' );
		} );

		it( 'should return empty string for undefined', () => {
			expect( TextUtils.sanitizeTextContent( undefined ) ).toBe( '' );
		} );

		it( 'should convert numbers to strings', () => {
			expect( TextUtils.sanitizeTextContent( 123 ) ).toBe( '123' );
		} );

		it( 'should pass through normal text', () => {
			expect( TextUtils.sanitizeTextContent( 'Hello World' ) ).toBe( 'Hello World' );
		} );

		it( 'should remove control characters', () => {
			expect( TextUtils.sanitizeTextContent( 'Hello\x00World' ) ).toBe( 'HelloWorld' );
			expect( TextUtils.sanitizeTextContent( 'Test\x1FString' ) ).toBe( 'TestString' );
		} );

		it( 'should strip dangerous HTML tags but preserve harmless ones', () => {
			// Harmless tags (e.g., <b>) preserved for Canvas rendering
			expect( TextUtils.sanitizeTextContent( '<b>Bold</b>' ) ).toBe( '<b>Bold</b>' );
			// Dangerous tags stripped
			expect( TextUtils.sanitizeTextContent( '<script>alert("xss")</script>' ) ).toBe( 'alert("xss")' );
		} );

		it( 'should preserve math expressions with angle brackets', () => {
			expect( TextUtils.sanitizeTextContent( 'x < 5' ) ).toBe( 'x < 5' );
			expect( TextUtils.sanitizeTextContent( 'a > b' ) ).toBe( 'a > b' );
		} );

		it( 'should preserve extended Unicode characters', () => {
			expect( TextUtils.sanitizeTextContent( 'Café résumé' ) ).toBe( 'Café résumé' );
			expect( TextUtils.sanitizeTextContent( '日本語テスト' ) ).toBe( '日本語テスト' );
		} );

		it( 'should preserve non-breaking spaces', () => {
			expect( TextUtils.sanitizeTextContent( 'Hello\u00A0World' ) ).toBe( 'Hello\u00A0World' );
		} );
	} );

	describe( 'wrapText', () => {
		it( 'should return array with empty string for null text', () => {
			expect( TextUtils.wrapText( null, 100, mockCtx ) ).toEqual( [ '' ] );
		} );

		it( 'should return array with empty string for undefined text', () => {
			expect( TextUtils.wrapText( undefined, 100, mockCtx ) ).toEqual( [ '' ] );
		} );

		it( 'should return array with original text for null maxWidth', () => {
			expect( TextUtils.wrapText( 'Hello', null, mockCtx ) ).toEqual( [ 'Hello' ] );
		} );

		it( 'should return array with original text for zero maxWidth', () => {
			expect( TextUtils.wrapText( 'Hello', 0, mockCtx ) ).toEqual( [ 'Hello' ] );
		} );

		it( 'should return array with original text for negative maxWidth', () => {
			expect( TextUtils.wrapText( 'Hello', -100, mockCtx ) ).toEqual( [ 'Hello' ] );
		} );

		it( 'should wrap text that exceeds maxWidth', () => {
			// Each character is 10px wide, so "Hello World" = 110px
			const result = TextUtils.wrapText( 'Hello World', 60, mockCtx );
			expect( result ).toEqual( [ 'Hello', 'World' ] );
		} );

		it( 'should not wrap text that fits within maxWidth', () => {
			const result = TextUtils.wrapText( 'Hi', 500, mockCtx );
			expect( result ).toEqual( [ 'Hi' ] );
		} );

		it( 'should handle multiple line wrapping', () => {
			// "A B C D" where each word is tested
			const result = TextUtils.wrapText( 'A B C D E', 25, mockCtx );
			// Each word is short, should wrap based on accumulated length
			expect( result.length ).toBeGreaterThanOrEqual( 2 );
		} );

		it( 'should handle single long word', () => {
			const result = TextUtils.wrapText( 'Supercalifragilisticexpialidocious', 50, mockCtx );
			// Single word cannot be split, stays on one line
			expect( result ).toEqual( [ 'Supercalifragilisticexpialidocious' ] );
		} );

		it( 'should handle empty string', () => {
			const result = TextUtils.wrapText( '', 100, mockCtx );
			expect( result ).toEqual( [ '' ] );
		} );
	} );

	describe( 'measureTextLayer', () => {
		it( 'should return null for null layer', () => {
			expect( TextUtils.measureTextLayer( null, mockCtx, 800 ) ).toBeNull();
		} );

		it( 'should return null for undefined layer', () => {
			expect( TextUtils.measureTextLayer( undefined, mockCtx, 800 ) ).toBeNull();
		} );

		it( 'should measure basic text layer', () => {
			const layer = {
				text: 'Hello',
				x: 100,
				y: 100,
				fontSize: 16,
				fontFamily: 'Arial'
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			expect( result ).not.toBeNull();
			expect( result.lines ).toEqual( [ 'Hello' ] );
			expect( result.fontSize ).toBe( 16 );
			expect( result.fontFamily ).toBe( 'Arial' );
			expect( result.width ).toBe( 50 ); // 5 chars * 10px
		} );

		it( 'should use default fontSize and fontFamily', () => {
			const layer = {
				text: 'Test',
				x: 50,
				y: 50
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			expect( result.fontSize ).toBe( 16 );
			expect( result.fontFamily ).toBe( 'Arial' );
		} );

		it( 'should handle empty text', () => {
			const layer = {
				text: '',
				x: 100,
				y: 100
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			expect( result ).not.toBeNull();
			expect( result.lines ).toEqual( [ '' ] );
		} );

		it( 'should handle missing text property', () => {
			const layer = {
				x: 100,
				y: 100
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			expect( result ).not.toBeNull();
			expect( result.lines[ 0 ] ).toBe( '' );
		} );

		it( 'should handle fallback when context is null', () => {
			const layer = {
				text: 'Hello',
				x: 100,
				y: 100,
				fontSize: 20
			};

			const result = TextUtils.measureTextLayer( layer, null, 800 );

			expect( result ).not.toBeNull();
			expect( result.lines ).toEqual( [ 'Hello' ] );
			expect( result.fontSize ).toBe( 20 );
			expect( result.ascent ).toBe( 16 ); // 20 * 0.8
			expect( result.descent ).toBe( 4 ); // 20 * 0.2
		} );

		it( 'should handle center text alignment', () => {
			const layer = {
				text: 'Centered',
				x: 100,
				y: 100,
				textAlign: 'center'
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			expect( result.alignOffset ).toBe( result.width / 2 );
			expect( result.originX ).toBe( 100 - result.alignOffset );
		} );

		it( 'should handle right text alignment', () => {
			const layer = {
				text: 'Right',
				x: 100,
				y: 100,
				textAlign: 'right'
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			expect( result.alignOffset ).toBe( result.width );
		} );

		it( 'should handle end text alignment', () => {
			const layer = {
				text: 'End',
				x: 100,
				y: 100,
				textAlign: 'end'
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			expect( result.alignOffset ).toBe( result.width );
		} );

		it( 'should handle left text alignment (default)', () => {
			const layer = {
				text: 'Left',
				x: 100,
				y: 100,
				textAlign: 'left'
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			expect( result.alignOffset ).toBe( 0 );
		} );

		it( 'should use layer maxWidth when provided', () => {
			const layer = {
				text: 'This is a longer text that should wrap',
				x: 100,
				y: 100,
				maxWidth: 50
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			expect( result.lines.length ).toBeGreaterThan( 1 );
		} );

		it( 'should calculate fallback maxWidth from fontSize when no canvasWidth', () => {
			const layer = {
				text: 'Test',
				x: 100,
				y: 100,
				fontSize: 20
			};

			// No canvasWidth, should use fontSize-based calculation
			const result = TextUtils.measureTextLayer( layer, mockCtx, null );

			expect( result ).not.toBeNull();
		} );

		it( 'should handle multi-line text height calculation', () => {
			const layer = {
				text: 'Line one Line two Line three',
				x: 100,
				y: 100,
				maxWidth: 80
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			if ( result.lines.length > 1 ) {
				const expectedHeight = result.ascent + result.descent +
					( result.lines.length - 1 ) * result.lineHeight;
				expect( result.height ).toBe( expectedHeight );
			}
		} );

		it( 'should use actual bounding box metrics when available', () => {
			const layer = {
				text: 'Hello',
				x: 100,
				y: 100
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			// mockCtx returns actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 3
			expect( result.ascent ).toBe( 12 );
			expect( result.descent ).toBe( 3 );
		} );

		it( 'should fall back to fontSize-based metrics when bounding box not available', () => {
			// Create context without actualBoundingBox metrics
			const limitedCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( ( text ) => ( {
					width: text.length * 10
					// No actualBoundingBoxAscent or actualBoundingBoxDescent
				} ) )
			};

			const layer = {
				text: 'Hello',
				x: 100,
				y: 100,
				fontSize: 20
			};

			const result = TextUtils.measureTextLayer( layer, limitedCtx, 800 );

			expect( result.ascent ).toBe( 16 ); // 20 * 0.8
			expect( result.descent ).toBe( 4 ); // 20 * 0.2
		} );

		it( 'should handle zero-width text measurement fallback', () => {
			// Create context that returns 0 width for empty strings
			const zeroWidthCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( ( text ) => ( {
					width: text.trim() === '' ? 0 : text.length * 10,
					actualBoundingBoxAscent: 12,
					actualBoundingBoxDescent: 3
				} ) )
			};

			const layer = {
				text: '   ',
				x: 100,
				y: 100
			};

			const result = TextUtils.measureTextLayer( layer, zeroWidthCtx, 800 );

			// Should use fallback metrics
			expect( result ).not.toBeNull();
		} );

		it( 'should set correct baselineY from layer y', () => {
			const layer = {
				text: 'Test',
				x: 50,
				y: 200
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			expect( result.baselineY ).toBe( 200 );
		} );

		it( 'should handle missing x and y coordinates', () => {
			const layer = {
				text: 'Test'
			};

			const result = TextUtils.measureTextLayer( layer, mockCtx, 800 );

			expect( result.baselineY ).toBe( 0 );
			expect( result.originX ).toBe( 0 );
		} );
	} );

	describe( 'exports', () => {
		it( 'should export to window.Layers.Utils.Text namespace', () => {
			expect( window.Layers.Utils.Text ).toBe( TextUtils );
		} );
	} );
} );
