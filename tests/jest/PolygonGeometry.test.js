/**
 * @jest-environment jsdom
 */

/**
 * Unit tests for PolygonGeometry
 * Tests polygon and star vertex generation and path drawing utilities
 */

const PolygonGeometry = require( '../../resources/ext.layers.shared/PolygonGeometry.js' );

describe( 'PolygonGeometry', () => {
	describe( 'getPolygonVertices', () => {
		it( 'should generate triangle vertices (3 sides)', () => {
			const vertices = PolygonGeometry.getPolygonVertices( 100, 100, 50, 3 );
			expect( vertices ).toHaveLength( 3 );
			vertices.forEach( ( v ) => {
				expect( typeof v.x ).toBe( 'number' );
				expect( typeof v.y ).toBe( 'number' );
			} );
		} );

		it( 'should generate hexagon vertices (6 sides)', () => {
			const vertices = PolygonGeometry.getPolygonVertices( 0, 0, 100, 6 );
			expect( vertices ).toHaveLength( 6 );
		} );

		it( 'should enforce minimum 3 sides', () => {
			const vertices = PolygonGeometry.getPolygonVertices( 0, 0, 50, 1 );
			expect( vertices ).toHaveLength( 3 );
		} );

		it( 'should handle floating point sides by flooring', () => {
			const vertices = PolygonGeometry.getPolygonVertices( 0, 0, 50, 4.9 );
			expect( vertices ).toHaveLength( 4 );
		} );

		it( 'should center polygon at given coordinates', () => {
			const cx = 200, cy = 150, radius = 50;
			const vertices = PolygonGeometry.getPolygonVertices( cx, cy, radius, 4 );

			// All vertices should be within radius of center
			vertices.forEach( ( v ) => {
				const dist = Math.sqrt( Math.pow( v.x - cx, 2 ) + Math.pow( v.y - cy, 2 ) );
				expect( dist ).toBeCloseTo( radius, 5 );
			} );
		} );
	} );

	describe( 'getStarVertices', () => {
		it( 'should generate 5-pointed star vertices (10 points total)', () => {
			const vertices = PolygonGeometry.getStarVertices( 100, 100, 50, 25, 5 );
			expect( vertices ).toHaveLength( 10 ); // 5 points * 2 (outer + inner)
		} );

		it( 'should alternate between outer and inner radii', () => {
			const outerRadius = 100, innerRadius = 50;
			const vertices = PolygonGeometry.getStarVertices( 0, 0, outerRadius, innerRadius, 5 );

			// First vertex should be at outer radius (top point)
			const firstDist = Math.sqrt( Math.pow( vertices[ 0 ].x, 2 ) + Math.pow( vertices[ 0 ].y, 2 ) );
			expect( firstDist ).toBeCloseTo( outerRadius, 5 );

			// Second vertex should be at inner radius
			const secondDist = Math.sqrt( Math.pow( vertices[ 1 ].x, 2 ) + Math.pow( vertices[ 1 ].y, 2 ) );
			expect( secondDist ).toBeCloseTo( innerRadius, 5 );
		} );

		it( 'should enforce minimum 3 points', () => {
			const vertices = PolygonGeometry.getStarVertices( 0, 0, 50, 25, 1 );
			expect( vertices ).toHaveLength( 6 ); // 3 points minimum * 2
		} );
	} );

	describe( 'drawPath', () => {
		let mockCtx;

		beforeEach( () => {
			mockCtx = {
				beginPath: jest.fn(),
				moveTo: jest.fn(),
				lineTo: jest.fn(),
				closePath: jest.fn()
			};
		} );

		it( 'should draw a closed path by default', () => {
			const vertices = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 100 }
			];
			PolygonGeometry.drawPath( mockCtx, vertices );

			expect( mockCtx.beginPath ).toHaveBeenCalled();
			expect( mockCtx.moveTo ).toHaveBeenCalledWith( 0, 0 );
			expect( mockCtx.lineTo ).toHaveBeenCalledTimes( 2 );
			expect( mockCtx.closePath ).toHaveBeenCalled();
		} );

		it( 'should not close path when close=false', () => {
			const vertices = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 }
			];
			PolygonGeometry.drawPath( mockCtx, vertices, false );

			expect( mockCtx.closePath ).not.toHaveBeenCalled();
		} );

		it( 'should handle empty vertices', () => {
			PolygonGeometry.drawPath( mockCtx, [] );
			expect( mockCtx.beginPath ).not.toHaveBeenCalled();
		} );

		it( 'should handle null vertices', () => {
			PolygonGeometry.drawPath( mockCtx, null );
			expect( mockCtx.beginPath ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'drawPolygonPath', () => {
		let mockCtx;

		beforeEach( () => {
			mockCtx = {
				beginPath: jest.fn(),
				moveTo: jest.fn(),
				lineTo: jest.fn(),
				closePath: jest.fn()
			};
		} );

		it( 'should draw a hexagon path', () => {
			PolygonGeometry.drawPolygonPath( mockCtx, 100, 100, 50, 6 );

			expect( mockCtx.beginPath ).toHaveBeenCalled();
			expect( mockCtx.moveTo ).toHaveBeenCalledTimes( 1 );
			expect( mockCtx.lineTo ).toHaveBeenCalledTimes( 5 );
			expect( mockCtx.closePath ).toHaveBeenCalled();
		} );
	} );

	describe( 'drawStarPath', () => {
		let mockCtx;

		beforeEach( () => {
			mockCtx = {
				beginPath: jest.fn(),
				moveTo: jest.fn(),
				lineTo: jest.fn(),
				closePath: jest.fn()
			};
		} );

		it( 'should draw a 5-pointed star path', () => {
			PolygonGeometry.drawStarPath( mockCtx, 100, 100, 50, 25, 5 );

			expect( mockCtx.beginPath ).toHaveBeenCalled();
			expect( mockCtx.moveTo ).toHaveBeenCalledTimes( 1 );
			expect( mockCtx.lineTo ).toHaveBeenCalledTimes( 9 ); // 10 vertices - 1 moveTo
			expect( mockCtx.closePath ).toHaveBeenCalled();
		} );
	} );

	describe( 'getBoundsFromVertices', () => {
		it( 'should calculate correct bounds for triangle', () => {
			const vertices = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 50, y: 100 }
			];
			const bounds = PolygonGeometry.getBoundsFromVertices( vertices );

			expect( bounds.x ).toBe( 0 );
			expect( bounds.y ).toBe( 0 );
			expect( bounds.width ).toBe( 100 );
			expect( bounds.height ).toBe( 100 );
		} );

		it( 'should handle negative coordinates', () => {
			const vertices = [
				{ x: -50, y: -50 },
				{ x: 50, y: 50 }
			];
			const bounds = PolygonGeometry.getBoundsFromVertices( vertices );

			expect( bounds.x ).toBe( -50 );
			expect( bounds.y ).toBe( -50 );
			expect( bounds.width ).toBe( 100 );
			expect( bounds.height ).toBe( 100 );
		} );

		it( 'should return zero bounds for empty array', () => {
			const bounds = PolygonGeometry.getBoundsFromVertices( [] );
			expect( bounds ).toEqual( { x: 0, y: 0, width: 0, height: 0 } );
		} );
	} );

	describe( 'getPolygonBounds', () => {
		it( 'should calculate bounds for square polygon', () => {
			const bounds = PolygonGeometry.getPolygonBounds( 100, 100, 50, 4 );

			expect( bounds.width ).toBeGreaterThan( 0 );
			expect( bounds.height ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'getStarBounds', () => {
		it( 'should calculate bounds based on outer radius', () => {
			const outerRadius = 100;
			const bounds = PolygonGeometry.getStarBounds( 0, 0, outerRadius, 50, 5 );

			// Width and height should be approximately 2 * outerRadius
			expect( bounds.width ).toBeLessThanOrEqual( outerRadius * 2 );
			expect( bounds.height ).toBeLessThanOrEqual( outerRadius * 2 );
		} );
	} );

	describe( 'isPointInPolygon', () => {
		const square = [
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 100 },
			{ x: 0, y: 100 }
		];

		it( 'should return true for point inside polygon', () => {
			expect( PolygonGeometry.isPointInPolygon( 50, 50, square ) ).toBe( true );
		} );

		it( 'should return false for point outside polygon', () => {
			expect( PolygonGeometry.isPointInPolygon( 150, 150, square ) ).toBe( false );
		} );

		it( 'should return false for point to the left', () => {
			expect( PolygonGeometry.isPointInPolygon( -10, 50, square ) ).toBe( false );
		} );

		it( 'should handle triangle correctly', () => {
			const triangle = [
				{ x: 50, y: 0 },
				{ x: 100, y: 100 },
				{ x: 0, y: 100 }
			];
			expect( PolygonGeometry.isPointInPolygon( 50, 50, triangle ) ).toBe( true );
			expect( PolygonGeometry.isPointInPolygon( 50, 110, triangle ) ).toBe( false );
		} );

		it( 'should return false for insufficient vertices', () => {
			expect( PolygonGeometry.isPointInPolygon( 50, 50, [] ) ).toBe( false );
			expect( PolygonGeometry.isPointInPolygon( 50, 50, [ { x: 0, y: 0 } ] ) ).toBe( false );
		} );

		it( 'should return false for null vertices', () => {
			expect( PolygonGeometry.isPointInPolygon( 50, 50, null ) ).toBe( false );
		} );
	} );

	describe( 'namespace registration', () => {
		it( 'should export PolygonGeometry', () => {
			expect( PolygonGeometry ).toBeDefined();
			expect( typeof PolygonGeometry.getPolygonVertices ).toBe( 'function' );
			expect( typeof PolygonGeometry.getStarVertices ).toBe( 'function' );
			expect( typeof PolygonGeometry.drawPath ).toBe( 'function' );
			expect( typeof PolygonGeometry.isPointInPolygon ).toBe( 'function' );
		} );
	} );
} );
