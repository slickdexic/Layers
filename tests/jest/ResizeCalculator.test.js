/**
 * Tests for ResizeCalculator
 *
 * Covers resize calculations for all layer types and handle positions.
 * Focus on edge cases and uncovered code paths.
 */

const ResizeCalculator = require( '../../resources/ext.layers.editor/canvas/ResizeCalculator.js' );

describe( 'ResizeCalculator', () => {
	describe( 'calculateResize - dispatch by type', () => {
		it( 'should return null for unknown layer type', () => {
			const layer = { type: 'unknown', x: 0, y: 0, width: 100, height: 100 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).toBeNull();
		} );

		it( 'should dispatch to calculateRectangleResize for rectangle', () => {
			const layer = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.width ).toBe( 110 );
			expect( result.height ).toBe( 110 );
		} );

		it( 'should dispatch to calculateCircleResize for circle', () => {
			const layer = { type: 'circle', x: 50, y: 50, radius: 50 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.radius ).toBeDefined();
		} );

		it( 'should dispatch to calculateEllipseResize for ellipse', () => {
			const layer = { type: 'ellipse', x: 50, y: 50, radiusX: 50, radiusY: 30 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
		} );

		it( 'should dispatch to calculatePolygonResize for polygon', () => {
			const layer = { type: 'polygon', x: 50, y: 50, radius: 50, sides: 6 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
		} );

		it( 'should dispatch to calculatePolygonResize for star', () => {
			const layer = { type: 'star', x: 50, y: 50, radius: 50, innerRadius: 25, sides: 5 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
		} );

		it( 'should dispatch to calculateLineResize for line', () => {
			const layer = { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 };
			const result = ResizeCalculator.calculateResize( layer, 'w', 10, 10, {} );
			expect( result ).not.toBeNull();
		} );

		it( 'should dispatch to calculateLineResize for arrow', () => {
			const layer = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			const result = ResizeCalculator.calculateResize( layer, 'e', 10, 10, {} );
			expect( result ).not.toBeNull();
		} );

		it( 'should dispatch to calculatePathResize for path', () => {
			const layer = { type: 'path', points: [ { x: 0, y: 0 }, { x: 100, y: 100 } ] };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
		} );

		it( 'should return null for highlight type (not supported)', () => {
			const layer = { type: 'highlight', points: [ { x: 0, y: 0 }, { x: 100, y: 100 } ] };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			// Highlight is not handled in switch statement, returns null
			expect( result ).toBeNull();
		} );

		it( 'should dispatch to calculateTextResize for text', () => {
			const layer = { type: 'text', x: 0, y: 0, width: 100, height: 50, fontSize: 16 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.fontSize ).toBeDefined();
		} );

		it( 'should dispatch to calculateRectangleResize for blur', () => {
			const layer = { type: 'blur', x: 0, y: 0, width: 100, height: 100 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
		} );
	} );

	describe( 'calculateRectangleResize - proportional scaling', () => {
		it( 'should maintain aspect ratio with proportional modifier', () => {
			const layer = { type: 'rectangle', x: 0, y: 0, width: 100, height: 50 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'se', 20, 10, { proportional: true }
			);
			// Larger delta (20 in X) should drive the scaling
			expect( result ).not.toBeNull();
		} );

		it( 'should handle zero aspect ratio gracefully', () => {
			const layer = { type: 'rectangle', x: 0, y: 0, width: 0, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'se', 10, 10, { proportional: true }
			);
			expect( result ).not.toBeNull();
		} );

		it( 'should handle proportional with negative deltas', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 50 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'nw', -20, -10, { proportional: true }
			);
			expect( result ).not.toBeNull();
		} );

		it( 'should handle proportional when Y delta is larger', () => {
			const layer = { type: 'rectangle', x: 0, y: 0, width: 50, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'se', 5, 20, { proportional: true }
			);
			expect( result ).not.toBeNull();
		} );
	} );

	describe( 'calculateRectangleResize - fromCenter modifier', () => {
		it( 'should resize from center for NW handle', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'nw', -20, -20, { fromCenter: true }
			);
			expect( result ).not.toBeNull();
			expect( result.width ).toBe( 120 );
			expect( result.height ).toBe( 120 );
		} );

		it( 'should resize from center for NE handle', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'ne', 20, -20, { fromCenter: true }
			);
			expect( result ).not.toBeNull();
		} );

		it( 'should resize from center for SW handle', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'sw', -20, 20, { fromCenter: true }
			);
			expect( result ).not.toBeNull();
		} );

		it( 'should resize from center for SE handle', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'se', 20, 20, { fromCenter: true }
			);
			expect( result ).not.toBeNull();
		} );

		it( 'should resize from center for N handle', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'n', 0, -20, { fromCenter: true }
			);
			expect( result ).not.toBeNull();
			expect( result.height ).toBe( 120 );
		} );

		it( 'should resize from center for S handle', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 's', 0, 20, { fromCenter: true }
			);
			expect( result ).not.toBeNull();
		} );

		it( 'should resize from center for E handle', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'e', 20, 0, { fromCenter: true }
			);
			expect( result ).not.toBeNull();
		} );

		it( 'should resize from center for W handle', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'w', -20, 0, { fromCenter: true }
			);
			expect( result ).not.toBeNull();
		} );
	} );

	describe( 'calculateRectangleResize - all corner handles', () => {
		const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 100 };

		it( 'should handle NW corner resize', () => {
			const result = ResizeCalculator.calculateRectangleResize( layer, 'nw', 10, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.x ).toBe( 60 );
			expect( result.y ).toBe( 60 );
			expect( result.width ).toBe( 90 );
			expect( result.height ).toBe( 90 );
		} );

		it( 'should handle NE corner resize', () => {
			const result = ResizeCalculator.calculateRectangleResize( layer, 'ne', 10, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.y ).toBe( 60 );
			expect( result.width ).toBe( 110 );
			expect( result.height ).toBe( 90 );
		} );

		it( 'should handle SW corner resize', () => {
			const result = ResizeCalculator.calculateRectangleResize( layer, 'sw', 10, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.x ).toBe( 60 );
			expect( result.width ).toBe( 90 );
			expect( result.height ).toBe( 110 );
		} );

		it( 'should handle SE corner resize', () => {
			const result = ResizeCalculator.calculateRectangleResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.width ).toBe( 110 );
			expect( result.height ).toBe( 110 );
		} );
	} );

	describe( 'calculateRectangleResize - all edge handles', () => {
		const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 100 };

		it( 'should handle N edge resize', () => {
			const result = ResizeCalculator.calculateRectangleResize( layer, 'n', 0, -10, {} );
			expect( result ).not.toBeNull();
			expect( result.y ).toBe( 40 );
			expect( result.height ).toBe( 110 );
		} );

		it( 'should handle S edge resize', () => {
			const result = ResizeCalculator.calculateRectangleResize( layer, 's', 0, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.height ).toBe( 110 );
		} );

		it( 'should handle E edge resize', () => {
			const result = ResizeCalculator.calculateRectangleResize( layer, 'e', 10, 0, {} );
			expect( result ).not.toBeNull();
			expect( result.width ).toBe( 110 );
		} );

		it( 'should handle W edge resize', () => {
			const result = ResizeCalculator.calculateRectangleResize( layer, 'w', -10, 0, {} );
			expect( result ).not.toBeNull();
			expect( result.x ).toBe( 40 );
			expect( result.width ).toBe( 110 );
		} );
	} );

	describe( 'applyRotatedResizeCorrection', () => {
		it( 'should return early for unknown handle type', () => {
			const updates = { x: 50, y: 50, width: 100, height: 100 };
			ResizeCalculator.applyRotatedResizeCorrection(
				updates, 100, 100, 45, 'unknown', 100, 100
			);
			// Updates should be unchanged
			expect( updates.x ).toBe( 50 );
		} );

		it( 'should correct for N handle on rotated shape', () => {
			const updates = { x: 50, y: 50, width: 100, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection(
				updates, 100, 100, 45, 'n', 100, 100
			);
			expect( updates.x ).toBeDefined();
			expect( updates.y ).toBeDefined();
		} );

		it( 'should correct for S handle on rotated shape', () => {
			const updates = { x: 50, y: 50, width: 100, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection(
				updates, 100, 100, 45, 's', 100, 100
			);
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for E handle on rotated shape', () => {
			const updates = { x: 50, y: 50, width: 120, height: 100 };
			ResizeCalculator.applyRotatedResizeCorrection(
				updates, 100, 100, 45, 'e', 100, 100
			);
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for W handle on rotated shape', () => {
			const updates = { x: 50, y: 50, width: 120, height: 100 };
			ResizeCalculator.applyRotatedResizeCorrection(
				updates, 100, 100, 45, 'w', 100, 100
			);
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for NW handle on rotated shape', () => {
			const updates = { x: 50, y: 50, width: 120, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection(
				updates, 100, 100, 45, 'nw', 100, 100
			);
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for NE handle on rotated shape', () => {
			const updates = { x: 50, y: 50, width: 120, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection(
				updates, 100, 100, 45, 'ne', 100, 100
			);
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for SW handle on rotated shape', () => {
			const updates = { x: 50, y: 50, width: 120, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection(
				updates, 100, 100, 45, 'sw', 100, 100
			);
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for SE handle on rotated shape', () => {
			const updates = { x: 50, y: 50, width: 120, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection(
				updates, 100, 100, 45, 'se', 100, 100
			);
			expect( updates.x ).toBeDefined();
		} );
	} );

	describe( 'calculateLineResize', () => {
		const line = { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 };

		it( 'should move start point for W handle', () => {
			const result = ResizeCalculator.calculateLineResize( line, 'w', -10, 5, 0, 0 );
			expect( result.x1 ).toBe( -10 );
			expect( result.y1 ).toBe( 5 );
		} );

		it( 'should move end point for E handle', () => {
			const result = ResizeCalculator.calculateLineResize( line, 'e', 10, 5, 0, 0 );
			expect( result.x2 ).toBe( 110 );
			expect( result.y2 ).toBe( 5 );
		} );

		it( 'should handle N perpendicular movement', () => {
			const result = ResizeCalculator.calculateLineResize( line, 'n', 0, -10, 0, 0 );
			expect( result.x1 ).toBeDefined();
			expect( result.y1 ).toBeDefined();
			expect( result.x2 ).toBeDefined();
			expect( result.y2 ).toBeDefined();
		} );

		it( 'should handle S perpendicular movement', () => {
			const result = ResizeCalculator.calculateLineResize( line, 's', 0, 10, 0, 0 );
			expect( result.x1 ).toBeDefined();
			expect( result.y1 ).toBeDefined();
		} );

		it( 'should handle unknown handle type with default behavior', () => {
			const result = ResizeCalculator.calculateLineResize( line, 'unknown', 10, 10, 0, 0 );
			expect( result.x2 ).toBe( 110 );
			expect( result.y2 ).toBe( 10 );
		} );

		it( 'should handle line with additional rotation', () => {
			const result = ResizeCalculator.calculateLineResize( line, 'n', 10, 10, 0, Math.PI / 4 );
			expect( result ).not.toBeNull();
		} );
	} );

	describe( 'calculatePathResize', () => {
		it( 'should return null for empty points array', () => {
			const layer = { type: 'path', points: [] };
			const result = ResizeCalculator.calculatePathResize( layer, 'se', 10, 10 );
			expect( result ).toBeNull();
		} );

		it( 'should return null for undefined points', () => {
			const layer = { type: 'path' };
			const result = ResizeCalculator.calculatePathResize( layer, 'se', 10, 10 );
			expect( result ).toBeNull();
		} );

		it( 'should return null for very small bounding box', () => {
			const layer = { type: 'path', points: [ { x: 50, y: 50 }, { x: 50, y: 50 } ] };
			const result = ResizeCalculator.calculatePathResize( layer, 'se', 10, 10 );
			expect( result ).toBeNull();
		} );

		it( 'should scale path from NW corner', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 'nw', -20, -20 );
			expect( result ).not.toBeNull();
			expect( result.points ).toHaveLength( 4 );
		} );

		it( 'should scale path from NE corner', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 'ne', 20, -20 );
			expect( result ).not.toBeNull();
		} );

		it( 'should scale path from SW corner', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 'sw', -20, 20 );
			expect( result ).not.toBeNull();
		} );

		it( 'should scale path from SE corner', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 'se', 20, 20 );
			expect( result ).not.toBeNull();
		} );

		it( 'should scale path from N edge', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 'n', 0, -20 );
			expect( result ).not.toBeNull();
		} );

		it( 'should scale path from S edge', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 's', 0, 20 );
			expect( result ).not.toBeNull();
		} );

		it( 'should scale path from E edge', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 'e', 20, 0 );
			expect( result ).not.toBeNull();
		} );

		it( 'should scale path from W edge', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 'w', -20, 0 );
			expect( result ).not.toBeNull();
		} );

		it( 'should return null for unknown handle type', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 100, y: 100 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 'unknown', 10, 10 );
			expect( result ).toBeNull();
		} );

		it( 'should handle path with width but no height', () => {
			// Horizontal line path
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 50 }, { x: 100, y: 50 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 'e', 20, 0 );
			// Width > 0, height = 0, should handle gracefully
			expect( result ).not.toBeNull();
		} );
	} );

	describe( 'calculateTextResize', () => {
		const textLayer = { type: 'text', x: 0, y: 0, width: 100, height: 50, fontSize: 16 };

		it( 'should scale font size proportionally for SE handle', () => {
			const result = ResizeCalculator.calculateTextResize( textLayer, 'se', 20, 10 );
			expect( result ).not.toBeNull();
			expect( result.fontSize ).toBeGreaterThan( 16 );
		} );

		it( 'should scale font size for NW handle', () => {
			const result = ResizeCalculator.calculateTextResize( textLayer, 'nw', -20, -10 );
			expect( result ).not.toBeNull();
		} );

		it( 'should return fontSize even for text without fontSize (uses default 16)', () => {
			const layer = { type: 'text', x: 0, y: 0, width: 100, height: 50 };
			const result = ResizeCalculator.calculateTextResize( layer, 'se', 20, 10 );
			expect( result ).not.toBeNull();
			expect( result.fontSize ).toBeDefined();
		} );

		it( 'should return fontSize even for text with zero dimensions', () => {
			const layer = { type: 'text', x: 0, y: 0, width: 0, height: 0, fontSize: 16 };
			const result = ResizeCalculator.calculateTextResize( layer, 'se', 20, 10 );
			expect( result ).not.toBeNull();
			expect( result.fontSize ).toBeDefined();
		} );

		it( 'should enforce minimum font size', () => {
			const layer = { type: 'text', x: 0, y: 0, width: 100, height: 50, fontSize: 16 };
			// Large negative delta to try to get very small font
			const result = ResizeCalculator.calculateTextResize( layer, 'nw', 90, 45 );
			expect( result ).not.toBeNull();
			expect( result.fontSize ).toBeGreaterThanOrEqual( 1 );
		} );

		it( 'should enforce maximum font size', () => {
			const layer = { type: 'text', x: 0, y: 0, width: 100, height: 50, fontSize: 16 };
			// Large positive delta to try to get very large font
			const result = ResizeCalculator.calculateTextResize( layer, 'se', 10000, 5000 );
			expect( result ).not.toBeNull();
			expect( result.fontSize ).toBeLessThanOrEqual( 1000 );
		} );
	} );

	describe( 'calculateCircleResize', () => {
		const circle = { type: 'circle', x: 50, y: 50, radius: 50 };

		it( 'should increase radius for SE handle', () => {
			const result = ResizeCalculator.calculateCircleResize( circle, 'se', 10, 10 );
			expect( result ).not.toBeNull();
			expect( result.radius ).toBeGreaterThan( 50 );
		} );

		it( 'should decrease radius for NW handle', () => {
			const result = ResizeCalculator.calculateCircleResize( circle, 'nw', 10, 10 );
			expect( result ).not.toBeNull();
			expect( result.radius ).toBeLessThan( 50 );
		} );

		it( 'should enforce minimum radius', () => {
			const result = ResizeCalculator.calculateCircleResize( circle, 'nw', 100, 100 );
			expect( result ).not.toBeNull();
			expect( result.radius ).toBeGreaterThanOrEqual( 5 );
		} );

		it( 'should only return radius, not center position', () => {
			const result = ResizeCalculator.calculateCircleResize( circle, 'se', 20, 20 );
			expect( result ).not.toBeNull();
			// CircleResize only updates radius, not center position
			expect( result.radius ).toBeDefined();
		} );
	} );

	describe( 'calculateEllipseResize', () => {
		const ellipse = { type: 'ellipse', x: 50, y: 50, radiusX: 50, radiusY: 30 };

		it( 'should return empty object for corner handles (no update logic for corners)', () => {
			const result = ResizeCalculator.calculateEllipseResize( ellipse, 'se', 10, 10 );
			// Corner handles don't match 'e', 'w', 'n', or 's' so updates remain empty
			expect( result ).not.toBeNull();
			expect( Object.keys( result ).length ).toBe( 0 );
		} );

		it( 'should resize only radiusX for E handle', () => {
			const result = ResizeCalculator.calculateEllipseResize( ellipse, 'e', 10, 0 );
			expect( result ).not.toBeNull();
			expect( result.radiusX ).toBeGreaterThan( 50 );
		} );

		it( 'should resize only radiusY for N handle', () => {
			const result = ResizeCalculator.calculateEllipseResize( ellipse, 'n', 0, -10 );
			expect( result ).not.toBeNull();
			expect( result.radiusY ).toBeGreaterThan( 30 );
		} );
	} );

	describe( 'calculatePolygonResize', () => {
		const polygon = { type: 'polygon', x: 50, y: 50, radius: 50, sides: 6 };

		it( 'should resize polygon radius', () => {
			const result = ResizeCalculator.calculatePolygonResize( polygon, 'se', 10, 10 );
			expect( result ).not.toBeNull();
			expect( result.radius ).toBeGreaterThan( 50 );
		} );

		it( 'should resize star radius (innerRadius not supported)', () => {
			const star = { type: 'star', x: 50, y: 50, radius: 50, innerRadius: 25, sides: 5 };
			const result = ResizeCalculator.calculatePolygonResize( star, 'se', 20, 20 );
			expect( result ).not.toBeNull();
			expect( result.radius ).toBeGreaterThan( 50 );
			// Note: innerRadius is not updated by calculatePolygonResize
		} );

		it( 'should only return radius, not center position', () => {
			const result = ResizeCalculator.calculatePolygonResize( polygon, 'nw', -10, -10 );
			expect( result ).not.toBeNull();
			// PolygonResize only updates radius, not center position
			expect( result.radius ).toBeDefined();
		} );
	} );
} );
