/**
 * Tests for CanvasUtilities
 * Pure utility functions for canvas operations
 */

describe( 'CanvasUtilities', () => {
	let CanvasUtilities;

	beforeEach( () => {
		jest.resetModules();
		CanvasUtilities = require( '../../resources/ext.layers.editor/CanvasUtilities.js' );
	} );

	describe( 'sanitizeNumber', () => {
		it( 'should return number as-is when valid', () => {
			expect( CanvasUtilities.sanitizeNumber( 42, 0 ) ).toBe( 42 );
			expect( CanvasUtilities.sanitizeNumber( 3.14, 0 ) ).toBe( 3.14 );
			expect( CanvasUtilities.sanitizeNumber( -10, 0 ) ).toBe( -10 );
			expect( CanvasUtilities.sanitizeNumber( 0, 5 ) ).toBe( 0 );
		} );

		it( 'should parse string numbers', () => {
			expect( CanvasUtilities.sanitizeNumber( '42', 0 ) ).toBe( 42 );
			expect( CanvasUtilities.sanitizeNumber( '3.14', 0 ) ).toBe( 3.14 );
			expect( CanvasUtilities.sanitizeNumber( '-10', 0 ) ).toBe( -10 );
		} );

		it( 'should return default for NaN', () => {
			expect( CanvasUtilities.sanitizeNumber( NaN, 5 ) ).toBe( 5 );
			expect( CanvasUtilities.sanitizeNumber( 'abc', 10 ) ).toBe( 10 );
			expect( CanvasUtilities.sanitizeNumber( undefined, 7 ) ).toBe( 7 );
			expect( CanvasUtilities.sanitizeNumber( null, 3 ) ).toBe( 3 );
		} );

		it( 'should return default for Infinity', () => {
			expect( CanvasUtilities.sanitizeNumber( Infinity, 0 ) ).toBe( 0 );
			expect( CanvasUtilities.sanitizeNumber( -Infinity, 0 ) ).toBe( 0 );
		} );

		it( 'should clamp to minimum when provided', () => {
			expect( CanvasUtilities.sanitizeNumber( -5, 0, 0 ) ).toBe( 0 );
			expect( CanvasUtilities.sanitizeNumber( -100, 0, -50 ) ).toBe( -50 );
			expect( CanvasUtilities.sanitizeNumber( 5, 0, 0 ) ).toBe( 5 );
		} );

		it( 'should clamp to maximum when provided', () => {
			expect( CanvasUtilities.sanitizeNumber( 150, 0, undefined, 100 ) ).toBe( 100 );
			expect( CanvasUtilities.sanitizeNumber( 50, 0, undefined, 100 ) ).toBe( 50 );
		} );

		it( 'should clamp to both min and max when provided', () => {
			expect( CanvasUtilities.sanitizeNumber( -10, 0, 0, 100 ) ).toBe( 0 );
			expect( CanvasUtilities.sanitizeNumber( 150, 0, 0, 100 ) ).toBe( 100 );
			expect( CanvasUtilities.sanitizeNumber( 50, 0, 0, 100 ) ).toBe( 50 );
		} );
	} );

	describe( 'sanitizeColor', () => {
		it( 'should return valid hex colors', () => {
			expect( CanvasUtilities.sanitizeColor( '#fff', 'black' ) ).toBe( '#fff' );
			expect( CanvasUtilities.sanitizeColor( '#FFF', 'black' ) ).toBe( '#FFF' );
			expect( CanvasUtilities.sanitizeColor( '#ffffff', 'black' ) ).toBe( '#ffffff' );
			expect( CanvasUtilities.sanitizeColor( '#FFFFFF', 'black' ) ).toBe( '#FFFFFF' );
			expect( CanvasUtilities.sanitizeColor( '#abc', 'black' ) ).toBe( '#abc' );
			expect( CanvasUtilities.sanitizeColor( '#aabbcc', 'black' ) ).toBe( '#aabbcc' );
		} );

		it( 'should return transparent and none', () => {
			expect( CanvasUtilities.sanitizeColor( 'transparent', 'black' ) ).toBe( 'transparent' );
			expect( CanvasUtilities.sanitizeColor( 'none', 'black' ) ).toBe( 'none' );
		} );

		it( 'should return valid rgb/rgba colors', () => {
			expect( CanvasUtilities.sanitizeColor( 'rgb(255, 0, 0)', 'black' ) ).toBe( 'rgb(255, 0, 0)' );
			expect( CanvasUtilities.sanitizeColor( 'rgba(255, 0, 0, 0.5)', 'black' ) ).toBe( 'rgba(255, 0, 0, 0.5)' );
		} );

		it( 'should return valid hsl/hsla colors', () => {
			expect( CanvasUtilities.sanitizeColor( 'hsl(120, 100%, 50%)', 'black' ) ).toBe( 'hsl(120, 100%, 50%)' );
			expect( CanvasUtilities.sanitizeColor( 'hsla(120, 100%, 50%, 0.5)', 'black' ) ).toBe( 'hsla(120, 100%, 50%, 0.5)' );
		} );

		it( 'should return valid named colors', () => {
			expect( CanvasUtilities.sanitizeColor( 'red', 'black' ) ).toBe( 'red' );
			expect( CanvasUtilities.sanitizeColor( 'blue', 'black' ) ).toBe( 'blue' );
			expect( CanvasUtilities.sanitizeColor( 'green', 'black' ) ).toBe( 'green' );
			expect( CanvasUtilities.sanitizeColor( 'aliceblue', 'black' ) ).toBe( 'aliceblue' );
		} );

		it( 'should return default for invalid colors', () => {
			expect( CanvasUtilities.sanitizeColor( '', 'black' ) ).toBe( 'black' );
			expect( CanvasUtilities.sanitizeColor( null, 'black' ) ).toBe( 'black' );
			expect( CanvasUtilities.sanitizeColor( undefined, 'black' ) ).toBe( 'black' );
			expect( CanvasUtilities.sanitizeColor( 123, 'black' ) ).toBe( 'black' );
			expect( CanvasUtilities.sanitizeColor( '#gg', 'black' ) ).toBe( 'black' );
			expect( CanvasUtilities.sanitizeColor( '#12345', 'black' ) ).toBe( 'black' );
		} );

		it( 'should return default for malicious input', () => {
			expect( CanvasUtilities.sanitizeColor( 'javascript:alert(1)', 'black' ) ).toBe( 'black' );
			expect( CanvasUtilities.sanitizeColor( '<script>', 'black' ) ).toBe( 'black' );
			expect( CanvasUtilities.sanitizeColor( 'url(evil.com)', 'black' ) ).toBe( 'black' );
		} );
	} );

	describe( 'sanitizeFontFamily', () => {
		it( 'should return safe fonts as-is', () => {
			expect( CanvasUtilities.sanitizeFontFamily( 'Arial' ) ).toBe( 'Arial' );
			expect( CanvasUtilities.sanitizeFontFamily( 'Helvetica' ) ).toBe( 'Helvetica' );
			expect( CanvasUtilities.sanitizeFontFamily( 'Times New Roman' ) ).toBe( 'Times New Roman' );
			expect( CanvasUtilities.sanitizeFontFamily( 'Courier New' ) ).toBe( 'Courier New' );
			expect( CanvasUtilities.sanitizeFontFamily( 'Georgia' ) ).toBe( 'Georgia' );
			expect( CanvasUtilities.sanitizeFontFamily( 'Verdana' ) ).toBe( 'Verdana' );
		} );

		it( 'should return fonts containing safe font names', () => {
			expect( CanvasUtilities.sanitizeFontFamily( 'Arial, sans-serif' ) ).toBe( 'Arial, sans-serif' );
			expect( CanvasUtilities.sanitizeFontFamily( '"Times New Roman", serif' ) ).toBe( '"Times New Roman", serif' );
		} );

		it( 'should return generic font families', () => {
			expect( CanvasUtilities.sanitizeFontFamily( 'sans-serif' ) ).toBe( 'sans-serif' );
			expect( CanvasUtilities.sanitizeFontFamily( 'serif' ) ).toBe( 'serif' );
			expect( CanvasUtilities.sanitizeFontFamily( 'monospace' ) ).toBe( 'monospace' );
		} );

		it( 'should return default for invalid input', () => {
			expect( CanvasUtilities.sanitizeFontFamily( '' ) ).toBe( 'Arial, sans-serif' );
			expect( CanvasUtilities.sanitizeFontFamily( null ) ).toBe( 'Arial, sans-serif' );
			expect( CanvasUtilities.sanitizeFontFamily( undefined ) ).toBe( 'Arial, sans-serif' );
			expect( CanvasUtilities.sanitizeFontFamily( 123 ) ).toBe( 'Arial, sans-serif' );
		} );

		it( 'should return default for unknown fonts', () => {
			expect( CanvasUtilities.sanitizeFontFamily( 'CustomMaliciousFont' ) ).toBe( 'Arial, sans-serif' );
			expect( CanvasUtilities.sanitizeFontFamily( 'UnknownFont' ) ).toBe( 'Arial, sans-serif' );
		} );

		it( 'should be case-insensitive', () => {
			expect( CanvasUtilities.sanitizeFontFamily( 'ARIAL' ) ).toBe( 'ARIAL' );
			expect( CanvasUtilities.sanitizeFontFamily( 'arial' ) ).toBe( 'arial' );
		} );
	} );

	describe( 'rectanglesIntersect', () => {
		it( 'should return true for overlapping rectangles', () => {
			const rect1 = { x: 0, y: 0, width: 100, height: 100 };
			const rect2 = { x: 50, y: 50, width: 100, height: 100 };
			expect( CanvasUtilities.rectanglesIntersect( rect1, rect2 ) ).toBe( true );
		} );

		it( 'should return true for contained rectangles', () => {
			const rect1 = { x: 0, y: 0, width: 100, height: 100 };
			const rect2 = { x: 25, y: 25, width: 50, height: 50 };
			expect( CanvasUtilities.rectanglesIntersect( rect1, rect2 ) ).toBe( true );
		} );

		it( 'should return false for non-overlapping rectangles', () => {
			const rect1 = { x: 0, y: 0, width: 50, height: 50 };
			const rect2 = { x: 100, y: 100, width: 50, height: 50 };
			expect( CanvasUtilities.rectanglesIntersect( rect1, rect2 ) ).toBe( false );
		} );

		it( 'should return false for adjacent rectangles (no overlap)', () => {
			const rect1 = { x: 0, y: 0, width: 50, height: 50 };
			const rect2 = { x: 50, y: 0, width: 50, height: 50 };
			expect( CanvasUtilities.rectanglesIntersect( rect1, rect2 ) ).toBe( false );
		} );

		it( 'should handle rectangles with same position', () => {
			const rect1 = { x: 10, y: 10, width: 50, height: 50 };
			const rect2 = { x: 10, y: 10, width: 50, height: 50 };
			expect( CanvasUtilities.rectanglesIntersect( rect1, rect2 ) ).toBe( true );
		} );

		it( 'should handle edge cases with zero dimensions', () => {
			const rect1 = { x: 0, y: 0, width: 0, height: 0 };
			const rect2 = { x: 0, y: 0, width: 100, height: 100 };
			expect( CanvasUtilities.rectanglesIntersect( rect1, rect2 ) ).toBe( false );
		} );
	} );

	describe( 'clamp', () => {
		it( 'should return value when within range', () => {
			expect( CanvasUtilities.clamp( 50, 0, 100 ) ).toBe( 50 );
			expect( CanvasUtilities.clamp( 0, 0, 100 ) ).toBe( 0 );
			expect( CanvasUtilities.clamp( 100, 0, 100 ) ).toBe( 100 );
		} );

		it( 'should clamp to minimum when below', () => {
			expect( CanvasUtilities.clamp( -10, 0, 100 ) ).toBe( 0 );
			expect( CanvasUtilities.clamp( -100, -50, 50 ) ).toBe( -50 );
		} );

		it( 'should clamp to maximum when above', () => {
			expect( CanvasUtilities.clamp( 150, 0, 100 ) ).toBe( 100 );
			expect( CanvasUtilities.clamp( 1000, -50, 50 ) ).toBe( 50 );
		} );

		it( 'should handle negative ranges', () => {
			expect( CanvasUtilities.clamp( 0, -100, -50 ) ).toBe( -50 );
			expect( CanvasUtilities.clamp( -200, -100, -50 ) ).toBe( -100 );
			expect( CanvasUtilities.clamp( -75, -100, -50 ) ).toBe( -75 );
		} );

		it( 'should handle decimal values', () => {
			expect( CanvasUtilities.clamp( 0.5, 0, 1 ) ).toBe( 0.5 );
			expect( CanvasUtilities.clamp( 1.5, 0, 1 ) ).toBe( 1 );
			expect( CanvasUtilities.clamp( -0.5, 0, 1 ) ).toBe( 0 );
		} );
	} );

	describe( 'getCursorForHandle', () => {
		it( 'should return correct cursor for corner handles', () => {
			expect( CanvasUtilities.getCursorForHandle( { type: 'nw' } ) ).toBe( 'nw-resize' );
			expect( CanvasUtilities.getCursorForHandle( { type: 'se' } ) ).toBe( 'nw-resize' );
			expect( CanvasUtilities.getCursorForHandle( { type: 'ne' } ) ).toBe( 'ne-resize' );
			expect( CanvasUtilities.getCursorForHandle( { type: 'sw' } ) ).toBe( 'ne-resize' );
		} );

		it( 'should return correct cursor for edge handles', () => {
			expect( CanvasUtilities.getCursorForHandle( { type: 'n' } ) ).toBe( 'ns-resize' );
			expect( CanvasUtilities.getCursorForHandle( { type: 's' } ) ).toBe( 'ns-resize' );
			expect( CanvasUtilities.getCursorForHandle( { type: 'e' } ) ).toBe( 'ew-resize' );
			expect( CanvasUtilities.getCursorForHandle( { type: 'w' } ) ).toBe( 'ew-resize' );
		} );

		it( 'should return crosshair for rotate handle', () => {
			expect( CanvasUtilities.getCursorForHandle( { type: 'rotate' } ) ).toBe( 'crosshair' );
		} );

		it( 'should return move for unknown handle types', () => {
			expect( CanvasUtilities.getCursorForHandle( { type: 'unknown' } ) ).toBe( 'move' );
			expect( CanvasUtilities.getCursorForHandle( { type: 'center' } ) ).toBe( 'move' );
		} );

		it( 'should return default for null or missing handle', () => {
			expect( CanvasUtilities.getCursorForHandle( null ) ).toBe( 'default' );
			expect( CanvasUtilities.getCursorForHandle( undefined ) ).toBe( 'default' );
			expect( CanvasUtilities.getCursorForHandle( {} ) ).toBe( 'default' );
		} );
	} );

	describe( 'getToolCursor', () => {
		it( 'should return default for pointer tool', () => {
			expect( CanvasUtilities.getToolCursor( 'pointer' ) ).toBe( 'default' );
		} );

		it( 'should return grab for pan tool', () => {
			expect( CanvasUtilities.getToolCursor( 'pan' ) ).toBe( 'grab' );
		} );

		it( 'should return text for text tool', () => {
			expect( CanvasUtilities.getToolCursor( 'text' ) ).toBe( 'text' );
		} );

		it( 'should return crosshair for drawing tools', () => {
			expect( CanvasUtilities.getToolCursor( 'rectangle' ) ).toBe( 'crosshair' );
			expect( CanvasUtilities.getToolCursor( 'circle' ) ).toBe( 'crosshair' );
			expect( CanvasUtilities.getToolCursor( 'ellipse' ) ).toBe( 'crosshair' );
			expect( CanvasUtilities.getToolCursor( 'polygon' ) ).toBe( 'crosshair' );
			expect( CanvasUtilities.getToolCursor( 'star' ) ).toBe( 'crosshair' );
			expect( CanvasUtilities.getToolCursor( 'line' ) ).toBe( 'crosshair' );
			expect( CanvasUtilities.getToolCursor( 'arrow' ) ).toBe( 'crosshair' );
			expect( CanvasUtilities.getToolCursor( 'highlight' ) ).toBe( 'crosshair' );
			expect( CanvasUtilities.getToolCursor( 'path' ) ).toBe( 'crosshair' );
		} );

		it( 'should return crosshair for blur and pen tools', () => {
			expect( CanvasUtilities.getToolCursor( 'blur' ) ).toBe( 'crosshair' );
			expect( CanvasUtilities.getToolCursor( 'pen' ) ).toBe( 'crosshair' );
		} );

		it( 'should return crosshair for unknown tools', () => {
			expect( CanvasUtilities.getToolCursor( 'unknown' ) ).toBe( 'crosshair' );
			expect( CanvasUtilities.getToolCursor( '' ) ).toBe( 'crosshair' );
		} );
	} );

	describe( 'isValidBlendMode', () => {
		it( 'should return true for valid blend modes', () => {
			expect( CanvasUtilities.isValidBlendMode( 'source-over' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'multiply' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'screen' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'overlay' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'darken' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'lighten' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'color-dodge' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'color-burn' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'hard-light' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'soft-light' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'difference' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'exclusion' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'hue' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'saturation' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'color' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'luminosity' ) ).toBe( true );
		} );

		it( 'should return true for source compositing modes', () => {
			expect( CanvasUtilities.isValidBlendMode( 'source-in' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'source-out' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'source-atop' ) ).toBe( true );
		} );

		it( 'should return true for destination compositing modes', () => {
			expect( CanvasUtilities.isValidBlendMode( 'destination-over' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'destination-in' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'destination-out' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'destination-atop' ) ).toBe( true );
		} );

		it( 'should return true for other valid modes', () => {
			expect( CanvasUtilities.isValidBlendMode( 'lighter' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'copy' ) ).toBe( true );
			expect( CanvasUtilities.isValidBlendMode( 'xor' ) ).toBe( true );
		} );

		it( 'should return false for invalid blend modes', () => {
			expect( CanvasUtilities.isValidBlendMode( 'invalid' ) ).toBe( false );
			expect( CanvasUtilities.isValidBlendMode( '' ) ).toBe( false );
			expect( CanvasUtilities.isValidBlendMode( null ) ).toBe( false );
			expect( CanvasUtilities.isValidBlendMode( undefined ) ).toBe( false );
			expect( CanvasUtilities.isValidBlendMode( 'MULTIPLY' ) ).toBe( false ); // case-sensitive
		} );
	} );

	describe( 'calculateAspectFit', () => {
		it( 'should fit wider source into narrower target', () => {
			const result = CanvasUtilities.calculateAspectFit( 200, 100, 100, 100 );
			expect( result.width ).toBe( 100 );
			expect( result.height ).toBe( 50 );
			expect( result.x ).toBe( 0 );
			expect( result.y ).toBe( 25 );
		} );

		it( 'should fit taller source into wider target', () => {
			const result = CanvasUtilities.calculateAspectFit( 100, 200, 100, 100 );
			expect( result.width ).toBe( 50 );
			expect( result.height ).toBe( 100 );
			expect( result.x ).toBe( 25 );
			expect( result.y ).toBe( 0 );
		} );

		it( 'should handle same aspect ratio', () => {
			const result = CanvasUtilities.calculateAspectFit( 200, 100, 100, 50 );
			expect( result.width ).toBe( 100 );
			expect( result.height ).toBe( 50 );
			expect( result.x ).toBe( 0 );
			expect( result.y ).toBe( 0 );
		} );

		it( 'should handle square source in landscape target', () => {
			const result = CanvasUtilities.calculateAspectFit( 100, 100, 200, 100 );
			expect( result.width ).toBe( 100 );
			expect( result.height ).toBe( 100 );
			expect( result.x ).toBe( 50 );
			expect( result.y ).toBe( 0 );
		} );

		it( 'should handle square source in portrait target', () => {
			const result = CanvasUtilities.calculateAspectFit( 100, 100, 100, 200 );
			expect( result.width ).toBe( 100 );
			expect( result.height ).toBe( 100 );
			expect( result.x ).toBe( 0 );
			expect( result.y ).toBe( 50 );
		} );

		it( 'should center the fitted image', () => {
			const result = CanvasUtilities.calculateAspectFit( 400, 300, 100, 100 );
			// 400x300 has aspect 4:3, fitting to 100x100 gives 100x75
			expect( result.width ).toBe( 100 );
			expect( result.height ).toBeCloseTo( 75 );
			expect( result.x ).toBe( 0 );
			expect( result.y ).toBeCloseTo( 12.5 );
		} );
	} );

	describe( 'deepClone', () => {
		it( 'should clone primitive values', () => {
			expect( CanvasUtilities.deepClone( 42 ) ).toBe( 42 );
			expect( CanvasUtilities.deepClone( 'hello' ) ).toBe( 'hello' );
			expect( CanvasUtilities.deepClone( true ) ).toBe( true );
			expect( CanvasUtilities.deepClone( null ) ).toBe( null );
		} );

		it( 'should clone arrays', () => {
			const original = [ 1, 2, 3 ];
			const cloned = CanvasUtilities.deepClone( original );
			expect( cloned ).toEqual( [ 1, 2, 3 ] );
			expect( cloned ).not.toBe( original );

			// Verify independence
			cloned.push( 4 );
			expect( original ).toEqual( [ 1, 2, 3 ] );
		} );

		it( 'should clone objects', () => {
			const original = { a: 1, b: 2 };
			const cloned = CanvasUtilities.deepClone( original );
			expect( cloned ).toEqual( { a: 1, b: 2 } );
			expect( cloned ).not.toBe( original );

			// Verify independence
			cloned.c = 3;
			expect( original ).toEqual( { a: 1, b: 2 } );
		} );

		it( 'should deep clone nested objects', () => {
			const original = { a: { b: { c: 1 } } };
			const cloned = CanvasUtilities.deepClone( original );
			expect( cloned ).toEqual( { a: { b: { c: 1 } } } );
			expect( cloned.a ).not.toBe( original.a );
			expect( cloned.a.b ).not.toBe( original.a.b );

			// Verify deep independence
			cloned.a.b.c = 999;
			expect( original.a.b.c ).toBe( 1 );
		} );

		it( 'should deep clone arrays with objects', () => {
			const original = [ { x: 1 }, { x: 2 } ];
			const cloned = CanvasUtilities.deepClone( original );
			expect( cloned ).toEqual( [ { x: 1 }, { x: 2 } ] );
			expect( cloned[ 0 ] ).not.toBe( original[ 0 ] );

			// Verify independence
			cloned[ 0 ].x = 999;
			expect( original[ 0 ].x ).toBe( 1 );
		} );

		it( 'should clone layer-like objects', () => {
			const layer = {
				id: 'layer-1',
				type: 'rectangle',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				fill: '#ff0000',
				stroke: '#000000',
				visible: true,
				locked: false,
				points: [ { x: 0, y: 0 }, { x: 10, y: 10 } ]
			};
			const cloned = CanvasUtilities.deepClone( layer );
			expect( cloned ).toEqual( layer );
			expect( cloned ).not.toBe( layer );
			expect( cloned.points ).not.toBe( layer.points );
			expect( cloned.points[ 0 ] ).not.toBe( layer.points[ 0 ] );
		} );

		it( 'should handle empty objects and arrays', () => {
			expect( CanvasUtilities.deepClone( {} ) ).toEqual( {} );
			expect( CanvasUtilities.deepClone( [] ) ).toEqual( [] );
		} );

		it( 'should only clone own properties', () => {
			function Parent() {
				this.inherited = 'value';
			}
			Parent.prototype.protoMethod = function () {};

			const child = new Parent();
			child.own = 'ownValue';

			const cloned = CanvasUtilities.deepClone( child );
			expect( cloned.inherited ).toBe( 'value' );
			expect( cloned.own ).toBe( 'ownValue' );
			expect( cloned.protoMethod ).toBeUndefined();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export CanvasUtilities', () => {
			expect( CanvasUtilities ).toBeDefined();
			expect( typeof CanvasUtilities ).toBe( 'function' );
		} );

		it( 'should have all static methods', () => {
			expect( typeof CanvasUtilities.sanitizeNumber ).toBe( 'function' );
			expect( typeof CanvasUtilities.sanitizeColor ).toBe( 'function' );
			expect( typeof CanvasUtilities.sanitizeFontFamily ).toBe( 'function' );
			expect( typeof CanvasUtilities.rectanglesIntersect ).toBe( 'function' );
			expect( typeof CanvasUtilities.clamp ).toBe( 'function' );
			expect( typeof CanvasUtilities.getCursorForHandle ).toBe( 'function' );
			expect( typeof CanvasUtilities.getToolCursor ).toBe( 'function' );
			expect( typeof CanvasUtilities.isValidBlendMode ).toBe( 'function' );
			expect( typeof CanvasUtilities.calculateAspectFit ).toBe( 'function' );
			expect( typeof CanvasUtilities.deepClone ).toBe( 'function' );
		} );
	} );
} );
