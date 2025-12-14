/**
 * ShapeRenderer Unit Tests
 *
 * Tests for the ShapeRenderer module which handles basic shape rendering.
 * Extracted from LayerRenderer as part of the god class splitting initiative.
 *
 * @since 0.9.1
 */

/* eslint-env jest */

const ShapeRenderer = require( '../../resources/ext.layers.shared/ShapeRenderer.js' );

describe( 'ShapeRenderer', () => {
	let ctx;
	let shapeRenderer;

	beforeEach( () => {
		// Create mock canvas context
		ctx = {
			save: jest.fn(),
			restore: jest.fn(),
			beginPath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			closePath: jest.fn(),
			fill: jest.fn(),
			stroke: jest.fn(),
			arc: jest.fn(),
			ellipse: jest.fn(),
			rect: jest.fn(),
			arcTo: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			scale: jest.fn(),
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 1,
			lineJoin: 'miter',
			miterLimit: 10,
			globalAlpha: 1,
			globalCompositeOperation: 'source-over',
			shadowColor: 'transparent',
			shadowBlur: 0,
			shadowOffsetX: 0,
			shadowOffsetY: 0,
			canvas: { width: 800, height: 600 }
		};

		shapeRenderer = new ShapeRenderer( ctx );
	} );

	afterEach( () => {
		if ( shapeRenderer && shapeRenderer.destroy ) {
			shapeRenderer.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should create instance with context', () => {
			expect( shapeRenderer ).toBeDefined();
			expect( shapeRenderer.ctx ).toBe( ctx );
		} );

		it( 'should accept shadow renderer config', () => {
			const mockShadowRenderer = { clearShadow: jest.fn() };
			const renderer = new ShapeRenderer( ctx, { shadowRenderer: mockShadowRenderer } );
			expect( renderer.shadowRenderer ).toBe( mockShadowRenderer );
			renderer.destroy();
		} );

		it( 'should handle missing config', () => {
			const renderer = new ShapeRenderer( ctx );
			expect( renderer.config ).toEqual( {} );
			expect( renderer.shadowRenderer ).toBeNull();
			renderer.destroy();
		} );
	} );

	describe( 'setContext', () => {
		it( 'should update the context', () => {
			const newCtx = { save: jest.fn() };
			shapeRenderer.setContext( newCtx );
			expect( shapeRenderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'setShadowRenderer', () => {
		it( 'should update the shadow renderer', () => {
			const mockShadowRenderer = { clearShadow: jest.fn() };
			shapeRenderer.setShadowRenderer( mockShadowRenderer );
			expect( shapeRenderer.shadowRenderer ).toBe( mockShadowRenderer );
		} );
	} );

	describe( 'drawRectangle', () => {
		it( 'should draw a basic rectangle with fill', () => {
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				fill: '#ff0000',
				fillOpacity: 1
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.fillStyle ).toBe( '#ff0000' );
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should draw rectangle with stroke', () => {
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				stroke: '#0000ff',
				strokeWidth: 2,
				strokeOpacity: 1
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.strokeStyle ).toBe( '#0000ff' );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should draw rectangle with both fill and stroke', () => {
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				fill: '#ff0000',
				fillOpacity: 1,
				stroke: '#0000ff',
				strokeWidth: 2,
				strokeOpacity: 1
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should handle rounded corners', () => {
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				cornerRadius: 10,
				fill: '#ff0000'
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			// Should use arcTo for rounded corners
			expect( ctx.arcTo ).toHaveBeenCalled();
		} );

		it( 'should apply rotation', () => {
			const layer = {
				x: 100,
				y: 100,
				width: 100,
				height: 80,
				rotation: 45,
				fill: '#ff0000'
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		it( 'should handle opacity correctly', () => {
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				fill: '#ff0000',
				opacity: 0.5,
				fillOpacity: 0.8
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			// globalAlpha should be set to opacity * fillOpacity
			expect( ctx.globalAlpha ).toBe( 0.5 * 0.8 );
		} );

		it( 'should skip transparent fill', () => {
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				fill: 'transparent'
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.fill ).not.toHaveBeenCalled();
		} );

		it( 'should handle default values', () => {
			const layer = {};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );
	} );

	describe( 'drawCircle', () => {
		it( 'should draw a basic circle with fill', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#00ff00',
				fillOpacity: 1
			};

			shapeRenderer.drawCircle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.arc ).toHaveBeenCalledWith( 100, 100, 50, 0, 2 * Math.PI );
			expect( ctx.fillStyle ).toBe( '#00ff00' );
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should draw circle with stroke', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				stroke: '#0000ff',
				strokeWidth: 3,
				strokeOpacity: 1
			};

			shapeRenderer.drawCircle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.arc ).toHaveBeenCalled();
			expect( ctx.strokeStyle ).toBe( '#0000ff' );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should handle opacity', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#00ff00',
				opacity: 0.7,
				fillOpacity: 1
			};

			shapeRenderer.drawCircle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.globalAlpha ).toBe( 0.7 );
		} );

		it( 'should default radius to 0', () => {
			const layer = {
				x: 100,
				y: 100,
				fill: '#00ff00'
			};

			shapeRenderer.drawCircle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.arc ).toHaveBeenCalledWith( 100, 100, 0, 0, 2 * Math.PI );
		} );
	} );

	describe( 'drawEllipse', () => {
		it( 'should draw a basic ellipse with fill', () => {
			const layer = {
				x: 100,
				y: 100,
				radiusX: 60,
				radiusY: 40,
				fill: '#ffff00',
				fillOpacity: 1
			};

			shapeRenderer.drawEllipse( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.ellipse ).toHaveBeenCalled();
			expect( ctx.fillStyle ).toBe( '#ffff00' );
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should draw ellipse with stroke', () => {
			const layer = {
				x: 100,
				y: 100,
				radiusX: 60,
				radiusY: 40,
				stroke: '#ff00ff',
				strokeWidth: 2,
				strokeOpacity: 1
			};

			shapeRenderer.drawEllipse( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.ellipse ).toHaveBeenCalled();
			expect( ctx.strokeStyle ).toBe( '#ff00ff' );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should calculate radiusX/Y from width/height if not provided', () => {
			const layer = {
				x: 100,
				y: 100,
				width: 120,
				height: 80,
				fill: '#ffff00'
			};

			shapeRenderer.drawEllipse( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			// radiusX = width/2 = 60, radiusY = height/2 = 40
			expect( ctx.ellipse ).toHaveBeenCalled();
		} );

		it( 'should handle rotation', () => {
			const layer = {
				x: 100,
				y: 100,
				radiusX: 60,
				radiusY: 40,
				rotation: 30,
				fill: '#ffff00'
			};

			shapeRenderer.drawEllipse( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			// ellipse method receives rotation in radians
			const rotationRad = ( 30 * Math.PI ) / 180;
			expect( ctx.ellipse ).toHaveBeenCalledWith(
				100, 100, 60, 40, rotationRad, 0, 2 * Math.PI
			);
		} );
	} );

	describe( 'drawPolygon', () => {
		it( 'should draw a hexagon (6 sides) with fill', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: '#00ffff',
				fillOpacity: 1
			};

			shapeRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalled();
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 5 ); // 5 lineTo after 1 moveTo for 6 sides
			expect( ctx.closePath ).toHaveBeenCalled();
			expect( ctx.fillStyle ).toBe( '#00ffff' );
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should draw a pentagon (5 sides)', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 5,
				fill: '#00ffff'
			};

			shapeRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.lineTo ).toHaveBeenCalledTimes( 4 ); // 4 lineTo after 1 moveTo for 5 sides
		} );

		it( 'should draw polygon with stroke', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				stroke: '#ff6600',
				strokeWidth: 2,
				strokeOpacity: 1
			};

			shapeRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.strokeStyle ).toBe( '#ff6600' );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should default to 6 sides', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#00ffff'
			};

			shapeRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.lineTo ).toHaveBeenCalledTimes( 5 ); // 6 sides = 1 moveTo + 5 lineTo
		} );

		it( 'should handle rotation', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				rotation: 45,
				fill: '#00ffff'
			};

			shapeRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );
	} );

	describe( 'drawStar', () => {
		it( 'should draw a 5-point star with fill', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: '#ffcc00',
				fillOpacity: 1
			};

			shapeRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalled();
			// 5 points * 2 = 10 vertices, so 9 lineTo after 1 moveTo
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 9 );
			expect( ctx.closePath ).toHaveBeenCalled();
			expect( ctx.fillStyle ).toBe( '#ffcc00' );
			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should draw star with stroke', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				stroke: '#993300',
				strokeWidth: 2,
				strokeOpacity: 1
			};

			shapeRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.strokeStyle ).toBe( '#993300' );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should use radius as fallback for outerRadius', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				points: 5,
				fill: '#ffcc00'
			};

			shapeRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should default innerRadius to half of outerRadius', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				points: 5,
				fill: '#ffcc00'
			};

			shapeRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should default to 5 points', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				fill: '#ffcc00'
			};

			shapeRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			// 5 points * 2 = 10 vertices, so 9 lineTo after 1 moveTo
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 9 );
		} );

		it( 'should handle rotation', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				rotation: 36,
				fill: '#ffcc00'
			};

			shapeRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );
	} );

	describe( 'shadow integration', () => {
		let mockShadowRenderer;

		beforeEach( () => {
			mockShadowRenderer = {
				clearShadow: jest.fn(),
				applyShadow: jest.fn(),
				hasShadowEnabled: jest.fn().mockReturnValue( true ),
				getShadowSpread: jest.fn().mockReturnValue( 0 ),
				getShadowParams: jest.fn().mockReturnValue( { offsetX: 3, offsetY: 3, blur: 10, color: 'black', offscreenOffset: 15 } ),
				drawSpreadShadow: jest.fn( ( layer, scale, spread, drawFn, opacity ) => {
					// Actually call the draw function to exercise the code paths
					drawFn( ctx );
				} ),
				drawSpreadShadowStroke: jest.fn( ( layer, scale, strokeWidth, drawFn, opacity ) => {
					drawFn( ctx );
				} ),
				withLocalAlpha: jest.fn( ( alpha, drawFn ) => drawFn() ),
				setContext: jest.fn()
			};
			shapeRenderer.setShadowRenderer( mockShadowRenderer );
		} );

		it( 'should delegate shadow operations to shadowRenderer', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#ff0000',
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			shapeRenderer.drawCircle( layer, { scale: { sx: 1, sy: 1, avg: 1 }, shadowScale: { avg: 1 } } );

			expect( mockShadowRenderer.hasShadowEnabled ).toHaveBeenCalled();
		} );

		it( 'should draw rectangle with fill shadow', () => {
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				fill: '#ff0000',
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 }, shadowScale: { avg: 1, sx: 1, sy: 1 } } );

			expect( mockShadowRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );

		it( 'should draw rectangle with stroke shadow', () => {
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				stroke: '#0000ff',
				strokeWidth: 3,
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 }, shadowScale: { avg: 1, sx: 1, sy: 1 } } );

			expect( mockShadowRenderer.drawSpreadShadowStroke ).toHaveBeenCalled();
		} );

		it( 'should draw rectangle with spread shadow', () => {
			mockShadowRenderer.getShadowSpread.mockReturnValue( 5 );
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				fill: '#ff0000',
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10,
				shadowSpread: 5
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 }, shadowScale: { avg: 1, sx: 1, sy: 1 } } );

			expect( mockShadowRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );

		it( 'should draw circle with fill shadow', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#ff0000',
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			shapeRenderer.drawCircle( layer, { scale: { sx: 1, sy: 1, avg: 1 }, shadowScale: { avg: 1 } } );

			expect( mockShadowRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );

		it( 'should draw ellipse with shadow', () => {
			const layer = {
				x: 100,
				y: 100,
				radiusX: 80,
				radiusY: 50,
				fill: '#ff0000',
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			shapeRenderer.drawEllipse( layer, { scale: { sx: 1, sy: 1, avg: 1 }, shadowScale: { avg: 1 } } );

			expect( mockShadowRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );

		it( 'should draw polygon with shadow', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: '#ff0000',
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			shapeRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 }, shadowScale: { avg: 1 } } );

			expect( mockShadowRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );

		it( 'should draw star with shadow', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: '#ff0000',
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			shapeRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 }, shadowScale: { avg: 1 } } );

			expect( mockShadowRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );

		it( 'should draw rounded rectangle with shadow', () => {
			// Mock roundRect support
			ctx.roundRect = jest.fn();
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				cornerRadius: 10,
				fill: '#ff0000',
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 }, shadowScale: { avg: 1, sx: 1, sy: 1 } } );

			expect( mockShadowRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );

		it( 'should draw rectangle with both fill and stroke shadows', () => {
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				fill: '#ff0000',
				stroke: '#0000ff',
				strokeWidth: 3,
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 }, shadowScale: { avg: 1, sx: 1, sy: 1 } } );

			expect( mockShadowRenderer.drawSpreadShadow ).toHaveBeenCalled();
			expect( mockShadowRenderer.drawSpreadShadowStroke ).toHaveBeenCalled();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up references', () => {
			shapeRenderer.destroy();

			expect( shapeRenderer.ctx ).toBeNull();
			expect( shapeRenderer.config ).toBeNull();
			expect( shapeRenderer.shadowRenderer ).toBeNull();
		} );
	} );

	describe( 'edge cases', () => {
		it( 'should handle zero dimensions', () => {
			const layer = {
				x: 50,
				y: 50,
				width: 0,
				height: 0,
				fill: '#ff0000'
			};

			expect( () => {
				shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();
		} );

		it( 'should handle negative dimensions', () => {
			const layer = {
				x: 50,
				y: 50,
				width: -100,
				height: -80,
				fill: '#ff0000'
			};

			expect( () => {
				shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();
		} );

		it( 'should handle missing layer properties gracefully', () => {
			expect( () => {
				shapeRenderer.drawRectangle( {}, { scale: { sx: 1, sy: 1, avg: 1 } } );
				shapeRenderer.drawCircle( {}, { scale: { sx: 1, sy: 1, avg: 1 } } );
				shapeRenderer.drawEllipse( {}, { scale: { sx: 1, sy: 1, avg: 1 } } );
				shapeRenderer.drawPolygon( {}, { scale: { sx: 1, sy: 1, avg: 1 } } );
				shapeRenderer.drawStar( {}, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();
		} );

		it( 'should handle very large values', () => {
			const layer = {
				x: 1000000,
				y: 1000000,
				width: 1000000,
				height: 1000000,
				fill: '#ff0000'
			};

			expect( () => {
				shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();
		} );

		it( 'should handle opacity edge values', () => {
			const layer = {
				x: 50,
				y: 50,
				width: 100,
				height: 80,
				fill: '#ff0000',
				opacity: 1.5, // Should be clamped
				fillOpacity: -0.5 // Should be clamped
			};

			expect( () => {
				shapeRenderer.drawRectangle( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();
		} );
	} );

	describe( 'drawLine', () => {
		it( 'should draw a basic line', () => {
			const layer = {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				stroke: '#ff0000',
				strokeWidth: 2,
				strokeOpacity: 1
			};

			shapeRenderer.drawLine( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalledWith( 10, 20 );
			expect( ctx.lineTo ).toHaveBeenCalledWith( 100, 80 );
			expect( ctx.strokeStyle ).toBe( '#ff0000' );
			expect( ctx.stroke ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should handle rotation', () => {
			const layer = {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				rotation: 45,
				stroke: '#ff0000'
			};

			shapeRenderer.drawLine( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		it( 'should handle default values', () => {
			const layer = {};

			expect( () => {
				shapeRenderer.drawLine( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();

			expect( ctx.moveTo ).toHaveBeenCalledWith( 0, 0 );
			expect( ctx.lineTo ).toHaveBeenCalledWith( 0, 0 );
		} );

		it( 'should set line cap to round', () => {
			const layer = {
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				stroke: '#ff0000'
			};

			shapeRenderer.drawLine( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.lineCap ).toBe( 'round' );
		} );
	} );

	describe( 'drawPath', () => {
		it( 'should draw a path with multiple points', () => {
			const layer = {
				points: [
					{ x: 10, y: 20 },
					{ x: 50, y: 30 },
					{ x: 80, y: 70 },
					{ x: 100, y: 50 }
				],
				stroke: '#00ff00',
				strokeWidth: 3,
				strokeOpacity: 1
			};

			shapeRenderer.drawPath( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.save ).toHaveBeenCalled();
			expect( ctx.beginPath ).toHaveBeenCalled();
			expect( ctx.moveTo ).toHaveBeenCalledWith( 10, 20 );
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 3 );
			expect( ctx.strokeStyle ).toBe( '#00ff00' );
			expect( ctx.stroke ).toHaveBeenCalled();
			expect( ctx.restore ).toHaveBeenCalled();
		} );

		it( 'should skip if less than 2 points', () => {
			const layer = {
				points: [ { x: 10, y: 20 } ],
				stroke: '#00ff00'
			};

			shapeRenderer.drawPath( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.beginPath ).not.toHaveBeenCalled();
		} );

		it( 'should skip if no points array', () => {
			const layer = {
				stroke: '#00ff00'
			};

			shapeRenderer.drawPath( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.beginPath ).not.toHaveBeenCalled();
		} );

		it( 'should handle rotation', () => {
			const layer = {
				points: [
					{ x: 10, y: 20 },
					{ x: 50, y: 30 },
					{ x: 80, y: 70 }
				],
				rotation: 45,
				stroke: '#00ff00'
			};

			shapeRenderer.drawPath( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		it( 'should set line join to round', () => {
			const layer = {
				points: [
					{ x: 10, y: 20 },
					{ x: 50, y: 30 }
				],
				stroke: '#00ff00'
			};

			shapeRenderer.drawPath( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.lineJoin ).toBe( 'round' );
			expect( ctx.lineCap ).toBe( 'round' );
		} );
	} );
} );
