/**
 * Tests for BoundsCalculator utility
 */

const BoundsCalculator = require( '../../resources/ext.layers.shared/BoundsCalculator.js' );

describe( 'BoundsCalculator', () => {
	describe( 'getLayerBounds', () => {
		test( 'should return null for null layer', () => {
			expect( BoundsCalculator.getLayerBounds( null ) ).toBeNull();
		} );

		test( 'should return null for undefined layer', () => {
			expect( BoundsCalculator.getLayerBounds( undefined ) ).toBeNull();
		} );

		test( 'should return null for empty object', () => {
			expect( BoundsCalculator.getLayerBounds( {} ) ).toBeNull();
		} );

		test( 'should get bounds for rectangle layer', () => {
			const layer = { x: 10, y: 20, width: 100, height: 50 };
			const bounds = BoundsCalculator.getLayerBounds( layer );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		test( 'should get bounds for line layer', () => {
			const layer = { x1: 10, y1: 20, x2: 110, y2: 70 };
			const bounds = BoundsCalculator.getLayerBounds( layer );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		test( 'should get bounds for circle layer', () => {
			const layer = { x: 50, y: 50, radius: 25 };
			const bounds = BoundsCalculator.getLayerBounds( layer );
			expect( bounds ).toEqual( { x: 25, y: 25, width: 50, height: 50 } );
		} );

		test( 'should get bounds for polygon layer', () => {
			const layer = { points: [ { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 } ] };
			const bounds = BoundsCalculator.getLayerBounds( layer );
			expect( bounds ).toEqual( { x: 0, y: 0, width: 100, height: 50 } );
		} );
	} );

	describe( 'getRectangularBounds', () => {
		test( 'should return null if missing x', () => {
			expect( BoundsCalculator.getRectangularBounds( { y: 0, width: 10, height: 10 } ) ).toBeNull();
		} );

		test( 'should return null if missing y', () => {
			expect( BoundsCalculator.getRectangularBounds( { x: 0, width: 10, height: 10 } ) ).toBeNull();
		} );

		test( 'should return null if missing width', () => {
			expect( BoundsCalculator.getRectangularBounds( { x: 0, y: 0, height: 10 } ) ).toBeNull();
		} );

		test( 'should return null if missing height', () => {
			expect( BoundsCalculator.getRectangularBounds( { x: 0, y: 0, width: 10 } ) ).toBeNull();
		} );

		test( 'should calculate bounds correctly', () => {
			const bounds = BoundsCalculator.getRectangularBounds( { x: 10, y: 20, width: 100, height: 50 } );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		test( 'should handle negative width', () => {
			const bounds = BoundsCalculator.getRectangularBounds( { x: 110, y: 20, width: -100, height: 50 } );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		test( 'should handle negative height', () => {
			const bounds = BoundsCalculator.getRectangularBounds( { x: 10, y: 70, width: 100, height: -50 } );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		test( 'should handle both negative dimensions', () => {
			const bounds = BoundsCalculator.getRectangularBounds( { x: 110, y: 70, width: -100, height: -50 } );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		test( 'should handle zero dimensions', () => {
			const bounds = BoundsCalculator.getRectangularBounds( { x: 10, y: 20, width: 0, height: 0 } );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 0, height: 0 } );
		} );
	} );

	describe( 'getLineBounds', () => {
		test( 'should return null if missing x1', () => {
			expect( BoundsCalculator.getLineBounds( { y1: 0, x2: 10, y2: 10 } ) ).toBeNull();
		} );

		test( 'should return null if missing y1', () => {
			expect( BoundsCalculator.getLineBounds( { x1: 0, x2: 10, y2: 10 } ) ).toBeNull();
		} );

		test( 'should return null if missing x2', () => {
			expect( BoundsCalculator.getLineBounds( { x1: 0, y1: 0, y2: 10 } ) ).toBeNull();
		} );

		test( 'should return null if missing y2', () => {
			expect( BoundsCalculator.getLineBounds( { x1: 0, y1: 0, x2: 10 } ) ).toBeNull();
		} );

		test( 'should calculate bounds for horizontal line', () => {
			const bounds = BoundsCalculator.getLineBounds( { x1: 10, y1: 50, x2: 110, y2: 50 } );
			expect( bounds ).toEqual( { x: 10, y: 50, width: 100, height: 0 } );
		} );

		test( 'should calculate bounds for vertical line', () => {
			const bounds = BoundsCalculator.getLineBounds( { x1: 50, y1: 10, x2: 50, y2: 110 } );
			expect( bounds ).toEqual( { x: 50, y: 10, width: 0, height: 100 } );
		} );

		test( 'should calculate bounds for diagonal line', () => {
			const bounds = BoundsCalculator.getLineBounds( { x1: 10, y1: 20, x2: 110, y2: 70 } );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		test( 'should handle reversed coordinates', () => {
			const bounds = BoundsCalculator.getLineBounds( { x1: 110, y1: 70, x2: 10, y2: 20 } );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );
	} );

	describe( 'getEllipseBounds', () => {
		test( 'should return null if missing x', () => {
			expect( BoundsCalculator.getEllipseBounds( { y: 50, radius: 25 } ) ).toBeNull();
		} );

		test( 'should return null if missing y', () => {
			expect( BoundsCalculator.getEllipseBounds( { x: 50, radius: 25 } ) ).toBeNull();
		} );

		test( 'should return null if missing all radii', () => {
			expect( BoundsCalculator.getEllipseBounds( { x: 50, y: 50 } ) ).toBeNull();
		} );

		test( 'should calculate bounds for circle with radius', () => {
			const bounds = BoundsCalculator.getEllipseBounds( { x: 50, y: 50, radius: 25 } );
			expect( bounds ).toEqual( { x: 25, y: 25, width: 50, height: 50 } );
		} );

		test( 'should calculate bounds for ellipse with radiusX and radiusY', () => {
			const bounds = BoundsCalculator.getEllipseBounds( { x: 50, y: 50, radiusX: 40, radiusY: 20 } );
			expect( bounds ).toEqual( { x: 10, y: 30, width: 80, height: 40 } );
		} );

		test( 'should prefer radiusX over radius', () => {
			const bounds = BoundsCalculator.getEllipseBounds( { x: 50, y: 50, radius: 10, radiusX: 40 } );
			expect( bounds.width ).toBe( 80 );
		} );

		test( 'should prefer radiusY over radius', () => {
			const bounds = BoundsCalculator.getEllipseBounds( { x: 50, y: 50, radius: 10, radiusY: 30 } );
			expect( bounds.height ).toBe( 60 );
		} );

		test( 'should handle negative radius', () => {
			const bounds = BoundsCalculator.getEllipseBounds( { x: 50, y: 50, radius: -25 } );
			expect( bounds ).toEqual( { x: 25, y: 25, width: 50, height: 50 } );
		} );

		test( 'should use radiusX only when radiusY is missing', () => {
			const bounds = BoundsCalculator.getEllipseBounds( { x: 50, y: 50, radiusX: 30 } );
			expect( bounds ).toEqual( { x: 20, y: 50, width: 60, height: 0 } );
		} );
	} );

	describe( 'getPolygonBounds', () => {
		test( 'should return null if points is not array', () => {
			expect( BoundsCalculator.getPolygonBounds( { points: 'not-array' } ) ).toBeNull();
		} );

		test( 'should return null if points array is empty', () => {
			expect( BoundsCalculator.getPolygonBounds( { points: [] } ) ).toBeNull();
		} );

		test( 'should return null if points array has only one point', () => {
			expect( BoundsCalculator.getPolygonBounds( { points: [ { x: 0, y: 0 } ] } ) ).toBeNull();
		} );

		test( 'should calculate bounds for triangle', () => {
			const bounds = BoundsCalculator.getPolygonBounds( {
				points: [ { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 } ]
			} );
			expect( bounds ).toEqual( { x: 0, y: 0, width: 100, height: 50 } );
		} );

		test( 'should calculate bounds for pentagon', () => {
			const bounds = BoundsCalculator.getPolygonBounds( {
				points: [
					{ x: 50, y: 0 },
					{ x: 100, y: 40 },
					{ x: 80, y: 100 },
					{ x: 20, y: 100 },
					{ x: 0, y: 40 }
				]
			} );
			expect( bounds ).toEqual( { x: 0, y: 0, width: 100, height: 100 } );
		} );

		test( 'should handle negative coordinates', () => {
			const bounds = BoundsCalculator.getPolygonBounds( {
				points: [ { x: -50, y: -50 }, { x: 50, y: -50 }, { x: 0, y: 50 } ]
			} );
			expect( bounds ).toEqual( { x: -50, y: -50, width: 100, height: 100 } );
		} );

		test( 'should ignore points with missing coordinates', () => {
			const bounds = BoundsCalculator.getPolygonBounds( {
				points: [ { x: 0, y: 0 }, { x: 100 }, { y: 50 }, { x: 100, y: 100 } ]
			} );
			expect( bounds ).toEqual( { x: 0, y: 0, width: 100, height: 100 } );
		} );
	} );

	describe( 'getTextBounds', () => {
		test( 'should return null for non-text layer', () => {
			expect( BoundsCalculator.getTextBounds( { type: 'rectangle', x: 0, y: 0 } ) ).toBeNull();
		} );

		test( 'should return null if missing x', () => {
			expect( BoundsCalculator.getTextBounds( { type: 'text', y: 50 } ) ).toBeNull();
		} );

		test( 'should return null if missing y', () => {
			expect( BoundsCalculator.getTextBounds( { type: 'text', x: 50 } ) ).toBeNull();
		} );

		test( 'should calculate bounds for text layer', () => {
			const bounds = BoundsCalculator.getTextBounds( {
				type: 'text', x: 10, y: 50, fontSize: 20, text: 'Hello'
			} );
			expect( bounds.x ).toBe( 10 );
			expect( bounds.y ).toBe( 30 ); // y - fontSize
			expect( bounds.height ).toBe( 24 ); // fontSize * 1.2
		} );

		test( 'should use default fontSize if not specified', () => {
			const bounds = BoundsCalculator.getTextBounds( {
				type: 'text', x: 10, y: 50
			} );
			expect( bounds.y ).toBe( 34 ); // y - 16 (default fontSize)
		} );

		test( 'should use explicit width if provided', () => {
			const bounds = BoundsCalculator.getTextBounds( {
				type: 'text', x: 10, y: 50, width: 200, height: 30
			} );
			expect( bounds.width ).toBe( 200 );
			expect( bounds.height ).toBe( 30 );
		} );
	} );

	describe( 'mergeBounds', () => {
		test( 'should return null for empty array', () => {
			expect( BoundsCalculator.mergeBounds( [] ) ).toBeNull();
		} );

		test( 'should return null for null input', () => {
			expect( BoundsCalculator.mergeBounds( null ) ).toBeNull();
		} );

		test( 'should return single bounds unchanged', () => {
			const bounds = [ { x: 10, y: 20, width: 100, height: 50 } ];
			expect( BoundsCalculator.mergeBounds( bounds ) ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		test( 'should merge two non-overlapping bounds', () => {
			const bounds = [
				{ x: 0, y: 0, width: 50, height: 50 },
				{ x: 100, y: 100, width: 50, height: 50 }
			];
			expect( BoundsCalculator.mergeBounds( bounds ) ).toEqual( { x: 0, y: 0, width: 150, height: 150 } );
		} );

		test( 'should merge overlapping bounds', () => {
			const bounds = [
				{ x: 0, y: 0, width: 100, height: 100 },
				{ x: 50, y: 50, width: 100, height: 100 }
			];
			expect( BoundsCalculator.mergeBounds( bounds ) ).toEqual( { x: 0, y: 0, width: 150, height: 150 } );
		} );

		test( 'should ignore null entries', () => {
			const bounds = [
				{ x: 10, y: 20, width: 100, height: 50 },
				null,
				undefined
			];
			expect( BoundsCalculator.mergeBounds( bounds ) ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );
	} );

	describe( 'getMultiLayerBounds', () => {
		test( 'should return null for empty array', () => {
			expect( BoundsCalculator.getMultiLayerBounds( [] ) ).toBeNull();
		} );

		test( 'should return null for null input', () => {
			expect( BoundsCalculator.getMultiLayerBounds( null ) ).toBeNull();
		} );

		test( 'should get bounds for single layer', () => {
			const layers = [ { x: 10, y: 20, width: 100, height: 50 } ];
			expect( BoundsCalculator.getMultiLayerBounds( layers ) ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		test( 'should get combined bounds for multiple layers', () => {
			const layers = [
				{ x: 0, y: 0, width: 50, height: 50 },
				{ x1: 60, y1: 60, x2: 100, y2: 100 }
			];
			expect( BoundsCalculator.getMultiLayerBounds( layers ) ).toEqual( { x: 0, y: 0, width: 100, height: 100 } );
		} );

		test( 'should handle mixed layer types', () => {
			const layers = [
				{ x: 50, y: 50, radius: 25 }, // Circle
				{ x: 100, y: 0, width: 50, height: 50 } // Rectangle
			];
			const bounds = BoundsCalculator.getMultiLayerBounds( layers );
			expect( bounds.x ).toBe( 25 );
			expect( bounds.y ).toBe( 0 );
			expect( bounds.width ).toBe( 125 );
			expect( bounds.height ).toBe( 75 );
		} );
	} );

	describe( 'isPointInBounds', () => {
		test( 'should return false for null point', () => {
			expect( BoundsCalculator.isPointInBounds( null, { x: 0, y: 0, width: 100, height: 100 } ) ).toBe( false );
		} );

		test( 'should return false for null bounds', () => {
			expect( BoundsCalculator.isPointInBounds( { x: 50, y: 50 }, null ) ).toBe( false );
		} );

		test( 'should return true for point inside bounds', () => {
			expect( BoundsCalculator.isPointInBounds( { x: 50, y: 50 }, { x: 0, y: 0, width: 100, height: 100 } ) ).toBe( true );
		} );

		test( 'should return true for point on edge', () => {
			expect( BoundsCalculator.isPointInBounds( { x: 0, y: 0 }, { x: 0, y: 0, width: 100, height: 100 } ) ).toBe( true );
			expect( BoundsCalculator.isPointInBounds( { x: 100, y: 100 }, { x: 0, y: 0, width: 100, height: 100 } ) ).toBe( true );
		} );

		test( 'should return false for point outside bounds', () => {
			expect( BoundsCalculator.isPointInBounds( { x: -1, y: 50 }, { x: 0, y: 0, width: 100, height: 100 } ) ).toBe( false );
			expect( BoundsCalculator.isPointInBounds( { x: 101, y: 50 }, { x: 0, y: 0, width: 100, height: 100 } ) ).toBe( false );
		} );
	} );

	describe( 'boundsIntersect', () => {
		test( 'should return false for null bounds', () => {
			expect( BoundsCalculator.boundsIntersect( null, { x: 0, y: 0, width: 100, height: 100 } ) ).toBe( false );
			expect( BoundsCalculator.boundsIntersect( { x: 0, y: 0, width: 100, height: 100 }, null ) ).toBe( false );
		} );

		test( 'should return true for overlapping bounds', () => {
			const bounds1 = { x: 0, y: 0, width: 100, height: 100 };
			const bounds2 = { x: 50, y: 50, width: 100, height: 100 };
			expect( BoundsCalculator.boundsIntersect( bounds1, bounds2 ) ).toBe( true );
		} );

		test( 'should return true for touching bounds', () => {
			const bounds1 = { x: 0, y: 0, width: 100, height: 100 };
			const bounds2 = { x: 100, y: 0, width: 100, height: 100 };
			expect( BoundsCalculator.boundsIntersect( bounds1, bounds2 ) ).toBe( true );
		} );

		test( 'should return false for non-overlapping bounds', () => {
			const bounds1 = { x: 0, y: 0, width: 50, height: 50 };
			const bounds2 = { x: 100, y: 100, width: 50, height: 50 };
			expect( BoundsCalculator.boundsIntersect( bounds1, bounds2 ) ).toBe( false );
		} );

		test( 'should return true for contained bounds', () => {
			const bounds1 = { x: 0, y: 0, width: 200, height: 200 };
			const bounds2 = { x: 50, y: 50, width: 50, height: 50 };
			expect( BoundsCalculator.boundsIntersect( bounds1, bounds2 ) ).toBe( true );
		} );
	} );

	describe( 'expandBounds', () => {
		test( 'should return original bounds if amount is not a number', () => {
			const bounds = { x: 10, y: 20, width: 100, height: 50 };
			expect( BoundsCalculator.expandBounds( bounds, 'invalid' ) ).toBe( bounds );
		} );

		test( 'should expand bounds by positive amount', () => {
			const bounds = { x: 10, y: 20, width: 100, height: 50 };
			const expanded = BoundsCalculator.expandBounds( bounds, 5 );
			expect( expanded ).toEqual( { x: 5, y: 15, width: 110, height: 60 } );
		} );

		test( 'should shrink bounds by negative amount', () => {
			const bounds = { x: 10, y: 20, width: 100, height: 50 };
			const shrunk = BoundsCalculator.expandBounds( bounds, -5 );
			expect( shrunk ).toEqual( { x: 15, y: 25, width: 90, height: 40 } );
		} );

		test( 'should handle zero expansion', () => {
			const bounds = { x: 10, y: 20, width: 100, height: 50 };
			const expanded = BoundsCalculator.expandBounds( bounds, 0 );
			expect( expanded ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );
	} );

	describe( 'getBoundsCenter', () => {
		test( 'should return null for null bounds', () => {
			expect( BoundsCalculator.getBoundsCenter( null ) ).toBeNull();
		} );

		test( 'should calculate center correctly', () => {
			const center = BoundsCalculator.getBoundsCenter( { x: 0, y: 0, width: 100, height: 100 } );
			expect( center ).toEqual( { x: 50, y: 50 } );
		} );

		test( 'should handle non-zero origin', () => {
			const center = BoundsCalculator.getBoundsCenter( { x: 10, y: 20, width: 100, height: 50 } );
			expect( center ).toEqual( { x: 60, y: 45 } );
		} );

		test( 'should handle zero dimensions', () => {
			const center = BoundsCalculator.getBoundsCenter( { x: 50, y: 50, width: 0, height: 0 } );
			expect( center ).toEqual( { x: 50, y: 50 } );
		} );
	} );
} );
