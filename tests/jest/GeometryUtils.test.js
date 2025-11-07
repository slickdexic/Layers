/**
 * GeometryUtils.test.js - Unit tests for GeometryUtils module
 * 
 * Demonstrates modular testing approach for extracted CanvasManager functions.
 * Tests coordinate transformations, hit detection, and geometric calculations.
 */

const GeometryUtils = require( '../../resources/ext.layers.editor/GeometryUtils' );

describe( 'GeometryUtils', () => {
	
	describe( 'isPointInRect', () => {
		it( 'should return true for point inside rectangle', () => {
			const point = { x: 5, y: 5 };
			const rect = { x: 0, y: 0, width: 10, height: 10 };
			expect( GeometryUtils.isPointInRect( point, rect ) ).toBe( true );
		} );

		it( 'should return false for point outside rectangle', () => {
			const point = { x: 15, y: 5 };
			const rect = { x: 0, y: 0, width: 10, height: 10 };
			expect( GeometryUtils.isPointInRect( point, rect ) ).toBe( false );
		} );

		it( 'should return true for point on rectangle edge', () => {
			const point = { x: 10, y: 5 };
			const rect = { x: 0, y: 0, width: 10, height: 10 };
			expect( GeometryUtils.isPointInRect( point, rect ) ).toBe( true );
		} );
	} );

	describe( 'pointToSegmentDistance', () => {
		it( 'should calculate distance to horizontal line correctly', () => {
			const distance = GeometryUtils.pointToSegmentDistance( 5, 10, 0, 0, 10, 0 );
			expect( distance ).toBe( 10 );
		} );

		it( 'should calculate distance to vertical line correctly', () => {
			const distance = GeometryUtils.pointToSegmentDistance( 10, 5, 0, 0, 0, 10 );
			expect( distance ).toBe( 10 );
		} );

		it( 'should handle degenerate line segment (point)', () => {
			const distance = GeometryUtils.pointToSegmentDistance( 3, 4, 0, 0, 0, 0 );
			expect( distance ).toBe( 5 ); // Distance to origin
		} );

		it( 'should project point correctly onto line segment', () => {
			const distance = GeometryUtils.pointToSegmentDistance( 5, 5, 0, 0, 10, 0 );
			expect( distance ).toBe( 5 );
		} );
	} );

	describe( 'isPointNearLine', () => {
		it( 'should return true for point within tolerance', () => {
			const point = { x: 5, y: 3 };
			const result = GeometryUtils.isPointNearLine( point, 0, 0, 10, 0, 5 );
			expect( result ).toBe( true );
		} );

		it( 'should return false for point outside tolerance', () => {
			const point = { x: 5, y: 10 };
			const result = GeometryUtils.isPointNearLine( point, 0, 0, 10, 0, 5 );
			expect( result ).toBe( false );
		} );

		it( 'should use default tolerance of 6', () => {
			const point = { x: 5, y: 6 };
			const result = GeometryUtils.isPointNearLine( point, 0, 0, 10, 0 );
			expect( result ).toBe( true );
		} );
	} );

	describe( 'isPointInPolygon', () => {
		it( 'should return true for point inside triangle', () => {
			const point = { x: 1, y: 1 };
			const triangle = [
				{ x: 0, y: 0 },
				{ x: 3, y: 0 },
				{ x: 1.5, y: 3 }
			];
			expect( GeometryUtils.isPointInPolygon( point, triangle ) ).toBe( true );
		} );

		it( 'should return false for point outside triangle', () => {
			const point = { x: 5, y: 5 };
			const triangle = [
				{ x: 0, y: 0 },
				{ x: 3, y: 0 },
				{ x: 1.5, y: 3 }
			];
			expect( GeometryUtils.isPointInPolygon( point, triangle ) ).toBe( false );
		} );

		it( 'should handle square polygon', () => {
			const point = { x: 1, y: 1 };
			const square = [
				{ x: 0, y: 0 },
				{ x: 2, y: 0 },
				{ x: 2, y: 2 },
				{ x: 0, y: 2 }
			];
			expect( GeometryUtils.isPointInPolygon( point, square ) ).toBe( true );
		} );
	} );

	describe( 'distance', () => {
		it( 'should calculate distance between two points', () => {
			const point1 = { x: 0, y: 0 };
			const point2 = { x: 3, y: 4 };
			expect( GeometryUtils.distance( point1, point2 ) ).toBe( 5 );
		} );

		it( 'should return 0 for same point', () => {
			const point = { x: 5, y: 5 };
			expect( GeometryUtils.distance( point, point ) ).toBe( 0 );
		} );
	} );

	describe( 'getBoundingBox', () => {
		it( 'should calculate bounding box for multiple points', () => {
			const points = [
				{ x: 1, y: 2 },
				{ x: 5, y: 1 },
				{ x: 3, y: 6 },
				{ x: 0, y: 3 }
			];
			const bbox = GeometryUtils.getBoundingBox( points );
			expect( bbox ).toEqual( {
				x: 0,
				y: 1,
				width: 5,
				height: 5
			} );
		} );

		it( 'should return null for empty array', () => {
			expect( GeometryUtils.getBoundingBox( [] ) ).toBe( null );
		} );

		it( 'should handle single point', () => {
			const points = [ { x: 5, y: 10 } ];
			const bbox = GeometryUtils.getBoundingBox( points );
			expect( bbox ).toEqual( {
				x: 5,
				y: 10,
				width: 0,
				height: 0
			} );
		} );
	} );

	describe( 'clamp', () => {
		it( 'should clamp value below minimum', () => {
			expect( GeometryUtils.clamp( -5, 0, 10 ) ).toBe( 0 );
		} );

		it( 'should clamp value above maximum', () => {
			expect( GeometryUtils.clamp( 15, 0, 10 ) ).toBe( 10 );
		} );

		it( 'should return value within range unchanged', () => {
			expect( GeometryUtils.clamp( 5, 0, 10 ) ).toBe( 5 );
		} );
	} );

	describe( 'angle conversions', () => {
		it( 'should convert degrees to radians', () => {
			expect( GeometryUtils.degToRad( 180 ) ).toBeCloseTo( Math.PI );
			expect( GeometryUtils.degToRad( 90 ) ).toBeCloseTo( Math.PI / 2 );
		} );

		it( 'should convert radians to degrees', () => {
			expect( GeometryUtils.radToDeg( Math.PI ) ).toBeCloseTo( 180 );
			expect( GeometryUtils.radToDeg( Math.PI / 2 ) ).toBeCloseTo( 90 );
		} );
	} );

	describe( 'clientToCanvas', () => {
		let mockCanvas;

		beforeEach( () => {
			// Mock canvas element with getBoundingClientRect
			mockCanvas = {
				getBoundingClientRect: jest.fn().mockReturnValue( {
					left: 100,
					top: 50,
					width: 200,
					height: 150
				} ),
				width: 400,
				height: 300
			};
		} );

		it( 'should convert client coordinates to canvas coordinates', () => {
			const result = GeometryUtils.clientToCanvas( mockCanvas, 150, 100 );
			expect( result ).toEqual( { x: 100, y: 100 } );
		} );

		it( 'should apply grid snapping when enabled', () => {
			const options = { snapToGrid: true, gridSize: 10 };
			const result = GeometryUtils.clientToCanvas( mockCanvas, 147, 103, options );
			expect( result ).toEqual( { x: 90, y: 110 } ); // Snapped to grid
		} );

		it( 'should not snap when grid is disabled', () => {
			const options = { snapToGrid: false, gridSize: 10 };
			const result = GeometryUtils.clientToCanvas( mockCanvas, 147, 103, options );
			expect( result ).toEqual( { x: 94, y: 106 } ); // Not snapped
		} );
	} );

	describe( 'clientToRawCanvas', () => {
		let mockCanvas;

		beforeEach( () => {
			mockCanvas = {
				getBoundingClientRect: jest.fn().mockReturnValue( {
					left: 100,
					top: 50
				} )
			};
		} );

		it( 'should convert client coordinates to raw canvas with pan/zoom', () => {
			const result = GeometryUtils.clientToRawCanvas( mockCanvas, 150, 100, 20, 10, 2 );
			expect( result ).toEqual( { canvasX: 15, canvasY: 20 } );
		} );

		it( 'should handle zero pan and zoom of 1', () => {
			const result = GeometryUtils.clientToRawCanvas( mockCanvas, 150, 100, 0, 0, 1 );
			expect( result ).toEqual( { canvasX: 50, canvasY: 50 } );
		} );
	} );

} );
