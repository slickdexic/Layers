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

	describe( 'getLayerBoundsForType', () => {
		it( 'should return null for null layer', () => {
			expect( GeometryUtils.getLayerBoundsForType( null ) ).toBeNull();
		} );

		it( 'should return null for layer without type', () => {
			expect( GeometryUtils.getLayerBoundsForType( { x: 10, y: 10 } ) ).toBeNull();
		} );

		it( 'should return null for text layer (requires canvas context)', () => {
			expect( GeometryUtils.getLayerBoundsForType( { type: 'text', x: 10, y: 10 } ) ).toBeNull();
		} );

		it( 'should calculate bounds for rectangle', () => {
			const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			expect( GeometryUtils.getLayerBoundsForType( layer ) ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		it( 'should handle negative width/height for rectangle', () => {
			const layer = { type: 'rectangle', x: 100, y: 100, width: -50, height: -30 };
			const bounds = GeometryUtils.getLayerBoundsForType( layer );
			expect( bounds.x ).toBe( 50 );
			expect( bounds.y ).toBe( 70 );
			expect( bounds.width ).toBe( 50 );
			expect( bounds.height ).toBe( 30 );
		} );

		it( 'should calculate bounds for circle', () => {
			const layer = { type: 'circle', x: 100, y: 100, radius: 50 };
			expect( GeometryUtils.getLayerBoundsForType( layer ) ).toEqual( { x: 50, y: 50, width: 100, height: 100 } );
		} );

		it( 'should calculate bounds for ellipse', () => {
			const layer = { type: 'ellipse', x: 100, y: 100, radiusX: 60, radiusY: 40 };
			expect( GeometryUtils.getLayerBoundsForType( layer ) ).toEqual( { x: 40, y: 60, width: 120, height: 80 } );
		} );

		it( 'should calculate bounds for line', () => {
			const layer = { type: 'line', x1: 10, y1: 20, x2: 100, y2: 80 };
			const bounds = GeometryUtils.getLayerBoundsForType( layer );
			expect( bounds.x ).toBe( 10 );
			expect( bounds.y ).toBe( 20 );
			expect( bounds.width ).toBe( 90 );
			expect( bounds.height ).toBe( 60 );
		} );

		it( 'should calculate bounds for arrow', () => {
			const layer = { type: 'arrow', x1: 50, y1: 50, x2: 150, y2: 100 };
			const bounds = GeometryUtils.getLayerBoundsForType( layer );
			expect( bounds.x ).toBe( 50 );
			expect( bounds.y ).toBe( 50 );
			expect( bounds.width ).toBe( 100 );
			expect( bounds.height ).toBe( 50 );
		} );

		it( 'should calculate bounds for polygon with points', () => {
			const layer = { type: 'polygon', points: [ { x: 10, y: 10 }, { x: 100, y: 20 }, { x: 50, y: 80 } ] };
			const bounds = GeometryUtils.getLayerBoundsForType( layer );
			expect( bounds.x ).toBe( 10 );
			expect( bounds.y ).toBe( 10 );
			expect( bounds.width ).toBe( 90 );
			expect( bounds.height ).toBe( 70 );
		} );

		it( 'should use radius fallback for polygon without points', () => {
			const layer = { type: 'polygon', x: 100, y: 100, radius: 30 };
			const bounds = GeometryUtils.getLayerBoundsForType( layer );
			expect( bounds.x ).toBe( 70 );
			expect( bounds.y ).toBe( 70 );
			expect( bounds.width ).toBe( 60 );
			expect( bounds.height ).toBe( 60 );
		} );

		it( 'should use outerRadius for star', () => {
			const layer = { type: 'star', x: 100, y: 100, outerRadius: 40 };
			const bounds = GeometryUtils.getLayerBoundsForType( layer );
			expect( bounds.x ).toBe( 60 );
			expect( bounds.y ).toBe( 60 );
			expect( bounds.width ).toBe( 80 );
			expect( bounds.height ).toBe( 80 );
		} );

		it( 'should handle rectangle layer with bounds', () => {
			const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			expect( GeometryUtils.getLayerBoundsForType( layer ) ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		it( 'should handle blur layer like rectangle', () => {
			const layer = { type: 'blur', x: 10, y: 20, width: 100, height: 50 };
			expect( GeometryUtils.getLayerBoundsForType( layer ) ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		it( 'should handle textbox layer like rectangle', () => {
			const layer = { type: 'textbox', x: 15, y: 25, width: 200, height: 100 };
			expect( GeometryUtils.getLayerBoundsForType( layer ) ).toEqual( { x: 15, y: 25, width: 200, height: 100 } );
		} );

		it( 'should handle image layer like rectangle', () => {
			const layer = { type: 'image', x: 0, y: 0, width: 400, height: 300 };
			expect( GeometryUtils.getLayerBoundsForType( layer ) ).toEqual( { x: 0, y: 0, width: 400, height: 300 } );
		} );

		it( 'should handle rectangle with missing x/y as zero', () => {
			const layer = { type: 'rectangle', width: 100, height: 50 };
			expect( GeometryUtils.getLayerBoundsForType( layer ) ).toEqual( { x: 0, y: 0, width: 100, height: 50 } );
		} );

		it( 'should handle rectangle with missing width/height as zero', () => {
			const layer = { type: 'rectangle', x: 10, y: 20 };
			expect( GeometryUtils.getLayerBoundsForType( layer ) ).toEqual( { x: 10, y: 20, width: 0, height: 0 } );
		} );

		it( 'should handle line with only x,y properties (no x1,y1,x2,y2)', () => {
			const layer = { type: 'line', x: 50, y: 75 };
			const bounds = GeometryUtils.getLayerBoundsForType( layer );
			expect( bounds.x ).toBe( 50 );
			expect( bounds.y ).toBe( 75 );
			expect( bounds.width ).toBe( 1 );
			expect( bounds.height ).toBe( 1 );
		} );

		it( 'should handle ellipse using radius as fallback for radiusX/radiusY', () => {
			const layer = { type: 'ellipse', x: 100, y: 100, radius: 50 };
			expect( GeometryUtils.getLayerBoundsForType( layer ) ).toEqual( { x: 50, y: 50, width: 100, height: 100 } );
		} );

		it( 'should handle path with points', () => {
			const layer = { type: 'path', points: [ { x: 0, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 } ] };
			const bounds = GeometryUtils.getLayerBoundsForType( layer );
			expect( bounds.x ).toBe( 0 );
			expect( bounds.y ).toBe( 0 );
			expect( bounds.width ).toBe( 100 );
			expect( bounds.height ).toBe( 100 );
		} );

		it( 'should handle path without points using radius fallback', () => {
			const layer = { type: 'path', x: 100, y: 100, radius: 30 };
			const bounds = GeometryUtils.getLayerBoundsForType( layer );
			expect( bounds.x ).toBe( 70 );
			expect( bounds.y ).toBe( 70 );
			expect( bounds.width ).toBe( 60 );
			expect( bounds.height ).toBe( 60 );
		} );

		it( 'should use default radius of 50 for polygon without radius', () => {
			const layer = { type: 'polygon', x: 100, y: 100 };
			const bounds = GeometryUtils.getLayerBoundsForType( layer );
			expect( bounds.x ).toBe( 50 );
			expect( bounds.y ).toBe( 50 );
			expect( bounds.width ).toBe( 100 );
			expect( bounds.height ).toBe( 100 );
		} );

		it( 'should return default bounds for unknown type', () => {
			const layer = { type: 'unknown', x: 10, y: 20, width: 30, height: 40 };
			expect( GeometryUtils.getLayerBoundsForType( layer ) ).toEqual( { x: 10, y: 20, width: 30, height: 40 } );
		} );

		it( 'should use default 50x50 for unknown type without dimensions', () => {
			const layer = { type: 'custom', x: 10, y: 20 };
			const bounds = GeometryUtils.getLayerBoundsForType( layer );
			expect( bounds.x ).toBe( 10 );
			expect( bounds.y ).toBe( 20 );
			expect( bounds.width ).toBe( 50 );
			expect( bounds.height ).toBe( 50 );
		} );
	} );

	describe( 'computeAxisAlignedBounds', () => {
		it( 'should return zero bounds for null rect', () => {
			expect( GeometryUtils.computeAxisAlignedBounds( null, 0 ) ).toEqual( { left: 0, top: 0, right: 0, bottom: 0 } );
		} );

		it( 'should return unchanged bounds for zero rotation', () => {
			const rect = { x: 10, y: 20, width: 100, height: 50 };
			const bounds = GeometryUtils.computeAxisAlignedBounds( rect, 0 );
			expect( bounds ).toEqual( { left: 10, top: 20, right: 110, bottom: 70 } );
		} );

		it( 'should compute axis-aligned bounds for 45 degree rotation', () => {
			const rect = { x: 0, y: 0, width: 100, height: 100 };
			const bounds = GeometryUtils.computeAxisAlignedBounds( rect, 45 );
			// For a 100x100 square rotated 45 degrees, the diagonal is ~141.4
			expect( bounds.right - bounds.left ).toBeCloseTo( 141.4, 0 );
			expect( bounds.bottom - bounds.top ).toBeCloseTo( 141.4, 0 );
		} );

		it( 'should compute axis-aligned bounds for 90 degree rotation', () => {
			const rect = { x: 0, y: 0, width: 100, height: 50 };
			const bounds = GeometryUtils.computeAxisAlignedBounds( rect, 90 );
			// For a 100x50 rectangle rotated 90 degrees, it becomes 50x100
			expect( bounds.right - bounds.left ).toBeCloseTo( 50, 0 );
			expect( bounds.bottom - bounds.top ).toBeCloseTo( 100, 0 );
		} );

		it( 'should handle undefined rotation as zero', () => {
			const rect = { x: 10, y: 20, width: 100, height: 50 };
			const bounds = GeometryUtils.computeAxisAlignedBounds( rect, undefined );
			expect( bounds ).toEqual( { left: 10, top: 20, right: 110, bottom: 70 } );
		} );
	} );

} );
