/**
 * Tests for RichTextUtils
 *
 * @file
 */
'use strict';

const RichTextUtils = require( '../../../resources/ext.layers.shared/RichTextUtils.js' );

describe( 'RichTextUtils', () => {
	describe( 'hasRichText', () => {
		test( 'should return true for valid rich text array', () => {
			const layer = {
				richText: [
					{ text: 'Hello', style: { fontWeight: 'bold' } },
					{ text: ' world' }
				]
			};
			expect( RichTextUtils.hasRichText( layer ) ).toBe( true );
		} );

		test( 'should return false for empty richText array', () => {
			const layer = { richText: [] };
			expect( RichTextUtils.hasRichText( layer ) ).toBe( false );
		} );

		test( 'should return false for null richText', () => {
			const layer = { richText: null };
			expect( RichTextUtils.hasRichText( layer ) ).toBe( false );
		} );

		test( 'should return false for undefined richText', () => {
			const layer = {};
			expect( RichTextUtils.hasRichText( layer ) ).toBe( false );
		} );

		test( 'should return false for richText with no valid runs', () => {
			const layer = {
				richText: [
					{ text: 123 }, // not a string
					null,
					{ noText: 'property' }
				]
			};
			expect( RichTextUtils.hasRichText( layer ) ).toBe( false );
		} );

		test( 'should return true if at least one run has valid text', () => {
			const layer = {
				richText: [
					null,
					{ text: 'valid' },
					{ noText: 'here' }
				]
			};
			expect( RichTextUtils.hasRichText( layer ) ).toBe( true );
		} );

		test( 'should return true for runs with empty string text', () => {
			const layer = {
				richText: [ { text: '' } ]
			};
			// Empty string is a valid string
			expect( RichTextUtils.hasRichText( layer ) ).toBe( true );
		} );
	} );

	describe( 'getRichTextPlainText', () => {
		test( 'should combine text from all runs', () => {
			const richText = [
				{ text: 'Hello' },
				{ text: ' ' },
				{ text: 'world' }
			];
			expect( RichTextUtils.getRichTextPlainText( richText ) ).toBe( 'Hello world' );
		} );

		test( 'should return empty string for empty array', () => {
			expect( RichTextUtils.getRichTextPlainText( [] ) ).toBe( '' );
		} );

		test( 'should return empty string for non-array', () => {
			expect( RichTextUtils.getRichTextPlainText( null ) ).toBe( '' );
			expect( RichTextUtils.getRichTextPlainText( undefined ) ).toBe( '' );
			expect( RichTextUtils.getRichTextPlainText( 'string' ) ).toBe( '' );
		} );

		test( 'should skip invalid runs', () => {
			const richText = [
				{ text: 'Hello' },
				null,
				{ noText: 'property' },
				{ text: 123 },
				{ text: ' world' }
			];
			expect( RichTextUtils.getRichTextPlainText( richText ) ).toBe( 'Hello world' );
		} );

		test( 'should handle runs with only style', () => {
			const richText = [
				{ style: { bold: true } },
				{ text: 'text' }
			];
			expect( RichTextUtils.getRichTextPlainText( richText ) ).toBe( 'text' );
		} );
	} );

	describe( 'buildCharToRunMap', () => {
		test( 'should map character positions to run indices', () => {
			const richText = [
				{ text: 'AB' },
				{ text: 'CD' }
			];
			const map = RichTextUtils.buildCharToRunMap( richText );

			expect( map[ 0 ] ).toEqual( { runIndex: 0, localIndex: 0 } ); // A
			expect( map[ 1 ] ).toEqual( { runIndex: 0, localIndex: 1 } ); // B
			expect( map[ 2 ] ).toEqual( { runIndex: 1, localIndex: 0 } ); // C
			expect( map[ 3 ] ).toEqual( { runIndex: 1, localIndex: 1 } ); // D
		} );

		test( 'should return empty map for empty array', () => {
			expect( RichTextUtils.buildCharToRunMap( [] ) ).toEqual( [] );
		} );

		test( 'should skip invalid runs', () => {
			const richText = [
				{ text: 'AB' },
				null,
				{ noText: 'x' },
				{ text: 'C' }
			];
			const map = RichTextUtils.buildCharToRunMap( richText );

			expect( map[ 0 ] ).toEqual( { runIndex: 0, localIndex: 0 } );
			expect( map[ 1 ] ).toEqual( { runIndex: 0, localIndex: 1 } );
			expect( map[ 2 ] ).toEqual( { runIndex: 3, localIndex: 0 } ); // Skip to run index 3
		} );

		test( 'should handle empty text runs', () => {
			const richText = [
				{ text: 'A' },
				{ text: '' },
				{ text: 'B' }
			];
			const map = RichTextUtils.buildCharToRunMap( richText );

			expect( map.length ).toBe( 2 );
			expect( map[ 0 ] ).toEqual( { runIndex: 0, localIndex: 0 } );
			expect( map[ 1 ] ).toEqual( { runIndex: 2, localIndex: 0 } );
		} );
	} );

	describe( 'findMaxFontSizeForLine', () => {
		const scale = { avg: 1 };
		const baseFontSize = 16;

		test( 'should return base font size when no runs have custom size', () => {
			const richText = [
				{ text: 'Hello world' }
			];
			const result = RichTextUtils.findMaxFontSizeForLine( richText, 0, 11, baseFontSize, scale );
			expect( result ).toBe( baseFontSize );
		} );

		test( 'should return max font size from runs in line range', () => {
			const richText = [
				{ text: 'Small', style: { fontSize: 12 } },
				{ text: 'Large', style: { fontSize: 24 } }
			];
			const result = RichTextUtils.findMaxFontSizeForLine( richText, 0, 10, baseFontSize, scale );
			expect( result ).toBe( 24 );
		} );

		test( 'should ignore runs outside line range', () => {
			const richText = [
				{ text: 'AAAAA', style: { fontSize: 24 } }, // chars 0-4
				{ text: 'BBBBB', style: { fontSize: 48 } } // chars 5-9
			];
			// Only check first 5 chars (run 1), should get 24, not 48
			const result = RichTextUtils.findMaxFontSizeForLine( richText, 0, 5, baseFontSize, scale );
			expect( result ).toBe( 24 );
		} );

		test( 'should apply scale factor', () => {
			const richText = [
				{ text: 'Test', style: { fontSize: 20 } }
			];
			const scaledResult = RichTextUtils.findMaxFontSizeForLine( richText, 0, 4, baseFontSize, { avg: 2 } );
			expect( scaledResult ).toBe( 40 ); // 20 * 2
		} );

		test( 'should skip invalid runs', () => {
			const richText = [
				null,
				{ text: 123 },
				{ text: 'Valid', style: { fontSize: 18 } }
			];
			const result = RichTextUtils.findMaxFontSizeForLine( richText, 0, 5, baseFontSize, scale );
			expect( result ).toBe( 18 );
		} );
	} );

	describe( 'calculateLineMetrics', () => {
		const scale = { avg: 1 };
		const baseFontSize = 16;
		const lineHeightMultiplier = 1.2;

		test( 'should calculate metrics for single line', () => {
			const lines = [ 'Hello' ];
			const richText = [ { text: 'Hello' } ];
			const plainText = 'Hello';

			const metrics = RichTextUtils.calculateLineMetrics(
				lines, richText, plainText, baseFontSize, lineHeightMultiplier, scale
			);

			expect( metrics.length ).toBe( 1 );
			expect( metrics[ 0 ].text ).toBe( 'Hello' );
			expect( metrics[ 0 ].start ).toBe( 0 );
			expect( metrics[ 0 ].end ).toBe( 5 );
			expect( metrics[ 0 ].maxFontSize ).toBe( baseFontSize );
			expect( metrics[ 0 ].lineHeight ).toBe( baseFontSize * lineHeightMultiplier );
		} );

		test( 'should calculate metrics for multiple lines', () => {
			const lines = [ 'Hello', 'World' ];
			const richText = [ { text: 'Hello World' } ];
			const plainText = 'Hello World';

			const metrics = RichTextUtils.calculateLineMetrics(
				lines, richText, plainText, baseFontSize, lineHeightMultiplier, scale
			);

			expect( metrics.length ).toBe( 2 );
			expect( metrics[ 0 ].text ).toBe( 'Hello' );
			expect( metrics[ 1 ].text ).toBe( 'World' );
		} );

		test( 'should handle empty lines array', () => {
			const metrics = RichTextUtils.calculateLineMetrics(
				[], [], '', baseFontSize, lineHeightMultiplier, scale
			);
			expect( metrics ).toEqual( [] );
		} );
	} );

	describe( 'calculateTotalTextHeight', () => {
		test( 'should sum line heights', () => {
			const lineMetrics = [
				{ lineHeight: 20 },
				{ lineHeight: 24 },
				{ lineHeight: 18 }
			];
			expect( RichTextUtils.calculateTotalTextHeight( lineMetrics ) ).toBe( 62 );
		} );

		test( 'should return 0 for empty array', () => {
			expect( RichTextUtils.calculateTotalTextHeight( [] ) ).toBe( 0 );
		} );

		test( 'should handle single line', () => {
			expect( RichTextUtils.calculateTotalTextHeight( [ { lineHeight: 16 } ] ) ).toBe( 16 );
		} );
	} );

	describe( 'calculateTextStartY', () => {
		const boxY = 100;
		const padding = 10;
		const availableHeight = 200;
		const totalTextHeight = 60;

		test( 'should calculate top alignment', () => {
			const result = RichTextUtils.calculateTextStartY( 'top', boxY, padding, availableHeight, totalTextHeight );
			expect( result ).toBe( boxY + padding ); // 110
		} );

		test( 'should calculate middle alignment', () => {
			const result = RichTextUtils.calculateTextStartY( 'middle', boxY, padding, availableHeight, totalTextHeight );
			// boxY + padding + (availableHeight - totalTextHeight) / 2
			// 100 + 10 + (200 - 60) / 2 = 100 + 10 + 70 = 180
			expect( result ).toBe( 180 );
		} );

		test( 'should calculate bottom alignment', () => {
			const result = RichTextUtils.calculateTextStartY( 'bottom', boxY, padding, availableHeight, totalTextHeight );
			// boxY + padding + availableHeight - totalTextHeight
			// 100 + 10 + 200 - 60 = 250
			expect( result ).toBe( 250 );
		} );

		test( 'should default to top alignment for unknown values', () => {
			const result = RichTextUtils.calculateTextStartY( 'unknown', boxY, padding, availableHeight, totalTextHeight );
			expect( result ).toBe( boxY + padding );
		} );

		test( 'should default to top alignment for null', () => {
			const result = RichTextUtils.calculateTextStartY( null, boxY, padding, availableHeight, totalTextHeight );
			expect( result ).toBe( boxY + padding );
		} );
	} );

	describe( 'calculateLineX', () => {
		const boxX = 50;
		const boxWidth = 200;
		const lineWidth = 100;
		const padding = 10;

		test( 'should calculate left alignment', () => {
			const result = RichTextUtils.calculateLineX( 'left', boxX, boxWidth, lineWidth, padding );
			expect( result ).toBe( boxX + padding ); // 60
		} );

		test( 'should calculate center alignment', () => {
			const result = RichTextUtils.calculateLineX( 'center', boxX, boxWidth, lineWidth, padding );
			// boxX + (boxWidth - lineWidth) / 2
			// 50 + (200 - 100) / 2 = 50 + 50 = 100
			expect( result ).toBe( 100 );
		} );

		test( 'should calculate right alignment', () => {
			const result = RichTextUtils.calculateLineX( 'right', boxX, boxWidth, lineWidth, padding );
			// boxX + boxWidth - padding - lineWidth
			// 50 + 200 - 10 - 100 = 140
			expect( result ).toBe( 140 );
		} );

		test( 'should default to left alignment for unknown values', () => {
			const result = RichTextUtils.calculateLineX( 'unknown', boxX, boxWidth, lineWidth, padding );
			expect( result ).toBe( boxX + padding );
		} );

		test( 'should default to left alignment for undefined', () => {
			const result = RichTextUtils.calculateLineX( undefined, boxX, boxWidth, lineWidth, padding );
			expect( result ).toBe( boxX + padding );
		} );
	} );

	describe( 'buildTextStyle', () => {
		const shadowScale = { avg: 1 };
		const scale = { avg: 1 };

		test( 'should build text style with defaults', () => {
			const layer = {};
			const style = RichTextUtils.buildTextStyle( layer, shadowScale, scale );

			expect( style.hasTextShadow ).toBe( false );
			expect( style.textShadowColor ).toBe( 'rgba(0,0,0,0.5)' );
			expect( style.textShadowBlur ).toBe( 4 );
			expect( style.textShadowOffsetX ).toBe( 2 );
			expect( style.textShadowOffsetY ).toBe( 2 );
			expect( style.hasTextStroke ).toBe( false );
			expect( style.textStrokeColor ).toBe( '#000000' );
			expect( style.textStrokeWidth ).toBe( 0 );
		} );

		test( 'should detect text shadow from boolean true', () => {
			const layer = { textShadow: true };
			const style = RichTextUtils.buildTextStyle( layer, shadowScale, scale );
			expect( style.hasTextShadow ).toBe( true );
		} );

		test( 'should detect text shadow from string "true"', () => {
			const layer = { textShadow: 'true' };
			const style = RichTextUtils.buildTextStyle( layer, shadowScale, scale );
			expect( style.hasTextShadow ).toBe( true );
		} );

		test( 'should detect text shadow from number 1', () => {
			const layer = { textShadow: 1 };
			const style = RichTextUtils.buildTextStyle( layer, shadowScale, scale );
			expect( style.hasTextShadow ).toBe( true );
		} );

		test( 'should detect text shadow from string "1"', () => {
			const layer = { textShadow: '1' };
			const style = RichTextUtils.buildTextStyle( layer, shadowScale, scale );
			expect( style.hasTextShadow ).toBe( true );
		} );

		test( 'should apply shadow scale factor', () => {
			const layer = {
				textShadowBlur: 8,
				textShadowOffsetX: 4,
				textShadowOffsetY: 4
			};
			const style = RichTextUtils.buildTextStyle( layer, { avg: 2 }, scale );

			expect( style.textShadowBlur ).toBe( 16 );
			expect( style.textShadowOffsetX ).toBe( 8 );
			expect( style.textShadowOffsetY ).toBe( 8 );
		} );

		test( 'should detect text stroke', () => {
			const layer = {
				textStrokeWidth: 2,
				textStrokeColor: '#FF0000'
			};
			const style = RichTextUtils.buildTextStyle( layer, shadowScale, scale );

			expect( style.hasTextStroke ).toBe( true );
			expect( style.textStrokeWidth ).toBe( 2 );
			expect( style.textStrokeColor ).toBe( '#FF0000' );
		} );

		test( 'should apply stroke scale factor', () => {
			const layer = { textStrokeWidth: 2 };
			const style = RichTextUtils.buildTextStyle( layer, shadowScale, { avg: 3 } );
			expect( style.textStrokeWidth ).toBe( 6 );
		} );

		test( 'should use custom shadow color', () => {
			const layer = { textShadowColor: 'rgba(255,0,0,0.8)' };
			const style = RichTextUtils.buildTextStyle( layer, shadowScale, scale );
			expect( style.textShadowColor ).toBe( 'rgba(255,0,0,0.8)' );
		} );
	} );

	describe( 'buildBaseStyle', () => {
		test( 'should build base style with defaults', () => {
			const layer = {};
			const style = RichTextUtils.buildBaseStyle( layer );

			expect( style.fontSize ).toBe( 16 );
			expect( style.fontFamily ).toBe( 'Arial, sans-serif' );
			expect( style.fontWeight ).toBe( 'normal' );
			expect( style.fontStyle ).toBe( 'normal' );
			expect( style.color ).toBe( '#000000' );
		} );

		test( 'should use layer properties when provided', () => {
			const layer = {
				fontSize: 24,
				fontFamily: 'Georgia, serif',
				fontWeight: 'bold',
				fontStyle: 'italic',
				color: '#FF0000'
			};
			const style = RichTextUtils.buildBaseStyle( layer );

			expect( style.fontSize ).toBe( 24 );
			expect( style.fontFamily ).toBe( 'Georgia, serif' );
			expect( style.fontWeight ).toBe( 'bold' );
			expect( style.fontStyle ).toBe( 'italic' );
			expect( style.color ).toBe( '#FF0000' );
		} );

		test( 'should handle partial layer properties', () => {
			const layer = {
				fontSize: 18,
				fontWeight: 'bold'
			};
			const style = RichTextUtils.buildBaseStyle( layer );

			expect( style.fontSize ).toBe( 18 );
			expect( style.fontFamily ).toBe( 'Arial, sans-serif' );
			expect( style.fontWeight ).toBe( 'bold' );
			expect( style.fontStyle ).toBe( 'normal' );
			expect( style.color ).toBe( '#000000' );
		} );
	} );

	describe( 'exports', () => {
		test( 'should export RichTextUtils to window.Layers', () => {
			expect( window.Layers.RichTextUtils ).toBeDefined();
			expect( window.Layers.RichTextUtils ).toBe( RichTextUtils );
		} );
	} );
} );
