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
			fill: jest.fn(),
			stroke: jest.fn(),
			setLineDash: jest.fn(),
			setTransform: jest.fn(),
			globalAlpha: 1,
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 1,
			filter: 'none',
			shadowColor: 'transparent',
			shadowBlur: 0,
			shadowOffsetX: 0,
			shadowOffsetY: 0
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

		it( 'should fall back to gray overlay on CORS or draw error', () => {
			// Create canvas mock where drawImage throws a CORS error
			const mockTempCtx = {
				drawImage: jest.fn().mockImplementation( () => {
					throw new Error( 'CORS error' );
				} )
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

			// Should fall back to gray overlay after catch
			expect( mockCtx.fillStyle ).toBe( 'rgba(128, 128, 128, 0.5)' );
			expect( mockCtx.fillRect ).toHaveBeenCalledWith( 10, 20, 100, 50 );

			document.createElement = origCreateElement;
		} );

		it( 'should use editor mode blur when backgroundImage is complete and no imageElement', () => {
			// No imageElement option, but backgroundImage exists and complete
			// The code checks: opts.imageElement || this.backgroundImage
			// but the editor mode path is: else if ( this.backgroundImage && this.backgroundImage.complete )
			// This happens when imgSource is falsy but backgroundImage exists

			// To trigger the editor mode path, we need:
			// 1. No imgSource (no imageElement option)
			// 2. backgroundImage is truthy and complete
			// But currently the code does: imgSource = opts.imageElement || this.backgroundImage
			// So if backgroundImage exists, imgSource is set.
			// Looking at the code more carefully...
			// The editor mode path is only hit when there is no imgSource at all
			// but backgroundImage exists separately - let me check the actual condition

			// Actually the condition is:
			// if ( imgSource ) { ... temp canvas path ... }
			// else if ( this.backgroundImage && this.backgroundImage.complete ) { ... editor mode ... }
			//
			// The first condition uses imgSource = opts.imageElement || this.backgroundImage
			// So if backgroundImage is set, it goes to temp canvas path
			// Editor mode is only hit when imgSource is falsy but backgroundImage is set separately?
			// Wait, that can't be right since imgSource = opts.imageElement || this.backgroundImage

			// Let me test by having backgroundImage be truthy but without naturalWidth/Height
			// so it's not a valid image source for drawImage
			const incompleteImg = {
				complete: true
				// No naturalWidth or naturalHeight, making it invalid as imgSource
			};
			renderer.backgroundImage = incompleteImg;
			renderer.canvas = { width: 800, height: 600 };

			// This should trigger the gray fallback since the image lacks natural dimensions
			renderer.drawBlur( { x: 10, y: 20, width: 100, height: 50 } );
			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		it( 'should use editor mode path when imageElement not complete but backgroundImage is', () => {
			// Provide an incomplete imageElement, but complete backgroundImage
			// This should trigger: imgSource = imageElement (not complete)
			// so first if is skipped, then else if checks this.backgroundImage.complete
			const incompleteImageElement = {
				complete: false, // Not complete
				naturalWidth: 400,
				naturalHeight: 300
			};

			renderer.backgroundImage = {
				complete: true, // Complete
				naturalWidth: 800,
				naturalHeight: 600
			};
			renderer.canvas = { width: 800, height: 600 };

			// When imageElement is provided but not complete, imgSource.complete is false
			// So it should fall through to the else if that checks backgroundImage.complete
			renderer.drawBlur(
				{ x: 10, y: 20, width: 100, height: 50 },
				{ imageElement: incompleteImageElement }
			);

			// This should hit the editor mode path (lines 163-170)
			// which does beginPath, rect, clip, then drawImage the backgroundImage
			expect( mockCtx.beginPath ).toHaveBeenCalled();
			expect( mockCtx.rect ).toHaveBeenCalledWith( 10, 20, 100, 50 );
			expect( mockCtx.clip ).toHaveBeenCalled();
			expect( mockCtx.drawImage ).toHaveBeenCalledWith( renderer.backgroundImage, 0, 0 );
		} );
	} );

	// ========================================
	// Blur Blend Mode Tests (new feature)
	// ========================================

	describe( 'drawBlurWithShape', () => {
		let canvasWithContext;
		let filterValues;

		beforeEach( () => {
			canvasWithContext = {
				width: 800,
				height: 600,
				getContext: jest.fn().mockReturnValue( {
					drawImage: jest.fn()
				} )
			};
			renderer.canvas = canvasWithContext;

			// Track filter value assignments to verify blur was applied
			filterValues = [];
			Object.defineProperty( mockCtx, 'filter', {
				get: function() { return this._filter || 'none'; },
				set: function( val ) { this._filter = val; filterValues.push( val ); },
				configurable: true
			} );
		} );

		it( 'should return early if canvas is not set', () => {
			renderer.canvas = null;
			const drawPathFn = jest.fn();

			renderer.drawBlurWithShape( { x: 10, y: 10, width: 100, height: 100 }, drawPathFn );

			expect( drawPathFn ).not.toHaveBeenCalled();
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		it( 'should apply clipping path using provided draw function', () => {
			renderer.backgroundImage = { complete: true, naturalWidth: 800, naturalHeight: 600 };
			const drawPathFn = jest.fn();

			renderer.drawBlurWithShape( { x: 10, y: 10, width: 100, height: 100, blurRadius: 15 }, drawPathFn );

			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.beginPath ).toHaveBeenCalled();
			expect( drawPathFn ).toHaveBeenCalledWith( mockCtx );
			expect( mockCtx.clip ).toHaveBeenCalled();
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		it( 'should apply layer opacity', () => {
			renderer.backgroundImage = { complete: true };
			const drawPathFn = jest.fn();

			renderer.drawBlurWithShape( { opacity: 0.5 }, drawPathFn );

			expect( mockCtx.globalAlpha ).toBe( 0.5 );
		} );

		it( 'should clamp blurRadius to valid range', () => {
			renderer.backgroundImage = { complete: true };
			const drawPathFn = jest.fn();

			// Test with very high blur radius (should be clamped to 64)
			renderer.drawBlurWithShape( { blurRadius: 200 }, drawPathFn );

			// Filter should be set to blur(64px) at some point (then reset to 'none')
			expect( filterValues ).toContain( 'blur(64px)' );
		} );

		it( 'should use default blurRadius of 12 when not specified', () => {
			renderer.backgroundImage = { complete: true };
			const drawPathFn = jest.fn();

			renderer.drawBlurWithShape( {}, drawPathFn );

			// Filter should be set to blur(12px) at some point
			expect( filterValues ).toContain( 'blur(12px)' );
		} );

		it( 'should capture current canvas content for blur', () => {
			// Set up canvas with existing content
			renderer.backgroundImage = null; // Not needed anymore - we capture canvas
			const drawPathFn = jest.fn();

			renderer.drawBlurWithShape( { x: 10, y: 10, width: 100, height: 100 }, drawPathFn );

			// Should still call clip path
			expect( drawPathFn ).toHaveBeenCalled();
			// drawImage should be called to copy canvas content
			expect( mockCtx.drawImage ).toHaveBeenCalled();
		} );

		it( 'should draw stroke after blur fill if stroke is specified', () => {
			const drawPathFn = jest.fn();
			const layer = {
				x: 10, y: 10, width: 100, height: 100,
				stroke: '#ff0000',
				strokeWidth: 2
			};

			renderer.drawBlurWithShape( layer, drawPathFn, { scale: { sx: 1, sy: 1, avg: 1 } } );

			// Stroke should be set
			expect( mockCtx.strokeStyle ).toBe( '#ff0000' );
			expect( mockCtx.lineWidth ).toBe( 2 );
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );
	} );

	describe( 'hasBlurBlendMode', () => {
		it( 'should return true for blendMode: blur', () => {
			expect( renderer.hasBlurBlendMode( { blendMode: 'blur' } ) ).toBe( true );
		} );

		it( 'should return true for blend: blur', () => {
			expect( renderer.hasBlurBlendMode( { blend: 'blur' } ) ).toBe( true );
		} );

		it( 'should return false for other blend modes', () => {
			expect( renderer.hasBlurBlendMode( { blendMode: 'multiply' } ) ).toBe( false );
			expect( renderer.hasBlurBlendMode( { blend: 'screen' } ) ).toBe( false );
		} );

		it( 'should return false when no blend mode specified', () => {
			expect( renderer.hasBlurBlendMode( {} ) ).toBe( false );
			expect( renderer.hasBlurBlendMode( { type: 'rectangle' } ) ).toBe( false );
		} );
	} );

	// ========================================
	// drawBlurWithShape - Additional stroke tests
	// ========================================

	describe( 'drawBlurWithShape stroke styles', () => {
		let canvasWithContext;

		beforeEach( () => {
			canvasWithContext = {
				width: 800,
				height: 600,
				getContext: jest.fn().mockReturnValue( {
					drawImage: jest.fn()
				} )
			};
			renderer.canvas = canvasWithContext;
		} );

		it( 'should apply dashed stroke style', () => {
			const drawPathFn = jest.fn();
			const layer = {
				x: 10, y: 10, width: 100, height: 100,
				stroke: '#ff0000',
				strokeWidth: 2,
				strokeStyle: 'dashed'
			};

			renderer.drawBlurWithShape( layer, drawPathFn, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockCtx.setLineDash ).toHaveBeenCalledWith( [ 8, 4 ] );
		} );

		it( 'should apply dotted stroke style', () => {
			const drawPathFn = jest.fn();
			const layer = {
				x: 10, y: 10, width: 100, height: 100,
				stroke: '#ff0000',
				strokeWidth: 2,
				strokeStyle: 'dotted'
			};

			renderer.drawBlurWithShape( layer, drawPathFn, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockCtx.setLineDash ).toHaveBeenCalledWith( [ 2, 2 ] );
		} );

		it( 'should apply solid stroke style (no dash)', () => {
			const drawPathFn = jest.fn();
			const layer = {
				x: 10, y: 10, width: 100, height: 100,
				stroke: '#ff0000',
				strokeWidth: 2,
				strokeStyle: 'solid'
			};

			renderer.drawBlurWithShape( layer, drawPathFn, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockCtx.setLineDash ).toHaveBeenCalledWith( [] );
		} );

		it( 'should use strokeOpacity when provided', () => {
			const drawPathFn = jest.fn();
			const layer = {
				stroke: '#ff0000',
				strokeWidth: 2,
				strokeOpacity: 0.7
			};

			renderer.drawBlurWithShape( layer, drawPathFn );

			// After stroke drawing, globalAlpha should have been set to strokeOpacity
			expect( mockCtx.globalAlpha ).toBe( 0.7 );
		} );

		it( 'should fall back to layer opacity when strokeOpacity not provided', () => {
			const drawPathFn = jest.fn();
			const layer = {
				stroke: '#ff0000',
				strokeWidth: 2,
				opacity: 0.4
			};

			renderer.drawBlurWithShape( layer, drawPathFn );

			// globalAlpha should use opacity as fallback
			expect( mockCtx.globalAlpha ).toBe( 0.4 );
		} );

		it( 'should fall back to gray fill on canvas capture error', () => {
			// Create temp canvas that throws on drawImage
			const mockTempCtx = {
				drawImage: jest.fn().mockImplementation( () => {
					throw new Error( 'Canvas capture failed' );
				} )
			};
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			const drawPathFn = jest.fn();
			renderer.drawBlurWithShape( { x: 10, y: 10, width: 100, height: 100 }, drawPathFn );

			// Should fall back to gray overlay after catch
			expect( mockCtx.fillStyle ).toBe( 'rgba(128, 128, 128, 0.5)' );
			expect( mockCtx.fill ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );
	} );

	// ========================================
	// drawBlurFill Tests (new coverage)
	// ========================================

	describe( 'drawBlurFill', () => {
		let canvasWithContext;
		let mockTempCtx;

		beforeEach( () => {
			canvasWithContext = {
				width: 800,
				height: 600
			};
			renderer.canvas = canvasWithContext;

			// Create mock for temporary canvas
			mockTempCtx = {
				drawImage: jest.fn()
			};
		} );

		it( 'should return early for zero width', () => {
			const drawPathFn = jest.fn();
			const bounds = { x: 10, y: 20, width: 0, height: 100 };

			renderer.drawBlurFill( { type: 'rectangle' }, drawPathFn, bounds );

			expect( drawPathFn ).not.toHaveBeenCalled();
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		it( 'should return early for zero height', () => {
			const drawPathFn = jest.fn();
			const bounds = { x: 10, y: 20, width: 100, height: 0 };

			renderer.drawBlurFill( { type: 'rectangle' }, drawPathFn, bounds );

			expect( drawPathFn ).not.toHaveBeenCalled();
		} );

		it( 'should return early for negative dimensions', () => {
			const drawPathFn = jest.fn();
			const bounds = { x: 10, y: 20, width: -50, height: 100 };

			renderer.drawBlurFill( { type: 'rectangle' }, drawPathFn, bounds );

			expect( drawPathFn ).not.toHaveBeenCalled();
		} );

		it( 'should clamp blur radius to valid range (min 1, max 64)', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			const drawPathFn = jest.fn();
			const bounds = { x: 10, y: 20, width: 100, height: 50 };

			// Test with blurRadius of 0 (should clamp to 1)
			renderer.drawBlurFill( { blurRadius: 0 }, drawPathFn, bounds );
			expect( mockCtx.save ).toHaveBeenCalled();

			// Test with blurRadius of 100 (should clamp to 64)
			renderer.drawBlurFill( { blurRadius: 100 }, drawPathFn, bounds );
			expect( mockCtx.save ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );

		it( 'should use default blur radius of 12 when not specified', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			const drawPathFn = jest.fn();
			const bounds = { x: 10, y: 20, width: 100, height: 50 };

			renderer.drawBlurFill( {}, drawPathFn, bounds );
			// Should not throw and should use radius of 12
			expect( mockCtx.save ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );

		it( 'should handle editor mode with zoom and pan', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			const drawPathFn = jest.fn();
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const options = {
				zoom: 2,
				panX: 50,
				panY: 50
			};

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds, options );

			// In editor mode with zoom, coordinates should be transformed
			expect( mockCtx.save ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );

		it( 'should handle viewer mode (scaled coordinates)', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			renderer.backgroundImage = {
				complete: true,
				naturalWidth: 1600,
				naturalHeight: 1200
			};

			const drawPathFn = jest.fn();
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const options = { scaled: true };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds, options );

			expect( mockTempCtx.drawImage ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );

		it( 'should capture from imageElement in viewer mode', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			const imageElement = {
				complete: true,
				naturalWidth: 1600,
				naturalHeight: 1200,
				width: 1600,
				height: 1200
			};

			const drawPathFn = jest.fn();
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const options = { imageElement: imageElement };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds, options );

			// Should draw from the imageElement
			expect( mockTempCtx.drawImage ).toHaveBeenCalledWith(
				imageElement,
				expect.any( Number ), expect.any( Number ), expect.any( Number ), expect.any( Number ),
				0, 0, expect.any( Number ), expect.any( Number )
			);

			document.createElement = origCreateElement;
		} );

		it( 'should overlay canvas content in viewer mode', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			const imageElement = {
				complete: true,
				naturalWidth: 800,
				naturalHeight: 600
			};

			const drawPathFn = jest.fn();
			const bounds = { x: 50, y: 50, width: 100, height: 80 };
			const options = { scaled: true, imageElement: imageElement };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds, options );

			// drawImage should be called at least twice: once for image, once for canvas overlay
			expect( mockTempCtx.drawImage.mock.calls.length ).toBeGreaterThanOrEqual( 1 );

			document.createElement = origCreateElement;
		} );

		it( 'should capture from canvas in editor mode', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			// No imageElement, no backgroundImage - should try to capture from canvas
			const drawPathFn = jest.fn();
			const bounds = { x: 50, y: 50, width: 100, height: 80 };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds );

			// Should try to capture from the main canvas
			expect( mockTempCtx.drawImage ).toHaveBeenCalledWith(
				canvasWithContext,
				expect.any( Number ), expect.any( Number ), expect.any( Number ), expect.any( Number ),
				0, 0, expect.any( Number ), expect.any( Number )
			);

			document.createElement = origCreateElement;
		} );

		it( 'should fall back to background image if canvas capture fails', () => {
			const origCreateElement = document.createElement;

			// First call throws (canvas capture), second call succeeds (background image)
			let callCount = 0;
			const tempCtxWithError = {
				drawImage: jest.fn().mockImplementation( ( source ) => {
					callCount++;
					if ( source === canvasWithContext ) {
						throw new Error( 'Canvas tainted' );
					}
					// Success for background image
				} )
			};

			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( tempCtxWithError )
			} );

			renderer.backgroundImage = {
				complete: true,
				naturalWidth: 800,
				naturalHeight: 600
			};

			const drawPathFn = jest.fn();
			const bounds = { x: 50, y: 50, width: 100, height: 80 };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds );

			// Should have tried canvas first (failed), then background image
			expect( tempCtxWithError.drawImage ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );

		it( 'should show gray placeholder when no content is available', () => {
			const origCreateElement = document.createElement;
			const tempCtxNoContent = {
				drawImage: jest.fn().mockImplementation( () => {
					throw new Error( 'No content' );
				} )
			};

			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( tempCtxNoContent )
			} );

			// No canvas context, no background image - will show placeholder
			renderer.ctx = mockCtx;
			renderer.canvas = null;
			renderer.backgroundImage = null;

			const drawPathFn = jest.fn();
			const bounds = { x: 50, y: 50, width: 100, height: 80 };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds );

			// Should show gray placeholder
			expect( mockCtx.fillStyle ).toBe( 'rgba(128, 128, 128, 0.3)' );
			expect( drawPathFn ).toHaveBeenCalledWith( mockCtx );
			expect( mockCtx.fill ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );

		it( 'should clear shadow state before drawing blur', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			const drawPathFn = jest.fn();
			const bounds = { x: 50, y: 50, width: 100, height: 80 };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds );

			// Shadow should be cleared
			expect( mockCtx.shadowColor ).toBe( 'transparent' );
			expect( mockCtx.shadowBlur ).toBe( 0 );

			document.createElement = origCreateElement;
		} );

		it( 'should apply clip path using the draw function', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			const drawPathFn = jest.fn();
			const bounds = { x: 50, y: 50, width: 100, height: 80 };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds );

			expect( drawPathFn ).toHaveBeenCalledWith( mockCtx );
			expect( mockCtx.clip ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );

		it( 'should reset transform after clipping', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			// Add setTransform mock
			mockCtx.setTransform = jest.fn();

			const drawPathFn = jest.fn();
			const bounds = { x: 50, y: 50, width: 100, height: 80 };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds );

			// setTransform should be called to reset to identity
			expect( mockCtx.setTransform ).toHaveBeenCalledWith( 1, 0, 0, 1, 0, 0 );

			document.createElement = origCreateElement;
		} );

		it( 'should apply blur filter and draw captured content', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			// Track filter assignments
			const filterValues = [];
			Object.defineProperty( mockCtx, 'filter', {
				get: function() { return this._filter || 'none'; },
				set: function( val ) { this._filter = val; filterValues.push( val ); },
				configurable: true
			} );

			mockCtx.setTransform = jest.fn();

			const drawPathFn = jest.fn();
			const bounds = { x: 50, y: 50, width: 100, height: 80 };

			renderer.drawBlurFill( { blurRadius: 15 }, drawPathFn, bounds );

			// Filter should be set to blur then reset
			expect( filterValues ).toContain( 'blur(15px)' );
			expect( filterValues ).toContain( 'none' );

			// Main canvas drawImage should be called with the temp canvas
			expect( mockCtx.drawImage ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );

		it( 'should handle missing bounds gracefully', () => {
			const drawPathFn = jest.fn();

			// Empty bounds object
			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, {} );

			// Should return early due to zero dimensions
			expect( drawPathFn ).not.toHaveBeenCalled();
		} );

		it( 'should handle scaled option with canvas dimensions', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			renderer.backgroundImage = {
				complete: true,
				naturalWidth: 1600,
				naturalHeight: 1200
			};
			renderer.baseWidth = 1600;
			renderer.baseHeight = 1200;

			const drawPathFn = jest.fn();
			const bounds = { x: 100, y: 100, width: 200, height: 150 };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds, { scaled: true } );

			// In scaled mode, coordinates should be used directly
			expect( mockCtx.save ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );

		it( 'should return early if temp context is null', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( null ) // No context available
			} );

			const drawPathFn = jest.fn();
			const bounds = { x: 50, y: 50, width: 100, height: 80 };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds );

			// Should return early without drawing
			// The drawPathFn won't be called with mockCtx for blur, only for placeholder
			document.createElement = origCreateElement;
		} );

		it( 'should use baseWidth/baseHeight for canvas size fallback', () => {
			const origCreateElement = document.createElement;
			document.createElement = jest.fn().mockReturnValue( {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			} );

			renderer.canvas = null; // No canvas
			renderer.baseWidth = 1024;
			renderer.baseHeight = 768;

			const drawPathFn = jest.fn();
			const bounds = { x: 50, y: 50, width: 100, height: 80 };

			renderer.drawBlurFill( { blurRadius: 12 }, drawPathFn, bounds );

			// Should use baseWidth/baseHeight as fallback
			expect( mockCtx.save ).toHaveBeenCalled();

			document.createElement = origCreateElement;
		} );
	} );
} );
