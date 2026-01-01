/**
 * PolygonStarRenderer Unit Tests
 *
 * Tests for the PolygonStarRenderer module which handles polygon and star shape rendering.
 * Extracted from ShapeRenderer as part of the god class splitting initiative.
 *
 * @since 1.1.7
 */

/* eslint-env jest */

const PolygonStarRenderer = require( '../../resources/ext.layers.shared/PolygonStarRenderer.js' );
const PolygonGeometry = require( '../../resources/ext.layers.shared/PolygonGeometry.js' );

describe( 'PolygonStarRenderer', () => {
	let ctx;
	let polygonStarRenderer;

	beforeEach( () => {
		// Setup window.Layers namespace for PolygonGeometry access
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.PolygonGeometry = PolygonGeometry;

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

		polygonStarRenderer = new PolygonStarRenderer( ctx );
	} );

	afterEach( () => {
		if ( polygonStarRenderer && polygonStarRenderer.destroy ) {
			polygonStarRenderer.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should create instance with context', () => {
			expect( polygonStarRenderer ).toBeDefined();
			expect( polygonStarRenderer.ctx ).toBe( ctx );
		} );

		it( 'should accept shape renderer config', () => {
			const mockShapeRenderer = { clearShadow: jest.fn() };
			const renderer = new PolygonStarRenderer( ctx, { shapeRenderer: mockShapeRenderer } );
			expect( renderer.shapeRenderer ).toBe( mockShapeRenderer );
			renderer.destroy();
		} );

		it( 'should handle missing config', () => {
			const renderer = new PolygonStarRenderer( ctx );
			expect( renderer.config ).toEqual( {} );
			expect( renderer.shapeRenderer ).toBeNull();
			renderer.destroy();
		} );
	} );

	describe( 'setContext', () => {
		it( 'should update the context', () => {
			const newCtx = { save: jest.fn() };
			polygonStarRenderer.setContext( newCtx );
			expect( polygonStarRenderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'setShapeRenderer', () => {
		it( 'should update the shape renderer', () => {
			const mockShapeRenderer = { clearShadow: jest.fn() };
			polygonStarRenderer.setShapeRenderer( mockShapeRenderer );
			expect( polygonStarRenderer.shapeRenderer ).toBe( mockShapeRenderer );
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

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

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

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.lineTo ).toHaveBeenCalledTimes( 4 ); // 4 lineTo after 1 moveTo for 5 sides
		} );

		it( 'should draw a triangle (3 sides)', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 3,
				fill: '#ff0000'
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.lineTo ).toHaveBeenCalledTimes( 2 ); // 2 lineTo after 1 moveTo for 3 sides
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

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.strokeStyle ).toBe( '#ff6600' );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should draw polygon with both fill and stroke', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: '#00ff00',
				fillOpacity: 1,
				stroke: '#ff0000',
				strokeWidth: 3,
				strokeOpacity: 1
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.fill ).toHaveBeenCalled();
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should default to 6 sides', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				fill: '#00ffff'
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

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

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		it( 'should apply opacity', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: '#00ffff',
				fillOpacity: 0.5,
				opacity: 0.8
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			// globalAlpha should be set based on opacity * fillOpacity
			expect( ctx.fill ).toHaveBeenCalled();
		} );

		it( 'should handle scaled rendering', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: '#00ffff'
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 2, sy: 2, avg: 2 } } );

			expect( ctx.fill ).toHaveBeenCalled();
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

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

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

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.strokeStyle ).toBe( '#993300' );
			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should draw star with both fill and stroke', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: '#ffcc00',
				fillOpacity: 1,
				stroke: '#993300',
				strokeWidth: 2,
				strokeOpacity: 1
			};

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.fill ).toHaveBeenCalled();
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

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

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

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

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

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

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

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.translate ).toHaveBeenCalled();
			expect( ctx.rotate ).toHaveBeenCalled();
		} );

		it( 'should handle 6-pointed star', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 30,
				points: 6,
				fill: '#ffcc00'
			};

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			// 6 points * 2 = 12 vertices, so 11 lineTo after 1 moveTo
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 11 );
		} );

		it( 'should apply opacity', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: '#ffcc00',
				fillOpacity: 0.7,
				opacity: 0.9
			};

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.fill ).toHaveBeenCalled();
		} );
	} );

	describe( 'shadow delegation', () => {
		let mockShapeRenderer;

		beforeEach( () => {
			mockShapeRenderer = {
				clearShadow: jest.fn(),
				hasShadowEnabled: jest.fn().mockReturnValue( false ),
				getShadowSpread: jest.fn().mockReturnValue( 0 ),
				applyShadow: jest.fn(),
				drawSpreadShadow: jest.fn(),
				drawSpreadShadowStroke: jest.fn()
			};
			polygonStarRenderer.setShapeRenderer( mockShapeRenderer );
		} );

		it( 'should delegate hasShadowEnabled to shapeRenderer', () => {
			mockShapeRenderer.hasShadowEnabled.mockReturnValue( true );
			const layer = { shadow: true };
			const result = polygonStarRenderer.hasShadowEnabled( layer );
			expect( mockShapeRenderer.hasShadowEnabled ).toHaveBeenCalledWith( layer );
			expect( result ).toBe( true );
		} );

		it( 'should delegate clearShadow to shapeRenderer', () => {
			polygonStarRenderer.clearShadow();
			expect( mockShapeRenderer.clearShadow ).toHaveBeenCalled();
		} );

		it( 'should delegate getShadowSpread to shapeRenderer', () => {
			mockShapeRenderer.getShadowSpread.mockReturnValue( 5 );
			const layer = { shadowSpread: 5 };
			const result = polygonStarRenderer.getShadowSpread( layer, { avg: 1 } );
			expect( mockShapeRenderer.getShadowSpread ).toHaveBeenCalled();
			expect( result ).toBe( 5 );
		} );

		it( 'should fallback to local hasShadowEnabled when no shapeRenderer', () => {
			const renderer = new PolygonStarRenderer( ctx );
			expect( renderer.hasShadowEnabled( { shadow: true } ) ).toBe( true );
			expect( renderer.hasShadowEnabled( { shadow: false } ) ).toBe( false );
			expect( renderer.hasShadowEnabled( {} ) ).toBe( false );
			renderer.destroy();
		} );

		it( 'should fallback to local clearShadow when no shapeRenderer', () => {
			const renderer = new PolygonStarRenderer( ctx );
			ctx.shadowColor = '#000';
			ctx.shadowBlur = 10;
			renderer.clearShadow();
			expect( ctx.shadowColor ).toBe( 'transparent' );
			expect( ctx.shadowBlur ).toBe( 0 );
			renderer.destroy();
		} );

		it( 'should fallback to local getShadowSpread when no shapeRenderer and shadow disabled', () => {
			const renderer = new PolygonStarRenderer( ctx );
			const layer = { shadow: false };
			const result = renderer.getShadowSpread( layer, { avg: 1 } );
			expect( result ).toBe( 0 );
			renderer.destroy();
		} );

		it( 'should fallback to local getShadowSpread when no shapeRenderer and shadow enabled', () => {
			const renderer = new PolygonStarRenderer( ctx );
			const layer = { shadow: true, shadowSpread: 10 };
			const result = renderer.getShadowSpread( layer, { avg: 2 } );
			expect( result ).toBe( 20 ); // spread * avg
			renderer.destroy();
		} );

		it( 'should handle drawSpreadShadow with no shapeRenderer (no-op)', () => {
			const renderer = new PolygonStarRenderer( ctx );
			const layer = { shadow: true };
			// Should not throw - it's a no-op when shapeRenderer is null
			expect( () => {
				renderer.drawSpreadShadow( layer, { avg: 1 }, 5, () => {}, 1 );
			} ).not.toThrow();
			renderer.destroy();
		} );

		it( 'should handle drawSpreadShadowStroke with no shapeRenderer (no-op)', () => {
			const renderer = new PolygonStarRenderer( ctx );
			const layer = { shadow: true };
			// Should not throw - it's a no-op when shapeRenderer is null
			expect( () => {
				renderer.drawSpreadShadowStroke( layer, { avg: 1 }, 2, () => {}, 1 );
			} ).not.toThrow();
			renderer.destroy();
		} );
	} );

	describe( 'drawRoundedPolygonPath', () => {
		it( 'should draw rounded polygon path with PolygonGeometry', () => {
			const vertices = [
				{ x: 0, y: 50 },
				{ x: 50, y: 0 },
				{ x: 100, y: 50 },
				{ x: 50, y: 100 }
			];

			polygonStarRenderer.drawRoundedPolygonPath( vertices, 10 );

			// Should use arcTo for rounded corners
			expect( ctx.arcTo ).toHaveBeenCalled();
		} );

		it( 'should handle empty vertices', () => {
			polygonStarRenderer.drawRoundedPolygonPath( [], 10 );
			expect( ctx.arcTo ).not.toHaveBeenCalled();
		} );

		it( 'should handle zero corner radius', () => {
			const vertices = [
				{ x: 0, y: 50 },
				{ x: 50, y: 0 },
				{ x: 100, y: 50 }
			];

			polygonStarRenderer.drawRoundedPolygonPath( vertices, 0 );
			// With 0 radius, should still draw the path
		} );
	} );

	describe( 'drawRoundedStarPath', () => {
		it( 'should draw rounded star path with PolygonGeometry', () => {
			const vertices = [
				{ x: 50, y: 0 },   // outer
				{ x: 60, y: 30 },  // inner
				{ x: 95, y: 35 },  // outer
				{ x: 70, y: 55 },  // inner
				{ x: 80, y: 90 },  // outer
				{ x: 50, y: 70 },  // inner
				{ x: 20, y: 90 },  // outer
				{ x: 30, y: 55 },  // inner
				{ x: 5, y: 35 },   // outer
				{ x: 40, y: 30 }   // inner
			];

			polygonStarRenderer.drawRoundedStarPath( vertices, 5, 3 );

			// Should call arcTo for rounded corners
			expect( ctx.arcTo ).toHaveBeenCalled();
		} );

		it( 'should handle empty vertices', () => {
			polygonStarRenderer.drawRoundedStarPath( [], 5, 3 );
			expect( ctx.arcTo ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up references', () => {
			polygonStarRenderer.destroy();
			expect( polygonStarRenderer.ctx ).toBeNull();
			expect( polygonStarRenderer.shapeRenderer ).toBeNull();
			expect( polygonStarRenderer.config ).toBeNull();
		} );

		it( 'should handle being called multiple times', () => {
			polygonStarRenderer.destroy();
			expect( () => polygonStarRenderer.destroy() ).not.toThrow();
		} );
	} );

	describe( 'edge cases', () => {
		it( 'should handle missing layer properties gracefully', () => {
			expect( () => {
				polygonStarRenderer.drawPolygon( {}, { scale: { sx: 1, sy: 1, avg: 1 } } );
				polygonStarRenderer.drawStar( {}, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();
		} );

		it( 'should handle zero radius', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 0,
				sides: 6,
				fill: '#00ffff'
			};

			expect( () => {
				polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();
		} );

		it( 'should handle very large radius', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 10000,
				sides: 6,
				fill: '#00ffff'
			};

			expect( () => {
				polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();
		} );

		it( 'should handle many-sided polygon', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 100,
				fill: '#00ffff'
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			// 100 sides = 1 moveTo + 99 lineTo
			expect( ctx.lineTo ).toHaveBeenCalledTimes( 99 );
		} );

		it( 'should handle transparent fill', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: 'transparent',
				stroke: '#000000',
				strokeWidth: 1
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( ctx.stroke ).toHaveBeenCalled();
		} );

		it( 'should handle missing options', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: '#00ffff'
			};

			expect( () => {
				polygonStarRenderer.drawPolygon( layer );
			} ).not.toThrow();
		} );

		it( 'should handle polygon with cornerRadius using fallback path', () => {
			// Remove PolygonGeometry to test fallback
			const savedPolygonGeometry = window.Layers.Utils.PolygonGeometry;
			window.Layers.Utils.PolygonGeometry = null;

			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				cornerRadius: 5,
				fill: '#00ffff'
			};

			expect( () => {
				polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();

			// Restore
			window.Layers.Utils.PolygonGeometry = savedPolygonGeometry;
		} );

		it( 'should handle star with pointRadius/valleyRadius using fallback path', () => {
			// Remove PolygonGeometry to test fallback
			const savedPolygonGeometry = window.Layers.Utils.PolygonGeometry;
			window.Layers.Utils.PolygonGeometry = null;

			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				pointRadius: 3,
				valleyRadius: 2,
				fill: '#ffcc00'
			};

			expect( () => {
				polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();

			// Restore
			window.Layers.Utils.PolygonGeometry = savedPolygonGeometry;
		} );
	} );

	describe( 'polygon with shadows', () => {
		let mockShapeRenderer;

		beforeEach( () => {
			mockShapeRenderer = {
				clearShadow: jest.fn(),
				hasShadowEnabled: jest.fn().mockReturnValue( true ),
				getShadowSpread: jest.fn().mockReturnValue( 0 ),
				applyShadow: jest.fn(),
				drawSpreadShadow: jest.fn( ( layer, scale, spread, drawFn, opacity ) => {
					// Call drawFn to test path drawing
					drawFn( ctx );
				} ),
				drawSpreadShadowStroke: jest.fn( ( layer, scale, strokeWidth, drawFn, opacity ) => {
					drawFn( ctx );
				} )
			};
			polygonStarRenderer.setShapeRenderer( mockShapeRenderer );
		} );

		it( 'should draw polygon with shadow and fill', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: '#00ffff',
				fillOpacity: 1,
				shadow: true,
				shadowColor: '#000000',
				shadowBlur: 10
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockShapeRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );

		it( 'should draw polygon with shadow and stroke', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				stroke: '#ff0000',
				strokeWidth: 2,
				strokeOpacity: 1,
				shadow: true
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockShapeRenderer.drawSpreadShadowStroke ).toHaveBeenCalled();
		} );

		it( 'should draw polygon with shadow spread', () => {
			mockShapeRenderer.getShadowSpread.mockReturnValue( 5 );

			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: '#00ffff',
				fillOpacity: 1,
				shadow: true,
				shadowSpread: 5
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockShapeRenderer.getShadowSpread ).toHaveBeenCalled();
			expect( mockShapeRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );

		it( 'should draw polygon shadow with cornerRadius using PolygonGeometry', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				cornerRadius: 5,
				fill: '#00ffff',
				fillOpacity: 1,
				shadow: true
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockShapeRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );

		it( 'should draw polygon shadow without PolygonGeometry (fallback path)', () => {
			// Remove PolygonGeometry to test fallback
			const savedPolygonGeometry = window.Layers.Utils.PolygonGeometry;
			window.Layers.Utils.PolygonGeometry = null;

			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: '#00ffff',
				fillOpacity: 1,
				shadow: true
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockShapeRenderer.drawSpreadShadow ).toHaveBeenCalled();

			// Restore
			window.Layers.Utils.PolygonGeometry = savedPolygonGeometry;
		} );
	} );

	describe( 'star with shadows', () => {
		let mockShapeRenderer;

		beforeEach( () => {
			mockShapeRenderer = {
				clearShadow: jest.fn(),
				hasShadowEnabled: jest.fn().mockReturnValue( true ),
				getShadowSpread: jest.fn().mockReturnValue( 0 ),
				applyShadow: jest.fn(),
				drawSpreadShadow: jest.fn( ( layer, scale, spread, drawFn, opacity ) => {
					drawFn( ctx );
				} ),
				drawSpreadShadowStroke: jest.fn( ( layer, scale, strokeWidth, drawFn, opacity ) => {
					drawFn( ctx );
				} )
			};
			polygonStarRenderer.setShapeRenderer( mockShapeRenderer );
		} );

		it( 'should draw star with shadow and fill', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: '#ffcc00',
				fillOpacity: 1,
				shadow: true
			};

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockShapeRenderer.drawSpreadShadow ).toHaveBeenCalled();
		} );

		it( 'should draw star with shadow and stroke', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				stroke: '#993300',
				strokeWidth: 2,
				strokeOpacity: 1,
				shadow: true
			};

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockShapeRenderer.drawSpreadShadowStroke ).toHaveBeenCalled();
		} );

		it( 'should draw star shadow without PolygonGeometry (fallback path)', () => {
			// Remove PolygonGeometry to test fallback
			const savedPolygonGeometry = window.Layers.Utils.PolygonGeometry;
			window.Layers.Utils.PolygonGeometry = null;

			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: '#ffcc00',
				fillOpacity: 1,
				shadow: true
			};

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockShapeRenderer.drawSpreadShadow ).toHaveBeenCalled();

			// Restore
			window.Layers.Utils.PolygonGeometry = savedPolygonGeometry;
		} );
	} );

	describe( 'blur fill', () => {
		let mockShapeRenderer;
		let mockEffectsRenderer;

		beforeEach( () => {
			mockEffectsRenderer = {
				drawBlurFill: jest.fn()
			};
			mockShapeRenderer = {
				clearShadow: jest.fn(),
				hasShadowEnabled: jest.fn().mockReturnValue( false ),
				getShadowSpread: jest.fn().mockReturnValue( 0 ),
				effectsRenderer: mockEffectsRenderer
			};
			polygonStarRenderer.setShapeRenderer( mockShapeRenderer );
		} );

		it( 'should draw polygon with blur fill', () => {
			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: 'blur',
				fillOpacity: 1,
				blurRadius: 10
			};

			polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalled();
		} );

		it( 'should draw star with blur fill', () => {
			const layer = {
				x: 100,
				y: 100,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				fill: 'blur',
				fillOpacity: 1
			};

			polygonStarRenderer.drawStar( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );

			expect( mockEffectsRenderer.drawBlurFill ).toHaveBeenCalled();
		} );

		it( 'should not draw blur fill when effectsRenderer is missing', () => {
			mockShapeRenderer.effectsRenderer = null;

			const layer = {
				x: 100,
				y: 100,
				radius: 50,
				sides: 6,
				fill: 'blur',
				fillOpacity: 1
			};

			expect( () => {
				polygonStarRenderer.drawPolygon( layer, { scale: { sx: 1, sy: 1, avg: 1 } } );
			} ).not.toThrow();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export PolygonStarRenderer class', () => {
			expect( PolygonStarRenderer ).toBeDefined();
			expect( typeof PolygonStarRenderer ).toBe( 'function' );
		} );

		it( 'should allow creating new instances', () => {
			const instance = new PolygonStarRenderer( ctx );
			expect( instance ).toBeInstanceOf( PolygonStarRenderer );
			instance.destroy();
		} );
	} );
} );
