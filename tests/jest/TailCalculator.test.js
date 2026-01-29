/**
 * Tests for TailCalculator class
 *
 * TailCalculator handles geometric calculations for callout tail positioning,
 * including perimeter point calculation, tail coordinate computation, and
 * edge/corner detection.
 */

'use strict';

// Set up global before loading module
beforeAll( () => {
	// Set up Layers namespace
	window.Layers = window.Layers || {};

	// Load the module
	require( '../../resources/ext.layers.shared/TailCalculator.js' );
} );

beforeEach( () => {
	jest.clearAllMocks();
} );

describe( 'TailCalculator', () => {
	describe( 'constructor', () => {
		test( 'should create instance without parameters', () => {
			const calc = new window.Layers.TailCalculator();
			expect( calc ).toBeDefined();
		} );
	} );

	describe( 'getClosestPerimeterPoint', () => {
		let calc;

		beforeEach( () => {
			calc = new window.Layers.TailCalculator();
		} );

		test( 'should find point on bottom edge', () => {
			// Rectangle at (0, 0) with width 100, height 100, corner radius 10
			// Point below center should snap to bottom edge
			const result = calc.getClosestPerimeterPoint( 50, 150, 0, 0, 100, 100, 10 );

			expect( result.edge ).toBe( 'bottom' );
			expect( result.baseY ).toBe( 100 );
			expect( result.tangentX ).toBe( -1 ); // Horizontal edge tangent
			expect( result.tangentY ).toBe( 0 );
		} );

		test( 'should find point on top edge', () => {
			const result = calc.getClosestPerimeterPoint( 50, -50, 0, 0, 100, 100, 10 );

			expect( result.edge ).toBe( 'top' );
			expect( result.baseY ).toBe( 0 );
		} );

		test( 'should find point on left edge', () => {
			const result = calc.getClosestPerimeterPoint( -50, 50, 0, 0, 100, 100, 10 );

			expect( result.edge ).toBe( 'left' );
			expect( result.baseX ).toBe( 0 );
		} );

		test( 'should find point on right edge', () => {
			const result = calc.getClosestPerimeterPoint( 150, 50, 0, 0, 100, 100, 10 );

			expect( result.edge ).toBe( 'right' );
			expect( result.baseX ).toBe( 100 );
		} );

		test( 'should find point on bottom-right corner arc', () => {
			// Point diagonal from bottom-right corner
			const result = calc.getClosestPerimeterPoint( 120, 120, 0, 0, 100, 100, 20 );

			expect( result.edge ).toBe( 'br' );
		} );

		test( 'should find point on top-left corner arc', () => {
			const result = calc.getClosestPerimeterPoint( -20, -20, 0, 0, 100, 100, 20 );

			expect( result.edge ).toBe( 'tl' );
		} );

		test( 'should find point on top-right corner arc', () => {
			const result = calc.getClosestPerimeterPoint( 120, -20, 0, 0, 100, 100, 20 );

			expect( result.edge ).toBe( 'tr' );
		} );

		test( 'should find point on bottom-left corner arc', () => {
			const result = calc.getClosestPerimeterPoint( -20, 120, 0, 0, 100, 100, 20 );

			expect( result.edge ).toBe( 'bl' );
		} );

		test( 'should handle zero corner radius', () => {
			const result = calc.getClosestPerimeterPoint( 50, 150, 0, 0, 100, 100, 0 );

			expect( result.edge ).toBe( 'bottom' );
			expect( result.baseY ).toBe( 100 );
		} );

		test( 'should clamp corner radius to half minimum dimension', () => {
			// Radius larger than half the min dimension should be clamped
			const result = calc.getClosestPerimeterPoint( 50, 100, 0, 0, 100, 50, 100 );

			// Should still work correctly with clamped radius
			expect( result ).toBeDefined();
			expect( result.edge ).toBeDefined();
		} );

		test( 'should return correct tangent vectors for edges', () => {
			const calc2 = new window.Layers.TailCalculator();

			const bottomResult = calc2.getClosestPerimeterPoint( 50, 150, 0, 0, 100, 100, 10 );
			expect( bottomResult.tangentX ).toBe( -1 );
			expect( bottomResult.tangentY ).toBe( 0 );

			const topResult = calc2.getClosestPerimeterPoint( 50, -50, 0, 0, 100, 100, 10 );
			expect( topResult.tangentX ).toBe( 1 );
			expect( topResult.tangentY ).toBe( 0 );

			const leftResult = calc2.getClosestPerimeterPoint( -50, 50, 0, 0, 100, 100, 10 );
			expect( leftResult.tangentX ).toBe( 0 );
			expect( leftResult.tangentY ).toBe( -1 );

			const rightResult = calc2.getClosestPerimeterPoint( 150, 50, 0, 0, 100, 100, 10 );
			expect( rightResult.tangentX ).toBe( 0 );
			expect( rightResult.tangentY ).toBe( 1 );
		} );

		test( 'should clamp base points to safe zone on edges', () => {
			const calc2 = new window.Layers.TailCalculator();

			// Point near corner but outside arc
			const result = calc2.getClosestPerimeterPoint( 50, 150, 0, 0, 100, 100, 10 );

			// Base X should be within safe zone
			expect( result.baseX ).toBeGreaterThanOrEqual( 10 );
			expect( result.baseX ).toBeLessThanOrEqual( 90 );
		} );
	} );

	describe( 'getTailFromTipPosition', () => {
		let calc;

		beforeEach( () => {
			calc = new window.Layers.TailCalculator();
		} );

		test( 'should calculate tail for tip below rectangle', () => {
			// Rectangle at (0, 0), size 200x100
			// Tip at (100, 150) - below center
			const result = calc.getTailFromTipPosition( 0, 0, 200, 100, 100, 150, 10 );

			expect( result.edge ).toBe( 'bottom' );
			expect( result.tip.x ).toBe( 100 );
			expect( result.tip.y ).toBe( 150 );
			expect( result.base1 ).toBeDefined();
			expect( result.base2 ).toBeDefined();
		} );

		test( 'should calculate tail for tip above rectangle', () => {
			const result = calc.getTailFromTipPosition( 0, 100, 200, 100, 100, -50, 10 );

			expect( result.edge ).toBe( 'top' );
		} );

		test( 'should calculate tail for tip to the left', () => {
			const result = calc.getTailFromTipPosition( 100, 0, 100, 200, -50, 100, 10 );

			expect( result.edge ).toBe( 'left' );
		} );

		test( 'should calculate tail for tip to the right', () => {
			const result = calc.getTailFromTipPosition( 0, 0, 100, 200, 150, 100, 10 );

			expect( result.edge ).toBe( 'right' );
		} );

		test( 'should attach to corner for diagonal tip position', () => {
			// Tip at bottom-right corner direction
			const result = calc.getTailFromTipPosition( 0, 0, 100, 100, 150, 150, 20 );

			expect( result.edge ).toBe( 'br' );
		} );

		test( 'should scale base width with distance', () => {
			// Near tip should have smaller base
			const nearResult = calc.getTailFromTipPosition( 0, 0, 100, 100, 50, 110, 10 );

			// Far tip should have larger base
			const farResult = calc.getTailFromTipPosition( 0, 0, 100, 100, 50, 200, 10 );

			const nearBaseWidth = Math.abs( nearResult.base2.x - nearResult.base1.x ) +
				Math.abs( nearResult.base2.y - nearResult.base1.y );
			const farBaseWidth = Math.abs( farResult.base2.x - farResult.base1.x ) +
				Math.abs( farResult.base2.y - farResult.base1.y );

			// Far tip should have larger base (within limits)
			expect( farBaseWidth ).toBeGreaterThanOrEqual( nearBaseWidth );
		} );

		test( 'should return correct winding order for base points', () => {
			const result = calc.getTailFromTipPosition( 0, 0, 100, 100, 50, 150, 10 );

			// Cross product should indicate correct winding
			const crossZ = ( result.base2.x - result.base1.x ) * ( result.tip.y - result.base1.y ) -
				( result.base2.y - result.base1.y ) * ( result.tip.x - result.base1.x );

			// Winding should be non-negative (counterclockwise or collinear)
			expect( crossZ ).toBeGreaterThanOrEqual( 0 );
		} );
	} );

	describe( 'getTailCoordinates', () => {
		let calc;

		beforeEach( () => {
			calc = new window.Layers.TailCalculator();
		} );

		test( 'should calculate bottom tail coordinates', () => {
			const result = calc.getTailCoordinates( 0, 0, 100, 100, 'bottom', 0.5, 20, 10 );

			expect( result.base1.y ).toBe( 100 );
			expect( result.base2.y ).toBe( 100 );
			expect( result.tip.y ).toBeGreaterThan( 100 );
		} );

		test( 'should calculate top tail coordinates', () => {
			const result = calc.getTailCoordinates( 0, 0, 100, 100, 'top', 0.5, 20, 10 );

			expect( result.base1.y ).toBe( 0 );
			expect( result.base2.y ).toBe( 0 );
			expect( result.tip.y ).toBeLessThan( 0 );
		} );

		test( 'should calculate left tail coordinates', () => {
			const result = calc.getTailCoordinates( 0, 0, 100, 100, 'left', 0.5, 20, 10 );

			expect( result.base1.x ).toBe( 0 );
			expect( result.base2.x ).toBe( 0 );
			expect( result.tip.x ).toBeLessThan( 0 );
		} );

		test( 'should calculate right tail coordinates', () => {
			const result = calc.getTailCoordinates( 0, 0, 100, 100, 'right', 0.5, 20, 10 );

			expect( result.base1.x ).toBe( 100 );
			expect( result.base2.x ).toBe( 100 );
			expect( result.tip.x ).toBeGreaterThan( 100 );
		} );

		test( 'should handle bottom-left direction', () => {
			const result = calc.getTailCoordinates( 0, 0, 100, 100, 'bottom-left', 0.5, 20, 10 );

			// Should position toward left side
			expect( result.tip.x ).toBeLessThan( 50 );
			expect( result.tip.y ).toBeGreaterThan( 100 );
		} );

		test( 'should handle bottom-right direction', () => {
			const result = calc.getTailCoordinates( 0, 0, 100, 100, 'bottom-right', 0.5, 20, 10 );

			// Should position toward right side
			expect( result.tip.x ).toBeGreaterThan( 50 );
			expect( result.tip.y ).toBeGreaterThan( 100 );
		} );

		test( 'should respect position parameter', () => {
			const leftResult = calc.getTailCoordinates( 0, 0, 100, 100, 'bottom', 0.2, 20, 10 );
			const rightResult = calc.getTailCoordinates( 0, 0, 100, 100, 'bottom', 0.8, 20, 10 );

			expect( leftResult.tip.x ).toBeLessThan( rightResult.tip.x );
		} );

		test( 'should clamp tail size to maximum', () => {
			// Very large tail size should be clamped
			const result = calc.getTailCoordinates( 0, 0, 100, 100, 'bottom', 0.5, 500, 10 );

			// Tail size should be clamped to 80% of min dimension (80)
			const tailHeight = result.tip.y - result.base1.y;
			expect( tailHeight ).toBeLessThanOrEqual( 80 );
		} );

		test( 'should default to bottom for unknown direction', () => {
			const result = calc.getTailCoordinates( 0, 0, 100, 100, 'unknown', 0.5, 20, 10 );

			expect( result.tip.y ).toBeGreaterThan( 100 );
		} );
	} );

	describe( '_getEdgeBeforeCorner', () => {
		let calc;

		beforeEach( () => {
			calc = new window.Layers.TailCalculator();
		} );

		test( 'should return top for top-right corner', () => {
			expect( calc._getEdgeBeforeCorner( 'tr' ) ).toBe( 'top' );
		} );

		test( 'should return right for bottom-right corner', () => {
			expect( calc._getEdgeBeforeCorner( 'br' ) ).toBe( 'right' );
		} );

		test( 'should return bottom for bottom-left corner', () => {
			expect( calc._getEdgeBeforeCorner( 'bl' ) ).toBe( 'bottom' );
		} );

		test( 'should return left for top-left corner', () => {
			expect( calc._getEdgeBeforeCorner( 'tl' ) ).toBe( 'left' );
		} );

		test( 'should return top for unknown corner', () => {
			expect( calc._getEdgeBeforeCorner( 'unknown' ) ).toBe( 'top' );
		} );
	} );

	describe( '_getEdgeAfterCorner', () => {
		let calc;

		beforeEach( () => {
			calc = new window.Layers.TailCalculator();
		} );

		test( 'should return right for top-right corner', () => {
			expect( calc._getEdgeAfterCorner( 'tr' ) ).toBe( 'right' );
		} );

		test( 'should return bottom for bottom-right corner', () => {
			expect( calc._getEdgeAfterCorner( 'br' ) ).toBe( 'bottom' );
		} );

		test( 'should return left for bottom-left corner', () => {
			expect( calc._getEdgeAfterCorner( 'bl' ) ).toBe( 'left' );
		} );

		test( 'should return top for top-left corner', () => {
			expect( calc._getEdgeAfterCorner( 'tl' ) ).toBe( 'top' );
		} );

		test( 'should return bottom for unknown corner', () => {
			expect( calc._getEdgeAfterCorner( 'unknown' ) ).toBe( 'bottom' );
		} );
	} );

	describe( 'edge cases', () => {
		let calc;

		beforeEach( () => {
			calc = new window.Layers.TailCalculator();
		} );

		test( 'should handle point exactly on edge', () => {
			const result = calc.getClosestPerimeterPoint( 50, 100, 0, 0, 100, 100, 10 );

			expect( result ).toBeDefined();
			expect( result.edge ).toBeDefined();
		} );

		test( 'should handle point exactly at corner', () => {
			const result = calc.getClosestPerimeterPoint( 100, 100, 0, 0, 100, 100, 10 );

			expect( result ).toBeDefined();
		} );

		test( 'should handle very small rectangle', () => {
			const result = calc.getClosestPerimeterPoint( 5, 15, 0, 0, 10, 10, 2 );

			expect( result ).toBeDefined();
		} );

		test( 'should handle negative coordinates', () => {
			const result = calc.getClosestPerimeterPoint( -50, -50, -100, -100, 200, 200, 20 );

			expect( result ).toBeDefined();
			expect( result.edge ).toBeDefined();
		} );

		test( 'should handle tip exactly at center of rectangle', () => {
			// Tip inside the rectangle
			const result = calc.getTailFromTipPosition( 0, 0, 100, 100, 50, 50, 10 );

			expect( result ).toBeDefined();
			expect( result.tip ).toEqual( { x: 50, y: 50 } );
		} );
	} );

	describe( 'corner arc calculations', () => {
		let calc;

		beforeEach( () => {
			calc = new window.Layers.TailCalculator();
		} );

		test( 'should calculate base points on corner arc', () => {
			// Tip at diagonal from corner - should attach to corner arc
			const result = calc.getTailFromTipPosition( 0, 0, 100, 100, 150, 150, 25 );

			// Base points should be on or near the corner arc
			expect( result.edge ).toBe( 'br' );
			expect( result.base1 ).toBeDefined();
			expect( result.base2 ).toBeDefined();
		} );

		test( 'should transition from corner to straight edge when base extends past arc', () => {
			// For a very wide base, points might extend beyond the corner arc
			// This tests the edge transition logic
			const result = calc.getTailFromTipPosition( 0, 0, 100, 100, 100, 200, 5 );

			expect( result ).toBeDefined();
			// Edge could be straight or corner depending on base width
			expect( [ 'bottom', 'right', 'br' ] ).toContain( result.edge );
		} );
	} );
} );
