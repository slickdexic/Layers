/**
 * Unit tests for EffectsRenderer
 */
const EffectsRenderer = require( '../../resources/ext.layers.shared/EffectsRenderer.js' );

describe( 'EffectsRenderer', () => {
	let mockCtx;
	let renderer;

	beforeEach( () => {
		mockCtx = {
			save: jest.fn(),
			restore: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			fillRect: jest.fn(),
			rect: jest.fn(),
			beginPath: jest.fn(),
			clip: jest.fn(),
			drawImage: jest.fn(),
			getContext: jest.fn(),
			globalAlpha: 1,
			fillStyle: '',
			filter: 'none'
		};
		renderer = new EffectsRenderer( mockCtx );
	} );

	describe( 'constructor', () => {
		it( 'should create instance with context', () => {
			expect( renderer ).toBeInstanceOf( EffectsRenderer );
			expect( renderer.ctx ).toBe( mockCtx );
		} );

		it( 'should accept config options', () => {
			const canvas = { width: 800, height: 600 };
			const backgroundImage = { complete: true, naturalWidth: 800, naturalHeight: 600 };
			const r = new EffectsRenderer( mockCtx, {
				canvas: canvas,
				backgroundImage: backgroundImage,
				baseWidth: 1600,
				baseHeight: 1200
			} );
			expect( r.canvas ).toBe( canvas );
			expect( r.backgroundImage ).toBe( backgroundImage );
			expect( r.baseWidth ).toBe( 1600 );
			expect( r.baseHeight ).toBe( 1200 );
		} );

		it( 'should handle missing config', () => {
			const r = new EffectsRenderer( mockCtx );
			expect( r.canvas ).toBeNull();
			expect( r.backgroundImage ).toBeNull();
			expect( r.baseWidth ).toBeNull();
			expect( r.baseHeight ).toBeNull();
		} );
	} );

	describe( 'setContext', () => {
		it( 'should update the context', () => {
			const newCtx = { save: jest.fn() };
			renderer.setContext( newCtx );
			expect( renderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'setBackgroundImage', () => {
		it( 'should update the background image', () => {
			const img = { complete: true };
			renderer.setBackgroundImage( img );
			expect( renderer.backgroundImage ).toBe( img );
		} );
	} );

	describe( 'setBaseDimensions', () => {
		it( 'should update base dimensions', () => {
			renderer.setBaseDimensions( 1920, 1080 );
			expect( renderer.baseWidth ).toBe( 1920 );
			expect( renderer.baseHeight ).toBe( 1080 );
		} );
	} );

	describe( 'getScaleFactors', () => {
		it( 'should return 1:1 when no canvas or base dimensions', () => {
			const scale = renderer.getScaleFactors();
			expect( scale ).toEqual( { sx: 1, sy: 1, avg: 1 } );
		} );

		it( 'should calculate scale factors from canvas and base dimensions', () => {
			renderer.canvas = { width: 400, height: 300 };
			renderer.baseWidth = 800;
			renderer.baseHeight = 600;
			const scale = renderer.getScaleFactors();
			expect( scale.sx ).toBe( 0.5 );
			expect( scale.sy ).toBe( 0.5 );
			expect( scale.avg ).toBe( 0.5 );
		} );

		it( 'should handle non-uniform scaling', () => {
			renderer.canvas = { width: 400, height: 600 };
			renderer.baseWidth = 800;
			renderer.baseHeight = 600;
			const scale = renderer.getScaleFactors();
			expect( scale.sx ).toBe( 0.5 );
			expect( scale.sy ).toBe( 1 );
			expect( scale.avg ).toBe( 0.75 );
		} );
	} );

	describe( 'drawHighlight', () => {
		it( 'should draw highlight with default values', () => {
			renderer.drawHighlight( {} );
			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.fillRect ).toHaveBeenCalledWith( 0, 0, 100, 20 );
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		it( 'should use layer dimensions', () => {
			renderer.drawHighlight( { x: 10, y: 20, width: 200, height: 40 } );
			expect( mockCtx.fillRect ).toHaveBeenCalledWith( 10, 20, 200, 40 );
		} );

		it( 'should use layer color', () => {
			renderer.drawHighlight( { color: '#ff0000' } );
			expect( mockCtx.fillStyle ).toBe( '#ff0000' );
		} );

		it( 'should use layer fill as fallback color', () => {
			renderer.drawHighlight( { fill: '#00ff00' } );
			expect( mockCtx.fillStyle ).toBe( '#00ff00' );
		} );

		it( 'should default to yellow color', () => {
			renderer.drawHighlight( {} );
			expect( mockCtx.fillStyle ).toBe( '#ffff00' );
		} );

		it( 'should apply layer opacity', () => {
			renderer.drawHighlight( { opacity: 0.5 } );
			expect( mockCtx.globalAlpha ).toBe( 0.5 );
		} );

		it( 'should apply fillOpacity as fallback', () => {
			renderer.drawHighlight( { fillOpacity: 0.7 } );
			expect( mockCtx.globalAlpha ).toBe( 0.7 );
		} );

		it( 'should default to 0.3 opacity', () => {
			renderer.drawHighlight( {} );
			expect( mockCtx.globalAlpha ).toBe( 0.3 );
		} );

		it( 'should clamp opacity to valid range', () => {
			renderer.drawHighlight( { opacity: 1.5 } );
			expect( mockCtx.globalAlpha ).toBe( 1 );
			renderer.drawHighlight( { opacity: -0.5 } );
			expect( mockCtx.globalAlpha ).toBe( 0 );
		} );

		it( 'should handle rotation', () => {
			renderer.drawHighlight( {
				x: 100, y: 100,
				width: 200, height: 40,
				rotation: 45
			} );
			expect( mockCtx.translate ).toHaveBeenCalledWith( 200, 120 ); // center
			expect( mockCtx.rotate ).toHaveBeenCalled();
		} );

		it( 'should skip rotation for 0 degrees', () => {
			renderer.drawHighlight( {
				x: 100, y: 100,
				width: 200, height: 40,
				rotation: 0
			} );
			expect( mockCtx.translate ).not.toHaveBeenCalled();
			expect( mockCtx.rotate ).not.toHaveBeenCalled();
		} );

		it( 'should handle NaN opacity', () => {
			renderer.drawHighlight( { opacity: NaN } );
			expect( mockCtx.globalAlpha ).toBe( 0.3 );
		} );
	} );

	describe( 'drawBlur', () => {
		it( 'should skip for zero dimensions', () => {
			renderer.drawBlur( { width: 0, height: 100 } );
			expect( mockCtx.save ).not.toHaveBeenCalled();

			renderer.drawBlur( { width: 100, height: 0 } );
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		it( 'should skip for negative dimensions', () => {
			renderer.drawBlur( { width: -10, height: 100 } );
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		it( 'should draw gray fallback when no image available', () => {
			renderer.drawBlur( {
				x: 10, y: 20,
				width: 100, height: 50
			} );
			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.fillStyle ).toBe( 'rgba(128, 128, 128, 0.5)' );
			expect( mockCtx.fillRect ).toHaveBeenCalledWith( 10, 20, 100, 50 );
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		it( 'should respect scaled option', () => {
			renderer.canvas = { width: 400, height: 300 };
			renderer.baseWidth = 800;
			renderer.baseHeight = 600;
			renderer.drawBlur( { x: 100, y: 100, width: 200, height: 100 }, { scaled: true } );
			// When scaled, coordinates should NOT be multiplied by scale factors
			expect( mockCtx.fillRect ).toHaveBeenCalledWith( 100, 100, 200, 100 );
		} );

		it( 'should scale coordinates when not pre-scaled', () => {
			renderer.canvas = { width: 400, height: 300 };
			renderer.baseWidth = 800;
			renderer.baseHeight = 600;
			renderer.drawBlur( { x: 100, y: 100, width: 200, height: 100 } );
			// Scale factor is 0.5, so coordinates should be halved
			expect( mockCtx.fillRect ).toHaveBeenCalledWith( 50, 50, 100, 50 );
		} );

		it( 'should clamp blur radius to valid range', () => {
			// blurRadius is internal to the method; we can only verify it doesn't crash
			renderer.drawBlur( { x: 0, y: 0, width: 100, height: 100, blurRadius: 0 } );
			expect( mockCtx.save ).toHaveBeenCalled();

			renderer.drawBlur( { x: 0, y: 0, width: 100, height: 100, blurRadius: 100 } );
			expect( mockCtx.save ).toHaveBeenCalled();
		} );

		it( 'should use default blur radius of 12', () => {
			renderer.drawBlur( { x: 0, y: 0, width: 100, height: 100 } );
			// Blur radius is used internally; test that it doesn't crash
			expect( mockCtx.save ).toHaveBeenCalled();
		} );

		it( 'should clip and blur when background image available but no external imageElement', () => {
			// When there's no imageElement option but backgroundImage exists,
			// it still goes through the temp canvas path first because
			// imgSource = opts.imageElement || this.backgroundImage
			// So we need to make the temp canvas path work
			const mockTempCtx = {
				drawImage: jest.fn()
			};
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			renderer.backgroundImage = {
				complete: true,
				naturalWidth: 800,
				naturalHeight: 600,
				width: 800,
				height: 600
			};
			renderer.canvas = { width: 800, height: 600 };
			renderer.drawBlur( { x: 10, y: 20, width: 100, height: 50 } );

			// Should have used temp canvas approach
			expect( document.createElement ).toHaveBeenCalledWith( 'canvas' );
			expect( mockTempCtx.drawImage ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );

		it( 'should use imageElement from options if provided', () => {
			// Create canvas mock that returns a proper context
			const mockTempCtx = {
				drawImage: jest.fn()
			};
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			const imageElement = {
				complete: true,
				naturalWidth: 400,
				naturalHeight: 300
			};
			renderer.canvas = { width: 400, height: 300 };
			renderer.drawBlur(
				{ x: 10, y: 20, width: 100, height: 50 },
				{ imageElement: imageElement }
			);
			expect( mockTempCtx.drawImage ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );

		it( 'should handle incomplete background image', () => {
			renderer.backgroundImage = { complete: false };
			renderer.drawBlur( { x: 10, y: 20, width: 100, height: 50 } );
			// Should fall back to gray overlay
			expect( mockCtx.fillStyle ).toBe( 'rgba(128, 128, 128, 0.5)' );
		} );
	} );
} );
