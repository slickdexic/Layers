/**
 * Unit tests for LayerDefaults
 */

describe( 'LayerDefaults', () => {
	let LayerDefaults;

	beforeEach( () => {
		jest.resetModules();

		global.mw = {
			ext: { layers: {} }
		};

		LayerDefaults = require( '../../resources/ext.layers.shared/LayerDefaults.js' );
	} );

	afterEach( () => {
		delete global.mw;
	} );

	describe( 'Text Defaults', () => {
		it( 'should have FONT_SIZE as a number', () => {
			expect( typeof LayerDefaults.FONT_SIZE ).toBe( 'number' );
			expect( LayerDefaults.FONT_SIZE ).toBe( 16 );
		} );

		it( 'should have MAX_FONT_SIZE', () => {
			expect( LayerDefaults.MAX_FONT_SIZE ).toBe( 1000 );
		} );

		it( 'should have FONT_FAMILY as a string', () => {
			expect( typeof LayerDefaults.FONT_FAMILY ).toBe( 'string' );
			expect( LayerDefaults.FONT_FAMILY ).toBe( 'Arial, sans-serif' );
		} );
	} );

	describe( 'Stroke Defaults', () => {
		it( 'should have STROKE_WIDTH', () => {
			expect( LayerDefaults.STROKE_WIDTH ).toBe( 2 );
		} );

		it( 'should have STROKE_COLOR', () => {
			expect( LayerDefaults.STROKE_COLOR ).toBe( '#000000' );
		} );

		it( 'should have MAX_STROKE_WIDTH', () => {
			expect( LayerDefaults.MAX_STROKE_WIDTH ).toBe( 50 );
		} );
	} );

	describe( 'Opacity Defaults', () => {
		it( 'should have OPACITY as 1', () => {
			expect( LayerDefaults.OPACITY ).toBe( 1 );
		} );

		it( 'should have FILL_OPACITY as 1', () => {
			expect( LayerDefaults.FILL_OPACITY ).toBe( 1 );
		} );
	} );

	describe( 'Shadow Defaults', () => {
		it( 'should have shadow properties', () => {
			expect( LayerDefaults.SHADOW_BLUR ).toBe( 8 );
			expect( LayerDefaults.MAX_SHADOW_BLUR ).toBe( 64 );
			expect( LayerDefaults.SHADOW_OFFSET_X ).toBe( 2 );
			expect( LayerDefaults.SHADOW_OFFSET_Y ).toBe( 2 );
			expect( LayerDefaults.SHADOW_COLOR ).toBe( '#000000' );
			expect( LayerDefaults.MAX_SHADOW_SPREAD ).toBe( 50 );
			expect( LayerDefaults.MAX_TEXT_SHADOW_BLUR ).toBe( 50 );
		} );
	} );

	describe( 'Slide Dimension Limits', () => {
		it( 'should have dimension limits', () => {
			expect( LayerDefaults.MIN_SLIDE_DIMENSION ).toBe( 50 );
			expect( LayerDefaults.MAX_SLIDE_DIMENSION ).toBe( 4096 );
		} );
	} );

	describe( 'Cache and History Limits', () => {
		it( 'should have cache and history limits', () => {
			expect( LayerDefaults.MAX_HISTORY_SIZE ).toBe( 50 );
			expect( LayerDefaults.MAX_IMAGE_CACHE_SIZE ).toBe( 50 );
		} );
	} );

	describe( 'Text Length Limits', () => {
		it( 'should have text length limits', () => {
			expect( LayerDefaults.MAX_TEXT_LENGTH ).toBe( 1000 );
			expect( LayerDefaults.MAX_TEXTAREA_LENGTH ).toBe( 5000 );
		} );
	} );

	describe( 'Default Colors', () => {
		it( 'should have color defaults', () => {
			expect( LayerDefaults.FILL_COLOR ).toBe( 'transparent' );
			expect( LayerDefaults.TEXT_STROKE_COLOR ).toBe( '#000000' );
		} );
	} );

	describe( 'Animation/Timing', () => {
		it( 'should have timing constants', () => {
			expect( LayerDefaults.FRAME_INTERVAL_60FPS ).toBe( 16 );
			expect( LayerDefaults.AUTO_SAVE_DEBOUNCE ).toBe( 2000 );
		} );
	} );

	describe( 'Immutability', () => {
		it( 'should be frozen (immutable)', () => {
			expect( Object.isFrozen( LayerDefaults ) ).toBe( true );
		} );

		it( 'should not allow adding new properties', () => {
			LayerDefaults.NEW_PROP = 'test';
			expect( LayerDefaults.NEW_PROP ).toBeUndefined();
		} );

		it( 'should not allow modifying existing properties', () => {
			LayerDefaults.FONT_SIZE = 999;
			expect( LayerDefaults.FONT_SIZE ).toBe( 16 );
		} );
	} );

	describe( 'Export', () => {
		it( 'should be exported to mw.ext.layers namespace', () => {
			expect( global.mw.ext.layers.LayerDefaults ).toBe( LayerDefaults );
		} );
	} );
} );
