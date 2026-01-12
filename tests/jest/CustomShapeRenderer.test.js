/**
 * CustomShapeRenderer Tests
 *
 * Tests for rendering custom shapes from the shape library to canvas.
 */

'use strict';

const CustomShapeRenderer = require( '../../resources/ext.layers.shared/CustomShapeRenderer.js' );

// Mock Path2D since it's not available in Node.js
class MockPath2D {
	constructor( pathData ) {
		this.pathData = pathData;
	}
}
global.Path2D = MockPath2D;

describe( 'CustomShapeRenderer', () => {
	let renderer;
	let mockCtx;

	beforeEach( () => {
		renderer = new CustomShapeRenderer();
		mockCtx = {
			save: jest.fn(),
			restore: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			scale: jest.fn(),
			fill: jest.fn(),
			stroke: jest.fn(),
			fillRect: jest.fn(),
			strokeRect: jest.fn(),
			setLineDash: jest.fn(),
			drawImage: jest.fn(),
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 1,
			lineCap: 'butt',
			lineJoin: 'miter',
			globalAlpha: 1,
			shadowColor: '',
			shadowBlur: 0,
			shadowOffsetX: 0,
			shadowOffsetY: 0
		};

		// Mock mw.log.warn
		global.mw = {
			log: {
				warn: jest.fn()
			}
		};
	} );

	afterEach( () => {
		renderer.clearCache();
		delete global.mw;
	} );

	describe( 'constructor', () => {
		test( 'initializes with default cache size', () => {
			const r = new CustomShapeRenderer();
			expect( r.maxCacheSize ).toBe( 100 );
		} );

		test( 'accepts custom cache size', () => {
			const r = new CustomShapeRenderer( { cacheSize: 50 } );
			expect( r.maxCacheSize ).toBe( 50 );
		} );

		test( 'initializes empty caches', () => {
			const r = new CustomShapeRenderer();
			expect( r.pathCache.size ).toBe( 0 );
			expect( r.svgImageCache.size ).toBe( 0 );
			expect( r.pendingLoads.size ).toBe( 0 );
		} );
	} );

	describe( 'render', () => {
		test( 'returns early with warning for missing shape data', () => {
			renderer.render( mockCtx, null, {} );
			expect( global.mw.log.warn ).toHaveBeenCalledWith( 'CustomShapeRenderer: Missing shape data' );
		} );

		test( 'returns early with warning for invalid shape data (no path)', () => {
			renderer.render( mockCtx, { viewBox: [ 0, 0, 100, 100 ] }, {} );
			expect( global.mw.log.warn ).toHaveBeenCalledWith( 'CustomShapeRenderer: Invalid shape data' );
		} );

		test( 'returns early with warning for invalid shape data (no viewBox)', () => {
			renderer.render( mockCtx, { path: 'M0,0 L100,100' }, {} );
			expect( global.mw.log.warn ).toHaveBeenCalledWith( 'CustomShapeRenderer: Invalid shape data' );
		} );

		test( 'renders single-path shape with fill', () => {
			const shapeData = {
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const layer = {
				x: 10,
				y: 20,
				width: 200,
				height: 200,
				fill: '#ff0000',
				opacity: 0.8
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.translate ).toHaveBeenCalledWith( 10, 20 );
			expect( mockCtx.scale ).toHaveBeenCalledWith( 2, 2 );
			expect( mockCtx.fillStyle ).toBe( '#ff0000' );
			expect( mockCtx.fill ).toHaveBeenCalled();
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		test( 'renders single-path shape with stroke', () => {
			const shapeData = {
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const layer = {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				stroke: '#0000ff',
				strokeWidth: 2
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.strokeStyle ).toBe( '#0000ff' );
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'applies rotation when present', () => {
			const shapeData = {
				path: 'M0,0 L100,100',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const layer = {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				rotation: 45,
				fill: '#000'
			};

			renderer.render( mockCtx, shapeData, layer );

			// Should translate to center, rotate, translate back
			expect( mockCtx.translate ).toHaveBeenCalledWith( 50, 50 );
			expect( mockCtx.rotate ).toHaveBeenCalled();
			expect( mockCtx.translate ).toHaveBeenCalledWith( -50, -50 );
		} );

		test( 'handles stroke-only shapes', () => {
			const shapeData = {
				path: 'M0,0 L100,100',
				viewBox: [ 0, 0, 100, 100 ],
				strokeOnly: true
			};
			const layer = {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				stroke: '#000'
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.lineCap ).toBe( 'round' );
			expect( mockCtx.lineJoin ).toBe( 'round' );
		} );

		test( 'skips fill for stroke-only shapes', () => {
			const shapeData = {
				path: 'M0,0 L100,100',
				viewBox: [ 0, 0, 100, 100 ],
				strokeOnly: true
			};
			const layer = {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				fill: '#ff0000', // Should be ignored
				stroke: '#000'
			};

			renderer.render( mockCtx, shapeData, layer );

			// fill should not be called for stroke-only shapes
			expect( mockCtx.fill ).not.toHaveBeenCalled();
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'skips transparent fill', () => {
			const shapeData = {
				path: 'M0,0 L100,100',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const layer = {
				fill: 'transparent'
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.fill ).not.toHaveBeenCalled();
		} );

		test( 'skips none fill', () => {
			const shapeData = {
				path: 'M0,0 L100,100',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const layer = {
				fill: 'none'
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.fill ).not.toHaveBeenCalled();
		} );

		test( 'skips transparent stroke', () => {
			const shapeData = {
				path: 'M0,0 L100,100',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const layer = {
				stroke: 'transparent'
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.stroke ).not.toHaveBeenCalled();
		} );

		test( 'uses default layer dimensions', () => {
			const shapeData = {
				path: 'M0,0 L100,100',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const layer = {
				fill: '#000'
			};

			renderer.render( mockCtx, shapeData, layer );

			// Default width/height is 100, so scale should be 1
			expect( mockCtx.scale ).toHaveBeenCalledWith( 1, 1 );
		} );

		test( 'applies fillRule from shape data', () => {
			const shapeData = {
				path: 'M0,0 L100,100',
				viewBox: [ 0, 0, 100, 100 ],
				fillRule: 'evenodd'
			};
			const layer = {
				fill: '#000'
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.fill ).toHaveBeenCalled();
		} );
	} );

	describe( 'renderMultiPath', () => {
		test( 'returns early without viewBox', () => {
			const shapeData = {
				paths: [
					{ path: 'M0,0 L100,100', fill: '#f00' }
				]
			};

			renderer.render( mockCtx, shapeData, {} );

			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		test( 'renders multiple paths in order', () => {
			const shapeData = {
				viewBox: [ 0, 0, 100, 100 ],
				paths: [
					{ path: 'M0,0 L50,0 L50,50 L0,50 Z', fill: '#ff0000' },
					{ path: 'M50,50 L100,50 L100,100 L50,100 Z', fill: '#00ff00' }
				]
			};
			const layer = {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				opacity: 1
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.fill ).toHaveBeenCalledTimes( 2 );
		} );

		test( 'applies layer opacity to all paths', () => {
			const shapeData = {
				viewBox: [ 0, 0, 100, 100 ],
				paths: [
					{ path: 'M0,0 L100,100', fill: '#ff0000' }
				]
			};
			const layer = {
				opacity: 0.5
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.globalAlpha ).toBe( 0.5 );
		} );

		test( 'skips paths without path property', () => {
			const shapeData = {
				viewBox: [ 0, 0, 100, 100 ],
				paths: [
					{ fill: '#ff0000' }, // No path
					{ path: 'M0,0 L100,100', fill: '#00ff00' }
				]
			};
			const layer = {};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.fill ).toHaveBeenCalledTimes( 1 );
		} );

		test( 'renders path strokes', () => {
			const shapeData = {
				viewBox: [ 0, 0, 100, 100 ],
				paths: [
					{ path: 'M0,0 L100,100', stroke: '#0000ff', strokeWidth: 3 }
				]
			};
			const layer = {};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.strokeStyle ).toBe( '#0000ff' );
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'applies rotation to multi-path shapes', () => {
			const shapeData = {
				viewBox: [ 0, 0, 100, 100 ],
				paths: [
					{ path: 'M0,0 L100,100', fill: '#000' }
				]
			};
			const layer = {
				rotation: 90
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.rotate ).toHaveBeenCalled();
		} );
	} );

	describe( 'renderSVG', () => {
		let originalURL;
		let originalBlob;
		let originalImage;

		beforeEach( () => {
			originalURL = global.URL;
			originalBlob = global.Blob;
			originalImage = global.Image;

			global.URL = {
				createObjectURL: jest.fn( () => 'blob:mock-url' ),
				revokeObjectURL: jest.fn()
			};

			global.Blob = jest.fn( () => ( {} ) );
		} );

		afterEach( () => {
			global.URL = originalURL;
			global.Blob = originalBlob;
			global.Image = originalImage;
		} );

		test( 'draws placeholder while loading SVG', () => {
			global.Image = jest.fn( () => ( {
				set onload( fn ) { /* Don't call */ },
				set onerror( fn ) { /* Don't call */ },
				set src( url ) { /* Don't trigger load */ }
			} ) );

			const shapeData = {
				svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>'
			};
			const layer = {
				x: 10,
				y: 20,
				width: 100,
				height: 100
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.setLineDash ).toHaveBeenCalledWith( [ 4, 4 ] );
			expect( mockCtx.strokeRect ).toHaveBeenCalledWith( 10, 20, 100, 100 );
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		test( 'draws placeholder for pending loads', () => {
			global.Image = jest.fn( () => ( {
				set onload( fn ) { /* Don't call */ },
				set onerror( fn ) { /* Don't call */ },
				set src( url ) { /* Don't trigger load */ }
			} ) );

			const shapeData = {
				id: 'test-shape',
				svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>'
			};
			const layer = {
				x: 10,
				y: 20,
				width: 100,
				height: 100
			};

			// First render starts the load
			renderer.render( mockCtx, shapeData, layer );
			// Second render should show placeholder
			renderer.render( mockCtx, shapeData, layer );

			expect( mockCtx.strokeRect ).toHaveBeenCalledTimes( 2 );
		} );

		test( 'replaces currentColor with stroke color', () => {
			let createdBlob;
			global.Blob = jest.fn( ( content ) => {
				createdBlob = content[ 0 ];
				return {};
			} );
			global.Image = jest.fn( () => ( {
				set onload( fn ) { /* Don't call */ },
				set onerror( fn ) { /* Don't call */ },
				set src( url ) { /* Don't trigger load */ }
			} ) );

			const shapeData = {
				svg: '<svg><path stroke="currentColor"/></svg>'
			};
			const layer = {
				stroke: '#ff0000'
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( createdBlob ).toContain( 'stroke="#ff0000"' );
		} );

		test( 'replaces currentColor with fill color', () => {
			let createdBlob;
			global.Blob = jest.fn( ( content ) => {
				createdBlob = content[ 0 ];
				return {};
			} );
			global.Image = jest.fn( () => ( {
				set onload( fn ) { /* Don't call */ },
				set onerror( fn ) { /* Don't call */ },
				set src( url ) { /* Don't trigger load */ }
			} ) );

			const shapeData = {
				svg: '<svg><path fill="currentColor"/></svg>'
			};
			const layer = {
				fill: '#00ff00'
			};

			renderer.render( mockCtx, shapeData, layer );

			expect( createdBlob ).toContain( 'fill="#00ff00"' );
		} );
	} );

	describe( 'drawSVGImage', () => {
		test( 'draws image at layer position and size', () => {
			const mockImg = {};
			const layer = {
				x: 50,
				y: 100,
				width: 200,
				height: 150
			};

			renderer.drawSVGImage( mockCtx, mockImg, layer );

			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.drawImage ).toHaveBeenCalledWith( mockImg, 50, 100, 200, 150 );
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		test( 'applies opacity', () => {
			const mockImg = {};
			const layer = {
				opacity: 0.5
			};

			renderer.drawSVGImage( mockCtx, mockImg, layer );

			expect( mockCtx.globalAlpha ).toBe( 0.5 );
		} );

		test( 'applies rotation', () => {
			const mockImg = {};
			const layer = {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				rotation: 45
			};

			renderer.drawSVGImage( mockCtx, mockImg, layer );

			expect( mockCtx.translate ).toHaveBeenCalled();
			expect( mockCtx.rotate ).toHaveBeenCalled();
		} );

		test( 'uses default dimensions', () => {
			const mockImg = {};
			const layer = {};

			renderer.drawSVGImage( mockCtx, mockImg, layer );

			expect( mockCtx.drawImage ).toHaveBeenCalledWith( mockImg, 0, 0, 100, 100 );
		} );
	} );

	describe( 'renderWithEffects', () => {
		test( 'renders without shadow when not enabled', () => {
			const shapeData = {
				path: 'M0,0 L100,100',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const layer = {
				fill: '#000'
			};

			renderer.renderWithEffects( mockCtx, shapeData, layer );

			// renderWithEffects now delegates to render() - shadows handled in drawSVGImage
			expect( mockCtx.shadowColor ).toBe( '' );
		} );

		test( 'delegates to render for shadow handling', () => {
			// renderWithEffects now just calls render() - shadows are handled in drawSVGImage
			const shapeData = {
				path: 'M0,0 L100,100',
				viewBox: [ 0, 0, 100, 100 ]
			};
			const layer = {
				fill: '#000',
				shadow: true,
				shadowColor: '#ff0000',
				shadowBlur: 15,
				shadowOffsetX: 10,
				shadowOffsetY: 20
			};

			// Should not throw
			expect( () => renderer.renderWithEffects( mockCtx, shapeData, layer ) ).not.toThrow();
		} );
	} );

	describe( 'drawSVGImage with shadow', () => {
		test( 'applies simple shadow (no spread) when shadow enabled', () => {
			const mockImg = {};
			const layer = {
				x: 50,
				y: 100,
				width: 200,
				height: 150,
				shadow: true,
				shadowColor: '#ff0000',
				shadowBlur: 15,
				shadowOffsetX: 10,
				shadowOffsetY: 20
			};

			// Track shadow properties set during drawing
			let shadowColorDuringDraw = null;
			let shadowBlurDuringDraw = null;
			const originalDrawImage = mockCtx.drawImage;
			mockCtx.drawImage = jest.fn( () => {
				// Capture values at draw time
				shadowColorDuringDraw = mockCtx.shadowColor;
				shadowBlurDuringDraw = mockCtx.shadowBlur;
			} );

			renderer.drawSVGImage( mockCtx, mockImg, layer );

			expect( shadowColorDuringDraw ).toBe( '#ff0000' );
			expect( shadowBlurDuringDraw ).toBe( 15 );
			// After draw completes, shadow is cleared
			expect( mockCtx.shadowColor ).toBe( 'transparent' );

			mockCtx.drawImage = originalDrawImage;
		} );

		test( 'uses default shadow values when not specified', () => {
			const mockImg = {};
			const layer = {
				shadow: true
			};

			let shadowColorDuringDraw = null;
			let shadowBlurDuringDraw = null;
			mockCtx.drawImage = jest.fn( () => {
				shadowColorDuringDraw = mockCtx.shadowColor;
				shadowBlurDuringDraw = mockCtx.shadowBlur;
			} );

			renderer.drawSVGImage( mockCtx, mockImg, layer );

			expect( shadowColorDuringDraw ).toBe( 'rgba(0, 0, 0, 0.5)' );
			expect( shadowBlurDuringDraw ).toBe( 10 );
		} );

		test( 'clears shadow after drawing', () => {
			const mockImg = {};
			const layer = {
				shadow: true
			};

			renderer.drawSVGImage( mockCtx, mockImg, layer );

			// After restore, shadow should be cleared
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		test( 'handles shadow with spread using offscreen canvas technique', () => {
			const mockImg = {};
			const layer = {
				x: 50,
				y: 100,
				width: 200,
				height: 150,
				shadow: true,
				shadowSpread: 10,
				shadowColor: '#000000',
				shadowBlur: 5
			};

			// Add missing methods to mockCtx for spread shadow
			mockCtx.setTransform = jest.fn();
			mockCtx.getTransform = jest.fn().mockReturnValue( { e: 0, f: 0 } );
			mockCtx.canvas = { width: 800, height: 600 };

			// Mock document.createElement to track offscreen canvas creation
			const mockTempCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				setTransform: jest.fn(),
				translate: jest.fn(),
				beginPath: jest.fn(),
				rect: jest.fn(),
				fill: jest.fn(),
				drawImage: jest.fn(),
				globalCompositeOperation: '',
				shadowColor: '',
				shadowBlur: 0,
				shadowOffsetX: 0,
				shadowOffsetY: 0,
				fillStyle: ''
			};
			const mockTempCanvas = {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockTempCtx )
			};
			const originalCreateElement = global.document.createElement;
			global.document.createElement = jest.fn( ( tag ) => {
				if ( tag === 'canvas' ) {
					return mockTempCanvas;
				}
				return originalCreateElement.call( document, tag );
			} );

			// Should not throw with spread shadow
			expect( () => renderer.drawSVGImage( mockCtx, mockImg, layer ) ).not.toThrow();

			global.document.createElement = originalCreateElement;
		} );
	} );

	describe( 'hasShadowEnabled', () => {
		test( 'returns true for shadow=true boolean', () => {
			expect( renderer.hasShadowEnabled( { shadow: true } ) ).toBe( true );
		} );

		test( 'returns true for shadow="true" string', () => {
			expect( renderer.hasShadowEnabled( { shadow: 'true' } ) ).toBe( true );
		} );

		test( 'returns true for shadow=1 integer', () => {
			expect( renderer.hasShadowEnabled( { shadow: 1 } ) ).toBe( true );
		} );

		test( 'returns true for shadow="1" string', () => {
			expect( renderer.hasShadowEnabled( { shadow: '1' } ) ).toBe( true );
		} );

		test( 'returns true for shadow object', () => {
			expect( renderer.hasShadowEnabled( { shadow: { color: '#000' } } ) ).toBe( true );
		} );

		test( 'returns false for shadow=false', () => {
			expect( renderer.hasShadowEnabled( { shadow: false } ) ).toBe( false );
		} );

		test( 'returns false for missing shadow property', () => {
			expect( renderer.hasShadowEnabled( {} ) ).toBe( false );
		} );
	} );

	describe( 'getShadowSpread', () => {
		test( 'returns shadowSpread value when set', () => {
			expect( renderer.getShadowSpread( { shadowSpread: 10 } ) ).toBe( 10 );
		} );

		test( 'returns 0 for non-positive shadowSpread', () => {
			expect( renderer.getShadowSpread( { shadowSpread: 0 } ) ).toBe( 0 );
			expect( renderer.getShadowSpread( { shadowSpread: -5 } ) ).toBe( 0 );
		} );

		test( 'returns spread from nested shadow object', () => {
			expect( renderer.getShadowSpread( { shadow: { spread: 15 } } ) ).toBe( 15 );
		} );

		test( 'returns 0 when no spread specified', () => {
			expect( renderer.getShadowSpread( {} ) ).toBe( 0 );
			expect( renderer.getShadowSpread( { shadow: true } ) ).toBe( 0 );
		} );
	} );

	describe( 'getOpacity', () => {
		test( 'returns combined opacity', () => {
			expect( renderer.getOpacity( 0.5, 0.5 ) ).toBe( 0.25 );
		} );

		test( 'uses default 1 when specific opacity undefined', () => {
			expect( renderer.getOpacity( undefined, 0.5 ) ).toBe( 0.5 );
		} );

		test( 'uses default 1 when layer opacity undefined', () => {
			expect( renderer.getOpacity( 0.5, undefined ) ).toBe( 0.5 );
		} );

		test( 'uses default 1 for both when undefined', () => {
			expect( renderer.getOpacity( undefined, undefined ) ).toBe( 1 );
		} );
	} );

	describe( 'hitTest', () => {
		test( 'returns false for missing shape data', () => {
			expect( renderer.hitTest( {}, null, 50, 50 ) ).toBe( false );
		} );

		test( 'returns false for shape without path', () => {
			expect( renderer.hitTest( {}, { viewBox: [ 0, 0, 100, 100 ] }, 50, 50 ) ).toBe( false );
		} );

		test( 'returns false for shape without viewBox', () => {
			expect( renderer.hitTest( {}, { path: 'M0,0 L100,100' }, 50, 50 ) ).toBe( false );
		} );

		test( 'returns false when point is outside layer bounds', () => {
			const layer = {
				x: 0,
				y: 0,
				width: 100,
				height: 100
			};
			const shapeData = {
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			expect( renderer.hitTest( layer, shapeData, 150, 50 ) ).toBe( false );
			expect( renderer.hitTest( layer, shapeData, 50, 150 ) ).toBe( false );
			expect( renderer.hitTest( layer, shapeData, -10, 50 ) ).toBe( false );
			expect( renderer.hitTest( layer, shapeData, 50, -10 ) ).toBe( false );
		} );

		test( 'performs point-in-path test for points inside bounds', () => {
			// Mock document.createElement
			const mockCanvas = {
				width: 1,
				height: 1,
				getContext: jest.fn( () => ( {
					isPointInPath: jest.fn( () => true )
				} ) )
			};
			document.createElement = jest.fn( () => mockCanvas );

			const layer = {
				x: 0,
				y: 0,
				width: 100,
				height: 100
			};
			const shapeData = {
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			const result = renderer.hitTest( layer, shapeData, 50, 50 );

			expect( document.createElement ).toHaveBeenCalledWith( 'canvas' );
			expect( result ).toBe( true );
		} );

		test( 'handles rotation in hit test', () => {
			const mockCanvas = {
				width: 1,
				height: 1,
				getContext: jest.fn( () => ( {
					isPointInPath: jest.fn( () => false )
				} ) )
			};
			document.createElement = jest.fn( () => mockCanvas );

			const layer = {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				rotation: 45
			};
			const shapeData = {
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			renderer.hitTest( layer, shapeData, 50, 50 );

			// Should apply inverse rotation
			expect( document.createElement ).toHaveBeenCalled();
		} );
	} );

	describe( 'cache management', () => {
		test( 'getPath2D caches and returns Path2D objects', () => {
			const path1 = renderer.getPath2D( 'M0,0 L100,100' );
			const path2 = renderer.getPath2D( 'M0,0 L100,100' );

			expect( path1 ).toBe( path2 );
			expect( renderer.getCacheSize() ).toBe( 1 );
		} );

		test( 'getPath2D evicts oldest entry when cache is full', () => {
			const smallRenderer = new CustomShapeRenderer( { cacheSize: 2 } );

			smallRenderer.getPath2D( 'M0,0 L1,1' );
			smallRenderer.getPath2D( 'M0,0 L2,2' );
			expect( smallRenderer.getCacheSize() ).toBe( 2 );

			smallRenderer.getPath2D( 'M0,0 L3,3' );
			expect( smallRenderer.getCacheSize() ).toBe( 2 );

			// First entry should be evicted
			expect( smallRenderer.pathCache.has( 'M0,0 L1,1' ) ).toBe( false );
		} );

		test( 'clearCache removes all cached paths', () => {
			renderer.getPath2D( 'M0,0 L100,100' );
			renderer.getPath2D( 'M0,0 L200,200' );
			expect( renderer.getCacheSize() ).toBe( 2 );

			renderer.clearCache();
			expect( renderer.getCacheSize() ).toBe( 0 );
		} );

		test( 'getCacheSize returns current cache size', () => {
			expect( renderer.getCacheSize() ).toBe( 0 );
			renderer.getPath2D( 'M0,0 L100,100' );
			expect( renderer.getCacheSize() ).toBe( 1 );
		} );
	} );

	describe( 'exports', () => {
		test( 'module exports CustomShapeRenderer class', () => {
			expect( CustomShapeRenderer ).toBeDefined();
			expect( typeof CustomShapeRenderer ).toBe( 'function' );
		} );

		test( 'window.Layers.ShapeLibrary.CustomShapeRenderer is set', () => {
			expect( window.Layers.ShapeLibrary.CustomShapeRenderer ).toBe( CustomShapeRenderer );
		} );

		test( 'window.CustomShapeRenderer is set for backwards compatibility', () => {
			expect( window.CustomShapeRenderer ).toBe( CustomShapeRenderer );
		} );
	} );
} );
