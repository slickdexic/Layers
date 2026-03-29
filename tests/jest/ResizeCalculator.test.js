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

		it( 'should return null for unknown type (not supported)', () => {
			const layer = { type: 'unknown', points: [ { x: 0, y: 0 }, { x: 100, y: 100 } ] };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			// Unknown type is not handled in switch statement, returns null
			expect( result ).toBeNull();
		} );

		it( 'should dispatch to calculateTextResize for text', () => {
			const layer = { type: 'text', x: 0, y: 0, width: 100, height: 50, fontSize: 16 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.fontSize ).toBeDefined();
		} );

		it( 'should dispatch to calculateRectangleResize for textbox', () => {
			const layer = { type: 'textbox', x: 0, y: 0, width: 100, height: 100 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
		} );

		it( 'should dispatch to calculateMarkerResize for marker', () => {
			const layer = { type: 'marker', x: 50, y: 50, size: 24, value: 1 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.size ).toBeDefined();
		} );

		it( 'should dispatch to calculateDimensionResize for dimension', () => {
			const layer = { type: 'dimension', x1: 0, y1: 50, x2: 100, y2: 50 };
			const result = ResizeCalculator.calculateResize( layer, 'e', 20, 0, {} );
			expect( result ).not.toBeNull();
			expect( result.x2 ).toBeDefined();
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
			const originalLayer = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
			const updates = { x: 50, y: 50, width: 100, height: 100 };
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, 'unknown' );
			// Updates should be unchanged (no correction applied for unknown handle)
			expect( updates.x ).toBe( 50 );
		} );

		it( 'should return early for zero rotation', () => {
			const originalLayer = { x: 0, y: 0, width: 100, height: 100, rotation: 0 };
			const updates = { x: 50, y: 50, width: 120, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, 'se' );
			// No correction needed for non-rotated shapes
			expect( updates.x ).toBe( 50 );
			expect( updates.y ).toBe( 50 );
		} );

		it( 'should correct for N handle on rotated shape', () => {
			const originalLayer = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
			const updates = { x: 0, y: -20, width: 100, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, 'n' );
			// Correction should be applied
			expect( updates.x ).toBeDefined();
			expect( updates.y ).toBeDefined();
		} );

		it( 'should correct for S handle on rotated shape', () => {
			const originalLayer = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
			const updates = { x: 0, y: 0, width: 100, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, 's' );
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for E handle on rotated shape', () => {
			const originalLayer = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
			const updates = { x: 0, y: 0, width: 120, height: 100 };
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, 'e' );
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for W handle on rotated shape', () => {
			const originalLayer = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
			const updates = { x: -20, y: 0, width: 120, height: 100 };
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, 'w' );
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for NW handle on rotated shape', () => {
			const originalLayer = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
			const updates = { x: -20, y: -20, width: 120, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, 'nw' );
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for NE handle on rotated shape', () => {
			const originalLayer = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
			const updates = { x: 0, y: -20, width: 120, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, 'ne' );
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for SW handle on rotated shape', () => {
			const originalLayer = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
			const updates = { x: -20, y: 0, width: 120, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, 'sw' );
			expect( updates.x ).toBeDefined();
		} );

		it( 'should correct for SE handle on rotated shape', () => {
			const originalLayer = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
			const updates = { x: 0, y: 0, width: 120, height: 120 };
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, 'se' );
			expect( updates.x ).toBeDefined();
		} );

		it( 'should not modify updates when centers are already the same', () => {
			const originalLayer = { x: 50, y: 50, width: 100, height: 100, rotation: 45 };
			// Updates that result in the same center
			const updates = { x: 50, y: 50, width: 100, height: 100 };
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, 'se' );
			expect( updates.x ).toBe( 50 );
			expect( updates.y ).toBe( 50 );
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

		describe( 'control handle for curved arrows', () => {
			it( 'should move control point from default midpoint', () => {
				const arrow = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0 };
				const result = ResizeCalculator.calculateLineResize( arrow, 'control', 0, 30, 0, 0 );
				// Default control point is at midpoint (50, 0), should move to (50, 30)
				expect( result.controlX ).toBe( 50 );
				expect( result.controlY ).toBe( 30 );
			} );

			it( 'should move existing control point', () => {
				const arrow = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0, controlX: 50, controlY: 50 };
				const result = ResizeCalculator.calculateLineResize( arrow, 'control', 10, -20, 0, 0 );
				expect( result.controlX ).toBe( 60 );
				expect( result.controlY ).toBe( 30 );
			} );

			it( 'should not affect endpoint coordinates', () => {
				const arrow = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0, controlX: 50, controlY: 50 };
				const result = ResizeCalculator.calculateLineResize( arrow, 'control', 10, 10, 0, 0 );
				expect( result.x1 ).toBeUndefined();
				expect( result.y1 ).toBeUndefined();
				expect( result.x2 ).toBeUndefined();
				expect( result.y2 ).toBeUndefined();
			} );
		} );

		describe( 'constrained resize on vertical lines', () => {
			// Vertical line with orientation constraint
			const verticalLine = { type: 'line', x1: 100, y1: 0, x2: 100, y2: 100, orientation: 'vertical' };

			it( 'should constrain W handle to vertical axis (move y1 only)', () => {
				// For vertical orientation, only deltaY should affect y1
				const result = ResizeCalculator.calculateLineResize( verticalLine, 'w', 10, 25, 0, 0 );
				expect( result.y1 ).toBe( 25 ); // y1 should move by deltaY
				expect( result.x1 ).toBeUndefined(); // x1 should not be in updates
			} );

			it( 'should constrain E handle to vertical axis (move y2 only)', () => {
				// For vertical orientation, only deltaY should affect y2
				const result = ResizeCalculator.calculateLineResize( verticalLine, 'e', 15, 30, 0, 0 );
				expect( result.y2 ).toBe( 130 ); // y2 (100) + deltaY (30) = 130
				expect( result.x2 ).toBeUndefined(); // x2 should not be in updates
			} );
		} );

		describe( 'constrained resize on horizontal lines', () => {
			// Horizontal line with orientation constraint
			const horizontalLine = { type: 'line', x1: 0, y1: 100, x2: 100, y2: 100, orientation: 'horizontal' };

			it( 'should constrain W handle to horizontal axis (move x1 only)', () => {
				// For horizontal orientation, only deltaX should affect x1
				const result = ResizeCalculator.calculateLineResize( horizontalLine, 'w', -20, 15, 0, 0 );
				expect( result.x1 ).toBe( -20 ); // x1 (0) + deltaX (-20) = -20
				expect( result.y1 ).toBeUndefined(); // y1 should not be in updates
			} );

			it( 'should constrain E handle to horizontal axis (move x2 only)', () => {
				// For horizontal orientation, only deltaX should affect x2
				const result = ResizeCalculator.calculateLineResize( horizontalLine, 'e', 30, 10, 0, 0 );
				expect( result.x2 ).toBe( 130 ); // x2 (100) + deltaX (30) = 130
				expect( result.y2 ).toBeUndefined(); // y2 should not be in updates
			} );
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

		it( 'should resize both axes for SE corner handle', () => {
			const result = ResizeCalculator.calculateEllipseResize( ellipse, 'se', 10, 10 );
			expect( result ).not.toBeNull();
			expect( result.radiusX ).toBe( 60 );
			expect( result.radiusY ).toBe( 40 );
		} );

		it( 'should resize both axes for NW corner handle', () => {
			const result = ResizeCalculator.calculateEllipseResize( ellipse, 'nw', -10, -10 );
			expect( result ).not.toBeNull();
			expect( result.radiusX ).toBe( 60 );
			expect( result.radiusY ).toBe( 40 );
		} );

		it( 'should resize both axes for NE corner handle', () => {
			const result = ResizeCalculator.calculateEllipseResize( ellipse, 'ne', 10, -10 );
			expect( result ).not.toBeNull();
			expect( result.radiusX ).toBe( 60 );
			expect( result.radiusY ).toBe( 40 );
		} );

		it( 'should resize both axes for SW corner handle', () => {
			const result = ResizeCalculator.calculateEllipseResize( ellipse, 'sw', -10, 10 );
			expect( result ).not.toBeNull();
			expect( result.radiusX ).toBe( 60 );
			expect( result.radiusY ).toBe( 40 );
		} );

		it( 'should resize only radiusX for E handle', () => {
			const result = ResizeCalculator.calculateEllipseResize( ellipse, 'e', 10, 0 );
			expect( result ).not.toBeNull();
			expect( result.radiusX ).toBeGreaterThan( 50 );
			expect( result.radiusY ).toBeUndefined();
		} );

		it( 'should resize only radiusY for N handle', () => {
			const result = ResizeCalculator.calculateEllipseResize( ellipse, 'n', 0, -10 );
			expect( result ).not.toBeNull();
			expect( result.radiusY ).toBeGreaterThan( 30 );
			expect( result.radiusX ).toBeUndefined();
		} );

		it( 'should enforce minimum radius of 5 for corner handles', () => {
			const smallEllipse = { type: 'ellipse', x: 50, y: 50, radiusX: 10, radiusY: 8 };
			const result = ResizeCalculator.calculateEllipseResize( smallEllipse, 'nw', 20, 20 );
			expect( result.radiusX ).toBe( 5 );
			expect( result.radiusY ).toBe( 5 );
		} );

		it( 'should handle shrinking via corner handles', () => {
			const result = ResizeCalculator.calculateEllipseResize( ellipse, 'se', -10, -10 );
			expect( result.radiusX ).toBe( 40 );
			expect( result.radiusY ).toBe( 20 );
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

	describe( 'calculateCalloutTailResize', () => {
		it( 'should move existing tail tip position', () => {
			const callout = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 100,
				height: 60,
				tailTipX: 100,
				tailTipY: 130
			};
			const result = ResizeCalculator.calculateCalloutTailResize( callout, 10, 20 );
			expect( result.tailTipX ).toBe( 110 );
			expect( result.tailTipY ).toBe( 150 );
		} );

		it( 'should calculate default tip from bottom direction when no tailTip set', () => {
			const callout = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 100,
				height: 60,
				tailDirection: 'bottom',
				tailPosition: 0.5,
				tailSize: 20
			};
			// Default bottom tip in world space: x + width * 0.5 = 100, y + height + tailSize = 130
			// Center is at (100, 80). So local coords: (0, 50)
			// After delta of (15, 25), local coords become (15, 75)
			const result = ResizeCalculator.calculateCalloutTailResize( callout, 15, 25 );
			expect( result.tailTipX ).toBe( 0 + 15 );  // local X
			expect( result.tailTipY ).toBe( 50 + 25 ); // local Y
		} );

		it( 'should calculate default tip from top direction', () => {
			const callout = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 100,
				height: 60,
				tailDirection: 'top',
				tailPosition: 0.5,
				tailSize: 20
			};
			// Default top tip in world space: x + width * 0.5 = 100, y - tailSize = 30
			// Center is at (100, 80). So local coords: (0, -50)
			const result = ResizeCalculator.calculateCalloutTailResize( callout, 0, 0 );
			expect( result.tailTipX ).toBe( 0 );
			expect( result.tailTipY ).toBe( -50 );
		} );

		it( 'should calculate default tip from left direction', () => {
			const callout = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 100,
				height: 60,
				tailDirection: 'left',
				tailPosition: 0.5,
				tailSize: 20
			};
			// Default left tip in world space: x - tailSize = 30, y + height * 0.5 = 80
			// Center is at (100, 80). So local coords: (-70, 0)
			const result = ResizeCalculator.calculateCalloutTailResize( callout, 0, 0 );
			expect( result.tailTipX ).toBe( -70 );
			expect( result.tailTipY ).toBe( 0 );
		} );

		it( 'should calculate default tip from right direction', () => {
			const callout = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 100,
				height: 60,
				tailDirection: 'right',
				tailPosition: 0.5,
				tailSize: 20
			};
			// Default right tip in world space: x + width + tailSize = 170, y + height * 0.5 = 80
			// Center is at (100, 80). So local coords: (70, 0)
			const result = ResizeCalculator.calculateCalloutTailResize( callout, 0, 0 );
			expect( result.tailTipX ).toBe( 70 );
			expect( result.tailTipY ).toBe( 0 );
		} );

		it( 'should dispatch to calculateCalloutTailResize for tailTip handle on callout', () => {
			const callout = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 100,
				height: 60,
				tailTipX: 0,   // Local coords: center of shape
				tailTipY: 50  // 50px below center (at bottom edge + some)
			};
			const result = ResizeCalculator.calculateResize( callout, 'tailTip', 10, 20 );
			expect( result.tailTipX ).toBe( 10 );
			expect( result.tailTipY ).toBe( 70 );
		} );

		it( 'should apply rotation when calculating default tip from legacy properties', () => {
			// Rotated callout - legacy tip is converted to local coords (no world-space rotation needed)
			const callout = {
				type: 'callout',
				x: 100,
				y: 100,
				width: 100,
				height: 50,
				rotation: 90, // 90 degrees
				tailDirection: 'bottom',
				tailPosition: 0.5,
				tailSize: 20
			};
			// Without rotation: tipX = 100 + 100*0.5 = 150, tipY = 100 + 50 + 20 = 170
			// Center is at (150, 125)
			// Local coords: (0, 45) - these are stored in local space, not rotated to world
			const result = ResizeCalculator.calculateCalloutTailResize( callout, 0, 0 );
			expect( result.tailTipX ).toBeCloseTo( 0, 0 );
			expect( result.tailTipY ).toBeCloseTo( 45, 0 );
		} );

		it( 'should convert world delta to local delta when rotated and tailTipX/tailTipY set', () => {
			// When explicit tailTip coordinates are set in local space,
			// world deltas must be un-rotated before applying
			const callout = {
				type: 'callout',
				x: 100,
				y: 100,
				width: 100,
				height: 50,
				rotation: 90,
				tailTipX: 0,   // Local coords
				tailTipY: 45
			};
			// World delta (10, 20) with 90° rotation un-rotates to local delta (20, -10)
			// cos(-90°) = 0, sin(-90°) = -1
			// localDX = 10 * 0 - 20 * (-1) = 20
			// localDY = 10 * (-1) + 20 * 0 = -10
			const result = ResizeCalculator.calculateCalloutTailResize( callout, 10, 20 );
			expect( result.tailTipX ).toBeCloseTo( 0 + 20, 0 );
			expect( result.tailTipY ).toBeCloseTo( 45 + ( -10 ), 0 );
		} );

		it( 'should use default bottom position for unknown tail direction', () => {
			const callout = {
				type: 'callout',
				x: 50,
				y: 50,
				width: 100,
				height: 60,
				tailDirection: 'invalid', // Unknown direction - falls to default case
				tailPosition: 0.5,
				tailSize: 20
			};
			// Default case: bottom position
			// worldTipX = x + width * 0.5 = 100, worldTipY = y + height + tailSize = 130
			// Center is at (100, 80). So local coords: (0, 50)
			const result = ResizeCalculator.calculateCalloutTailResize( callout, 0, 0 );
			expect( result.tailTipX ).toBe( 0 );
			expect( result.tailTipY ).toBe( 50 );
		} );
	} );

	describe( 'calculateMarkerResize', () => {
		it( 'should increase size when dragging SE handle outward', () => {
			const layer = { type: 'marker', size: 30 };
			const result = ResizeCalculator.calculateMarkerResize( layer, 'se', 10, 10 );
			expect( result.size ).toBeGreaterThan( 30 );
		} );

		it( 'should decrease size when dragging SE handle inward', () => {
			const layer = { type: 'marker', size: 30 };
			const result = ResizeCalculator.calculateMarkerResize( layer, 'se', -10, -10 );
			expect( result.size ).toBeLessThan( 30 );
		} );

		it( 'should increase size when dragging NW handle inward (toward center)', () => {
			const layer = { type: 'marker', size: 30 };
			// NW handle: negative delta means dragging toward center = growing
			const result = ResizeCalculator.calculateMarkerResize( layer, 'nw', -10, -10 );
			expect( result.size ).toBeGreaterThan( 30 );
		} );

		it( 'should decrease size when dragging NW handle outward', () => {
			const layer = { type: 'marker', size: 30 };
			// NW handle: positive delta means dragging away = shrinking
			const result = ResizeCalculator.calculateMarkerResize( layer, 'nw', 10, 10 );
			expect( result.size ).toBeLessThan( 30 );
		} );

		it( 'should handle NE handle correctly', () => {
			const layer = { type: 'marker', size: 30 };
			// NE: positive X means growing, negative Y means growing
			const result = ResizeCalculator.calculateMarkerResize( layer, 'ne', 10, -10 );
			expect( result.size ).toBeGreaterThan( 30 );
		} );

		it( 'should handle SW handle correctly', () => {
			const layer = { type: 'marker', size: 30 };
			// SW: negative X means growing, positive Y means growing
			const result = ResizeCalculator.calculateMarkerResize( layer, 'sw', -10, 10 );
			expect( result.size ).toBeGreaterThan( 30 );
		} );

		it( 'should use default size when not specified', () => {
			const layer = { type: 'marker' };
			const result = ResizeCalculator.calculateMarkerResize( layer, 'se', 10, 10 );
			// Default size is 24, result should be > 24
			expect( result.size ).toBeGreaterThan( 24 );
		} );

		it( 'should clamp size to minimum 10', () => {
			const layer = { type: 'marker', size: 15 };
			const result = ResizeCalculator.calculateMarkerResize( layer, 'se', -50, -50 );
			expect( result.size ).toBe( 10 );
		} );

		it( 'should clamp size to maximum 200', () => {
			const layer = { type: 'marker', size: 190 };
			const result = ResizeCalculator.calculateMarkerResize( layer, 'se', 100, 100 );
			expect( result.size ).toBe( 200 );
		} );

		it( 'should round size to integer', () => {
			const layer = { type: 'marker', size: 30 };
			const result = ResizeCalculator.calculateMarkerResize( layer, 'se', 5, 5 );
			expect( Number.isInteger( result.size ) ).toBe( true );
		} );

		it( 'should handle E handle (east only)', () => {
			const layer = { type: 'marker', size: 30 };
			const result = ResizeCalculator.calculateMarkerResize( layer, 'e', 10, 0 );
			expect( result.size ).toBeGreaterThan( 30 );
		} );

		it( 'should handle W handle (west only)', () => {
			const layer = { type: 'marker', size: 30 };
			const result = ResizeCalculator.calculateMarkerResize( layer, 'w', -10, 0 );
			expect( result.size ).toBeGreaterThan( 30 );
		} );
	} );

	describe( 'calculateDimensionResize', () => {
		it( 'should move x2,y2 when dragging E handle', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 100 };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'e', 50, 10 );
			expect( result.x2 ).toBe( 250 );
			expect( result.y2 ).toBe( 110 );
		} );

		it( 'should move x1,y1 when dragging W handle', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 100 };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'w', -30, 10 );
			expect( result.x1 ).toBe( 70 );
			expect( result.y1 ).toBe( 110 );
		} );

		it( 'should move x2,y2 when dragging SE handle', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 150 };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'se', 20, 30 );
			expect( result.x2 ).toBe( 220 );
			expect( result.y2 ).toBe( 180 );
		} );

		it( 'should move x1,y1 when dragging NW handle', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 150 };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'nw', -20, -30 );
			expect( result.x1 ).toBe( 80 );
			expect( result.y1 ).toBe( 70 );
		} );

		it( 'should constrain to horizontal when orientation=horizontal (coupled Y)', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 100, orientation: 'horizontal' };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'e', 50, 30 );
			// X moves individually for the dragged anchor
			expect( result.x2 ).toBe( 250 );
			// Y moves BOTH anchors together (coupled movement for repositioning)
			expect( result.y1 ).toBe( 130 );
			expect( result.y2 ).toBe( 130 );
		} );

		it( 'should constrain to vertical when orientation=vertical (coupled X)', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 100, y2: 200, orientation: 'vertical' };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'e', 50, 30 );
			// X moves BOTH anchors together (coupled movement for repositioning)
			expect( result.x1 ).toBe( 150 );
			expect( result.x2 ).toBe( 150 );
			// Y moves individually for the dragged anchor
			expect( result.y2 ).toBe( 230 );
		} );

		it( 'should couple X movement for vertical W handle', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 100, y2: 200, orientation: 'vertical' };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'w', -30, 20 );
			// X moves BOTH anchors together
			expect( result.x1 ).toBe( 70 );
			expect( result.x2 ).toBe( 70 );
			// Y moves individually for start point
			expect( result.y1 ).toBe( 120 );
		} );

		it( 'should couple Y movement for horizontal W handle', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 100, orientation: 'horizontal' };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'w', -30, 20 );
			// X moves individually for start point
			expect( result.x1 ).toBe( 70 );
			// Y moves BOTH anchors together
			expect( result.y1 ).toBe( 120 );
			expect( result.y2 ).toBe( 120 );
		} );

		it( 'should move both Y values when dragging N handle', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 100 };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'n', 0, -20 );
			expect( result.y1 ).toBe( 80 );
			expect( result.y2 ).toBe( 80 );
		} );

		it( 'should move both Y values when dragging S handle', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 100 };
			const result = ResizeCalculator.calculateDimensionResize( layer, 's', 0, 30 );
			expect( result.y1 ).toBe( 130 );
			expect( result.y2 ).toBe( 130 );
		} );

		it( 'should move both Y values for N handle even with horizontal orientation', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 100, orientation: 'horizontal' };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'n', 0, -20 );
			// N/S handles always move both Y values (repositioning)
			expect( result.y1 ).toBe( 80 );
			expect( result.y2 ).toBe( 80 );
		} );

		it( 'should use default coordinates when not specified', () => {
			const layer = { type: 'dimension' };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'e', 50, 10 );
			// Default x2 is 0, so new x2 should be 50
			expect( result.x2 ).toBe( 50 );
			expect( result.y2 ).toBe( 10 );
		} );
	} );

	// ====================================================================
	// Branch coverage gap tests
	// ====================================================================

	describe( 'calculateResize - type dispatch coverage', () => {
		it( 'should dispatch to calculateRectangleResize for blur type', () => {
			const layer = { type: 'blur', x: 0, y: 0, width: 100, height: 100 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.width ).toBe( 110 );
			expect( result.height ).toBe( 110 );
		} );

		it( 'should dispatch to calculateRectangleResize for image type', () => {
			const layer = { type: 'image', x: 0, y: 0, width: 200, height: 150 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 20, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.width ).toBe( 220 );
			expect( result.height ).toBe( 160 );
		} );

		it( 'should dispatch to calculateRectangleResize for customShape type', () => {
			const layer = { type: 'customShape', x: 10, y: 10, width: 80, height: 60 };
			const result = ResizeCalculator.calculateResize( layer, 'nw', -10, -10, {} );
			expect( result ).not.toBeNull();
			expect( result.width ).toBe( 90 );
			expect( result.height ).toBe( 70 );
		} );

		it( 'should dispatch to calculateRectangleResize for callout with normal handle', () => {
			const layer = {
				type: 'callout', x: 0, y: 0, width: 100, height: 80,
				tailTipX: 20, tailTipY: 50
			};
			const result = ResizeCalculator.calculateResize( layer, 'se', 20, 20, {} );
			expect( result ).not.toBeNull();
			expect( result.width ).toBe( 120 );
			expect( result.height ).toBe( 100 );
		} );

		it( 'should dispatch to calculateAngleDimensionResize for angleDimension', () => {
			const layer = {
				type: 'angleDimension',
				cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50
			};
			const result = ResizeCalculator.calculateResize( layer, 'nw', -10, -10, {} );
			expect( result ).not.toBeNull();
			expect( result.cx ).toBeDefined();
			expect( result.cy ).toBeDefined();
		} );

		it( 'should return null for unknown type', () => {
			const layer = { type: 'unknownType', x: 0, y: 0 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10, {} );
			expect( result ).toBeNull();
		} );

		it( 'should handle callout tailTip via calculateCalloutTailResize', () => {
			const layer = {
				type: 'callout', x: 0, y: 0, width: 100, height: 80,
				tailTipX: 10, tailTipY: 60
			};
			const result = ResizeCalculator.calculateResize( layer, 'tailTip', 15, 10, {} );
			expect( result ).not.toBeNull();
			expect( result.tailTipX ).toBeDefined();
			expect( result.tailTipY ).toBeDefined();
		} );

		it( 'should handle modifiers=undefined gracefully', () => {
			const layer = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
			const result = ResizeCalculator.calculateResize( layer, 'se', 10, 10 );
			expect( result ).not.toBeNull();
			expect( result.width ).toBe( 110 );
		} );
	} );

	describe( 'calculateCircleResize - unknown handle', () => {
		it( 'should return null for unknown handle type', () => {
			const layer = { type: 'circle', x: 50, y: 50, radius: 50 };
			const result = ResizeCalculator.calculateCircleResize( layer, 'unknown', 10, 10 );
			expect( result ).toBeNull();
		} );

		it( 'should return null for tailTip handle on circle', () => {
			const layer = { type: 'circle', x: 50, y: 50, radius: 50 };
			const result = ResizeCalculator.calculateCircleResize( layer, 'tailTip', 10, 10 );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'calculateEllipseResize - edge cases', () => {
		it( 'should return updates with no axis change for unknown handle', () => {
			const layer = { type: 'ellipse', x: 50, y: 50, radiusX: 50, radiusY: 30 };
			const result = ResizeCalculator.calculateEllipseResize( layer, 'unknown', 10, 10 );
			expect( result ).toBeDefined();
			// No axis-specific keys should be set for unknown handles
			expect( result.radiusX ).toBeUndefined();
			expect( result.radiusY ).toBeUndefined();
		} );
	} );

	describe( 'calculateRectangleResize - proportional edge cases', () => {
		it( 'should handle Infinity aspect ratio when height=0', () => {
			const layer = { type: 'rectangle', x: 0, y: 0, width: 100, height: 0 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'se', 20, 10, { proportional: true }
			);
			expect( result ).not.toBeNull();
			expect( result.width ).toBeDefined();
		} );

		it( 'should handle zero aspect ratio when width=0', () => {
			const layer = { type: 'rectangle', x: 0, y: 0, width: 0, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'se', 20, 10, { proportional: true }
			);
			expect( result ).not.toBeNull();
		} );

		it( 'should handle NaN aspect ratio when both width and height are 0', () => {
			const layer = { type: 'rectangle', x: 0, y: 0, width: 0, height: 0 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'se', 20, 10, { proportional: true }
			);
			expect( result ).not.toBeNull();
		} );

		it( 'should scale Y when X delta is larger in proportional mode with negative deltas', () => {
			const layer = { type: 'rectangle', x: 0, y: 0, width: 100, height: 50 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'nw', -30, -10, { proportional: true }
			);
			// absDeltaX (30) > absDeltaY (10), so deltaY is recalculated
			expect( result.width ).toBeGreaterThan( 100 );
			expect( result.height ).toBeGreaterThan( 50 );
		} );

		it( 'should scale X when Y delta is larger in proportional mode', () => {
			const layer = { type: 'rectangle', x: 0, y: 0, width: 100, height: 50 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'se', 5, 30, { proportional: true }
			);
			// absDeltaY (30) > absDeltaX (5), so deltaX is recalculated
			expect( result.width ).toBeGreaterThan( 100 );
			expect( result.height ).toBe( 80 );
		} );

		it( 'should handle proportional scaling with positive Y larger than X', () => {
			const layer = { type: 'rectangle', x: 0, y: 0, width: 200, height: 100 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'se', 10, 40, { proportional: true }
			);
			// absDeltaY (40) > absDeltaX (10)
			// deltaX recalculated: positive → absDeltaY * aspectRatio = 40 * 2 = 80
			expect( result.width ).toBe( 280 );
			expect( result.height ).toBe( 140 );
		} );

		it( 'should handle proportional scaling with negative X larger than Y', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 50 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'nw', -20, -5, { proportional: true }
			);
			// absDeltaX (20) > absDeltaY (5)
			// deltaY recalculated: negative → -absDeltaX / aspectRatio = -20 / 2 = -10
			expect( result.width ).toBe( 120 );
			expect( result.height ).toBe( 60 );
		} );
	} );

	describe( 'calculateRectangleResize - fromCenter for all handles', () => {
		const base = { type: 'rectangle', x: 50, y: 50, width: 100, height: 80 };

		it( 'should resize nw from center', () => {
			const result = ResizeCalculator.calculateRectangleResize( base, 'nw', -10, -10, { fromCenter: true } );
			expect( result.width ).toBe( 110 );
			expect( result.height ).toBe( 90 );
			expect( result.x ).toBeDefined();
			expect( result.y ).toBeDefined();
		} );

		it( 'should resize ne from center', () => {
			const result = ResizeCalculator.calculateRectangleResize( base, 'ne', 10, -10, { fromCenter: true } );
			expect( result.width ).toBe( 110 );
			expect( result.height ).toBe( 90 );
		} );

		it( 'should resize sw from center', () => {
			const result = ResizeCalculator.calculateRectangleResize( base, 'sw', -10, 10, { fromCenter: true } );
			expect( result.width ).toBe( 110 );
			expect( result.height ).toBe( 90 );
		} );

		it( 'should resize se from center', () => {
			const result = ResizeCalculator.calculateRectangleResize( base, 'se', 10, 10, { fromCenter: true } );
			expect( result.width ).toBe( 110 );
			expect( result.height ).toBe( 90 );
		} );

		it( 'should resize n from center', () => {
			const result = ResizeCalculator.calculateRectangleResize( base, 'n', 0, -10, { fromCenter: true } );
			expect( result.height ).toBe( 90 );
			expect( result.y ).toBeDefined();
		} );

		it( 'should resize s from center', () => {
			const result = ResizeCalculator.calculateRectangleResize( base, 's', 0, 10, { fromCenter: true } );
			expect( result.height ).toBe( 90 );
		} );

		it( 'should resize w from center', () => {
			const result = ResizeCalculator.calculateRectangleResize( base, 'w', -10, 0, { fromCenter: true } );
			expect( result.width ).toBe( 110 );
		} );

		it( 'should resize e from center', () => {
			const result = ResizeCalculator.calculateRectangleResize( base, 'e', 10, 0, { fromCenter: true } );
			expect( result.width ).toBe( 110 );
		} );
	} );

	describe( 'calculateRectangleResize - rotated resize correction', () => {
		it( 'should apply correction for N handle with rotation', () => {
			const layer = { x: 100, y: 100, width: 100, height: 100, rotation: 45 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'n', 0, -20, { fromCenter: false }
			);
			expect( result.y ).toBeDefined();
			expect( result.x ).toBeDefined();
			expect( result.height ).toBe( 120 );
		} );

		it( 'should apply correction for S handle with rotation', () => {
			const layer = { x: 100, y: 100, width: 100, height: 100, rotation: 90 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 's', 0, 20, { fromCenter: false }
			);
			expect( result.x ).toBeDefined();
			expect( result.y ).toBeDefined();
			expect( result.height ).toBe( 120 );
		} );

		it( 'should apply correction for E handle with rotation', () => {
			const layer = { x: 50, y: 50, width: 200, height: 80, rotation: 30 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'e', 20, 0, { fromCenter: false }
			);
			expect( result.x ).toBeDefined();
			expect( result.y ).toBeDefined();
			expect( result.width ).toBe( 220 );
		} );

		it( 'should apply correction for W handle with rotation', () => {
			const layer = { x: 50, y: 50, width: 200, height: 80, rotation: 60 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'w', -20, 0, { fromCenter: false }
			);
			expect( result.x ).toBeDefined();
			expect( result.y ).toBeDefined();
			expect( result.width ).toBe( 220 );
		} );

		it( 'should apply correction for NW corner handle with rotation', () => {
			const layer = { x: 100, y: 100, width: 100, height: 100, rotation: 45 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'nw', -10, -10, { fromCenter: false }
			);
			expect( result.x ).toBeDefined();
			expect( result.y ).toBeDefined();
			expect( result.width ).toBe( 110 );
			expect( result.height ).toBe( 110 );
		} );

		it( 'should apply correction for SE corner handle with rotation', () => {
			const layer = { x: 100, y: 100, width: 100, height: 100, rotation: 180 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'se', 10, 10, { fromCenter: false }
			);
			expect( result.x ).toBeDefined();
			expect( result.y ).toBeDefined();
		} );

		it( 'should NOT apply correction when fromCenter is true', () => {
			const layer = { x: 100, y: 100, width: 100, height: 100, rotation: 45 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'n', 0, -20, { fromCenter: true }
			);
			// fromCenter: correction is skipped, center-based calculation applies
			expect( result.height ).toBe( 120 );
		} );

		it( 'should NOT apply correction when rotation is 0', () => {
			const layer = { x: 100, y: 100, width: 100, height: 100, rotation: 0 };
			const result = ResizeCalculator.calculateRectangleResize(
				layer, 'n', 0, -20, { fromCenter: false }
			);
			expect( result.y ).toBe( 80 );
			expect( result.height ).toBe( 120 );
		} );
	} );

	describe( 'calculatePathResize - zero dimension scale fallback', () => {
		it( 'should handle zero width (vertical line path)', () => {
			const layer = {
				type: 'path',
				points: [ { x: 50, y: 0 }, { x: 50, y: 100 } ]
			};
			// Width is 0, height is 100
			const result = ResizeCalculator.calculatePathResize( layer, 's', 0, 20 );
			expect( result ).not.toBeNull();
			expect( result.points ).toHaveLength( 2 );
			// scaleX = 1 (fallback for 0 width), scaleY should change
			expect( result.points[ 0 ].x ).toBe( 50 );
		} );

		it( 'should handle zero height (horizontal line path)', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 50 }, { x: 100, y: 50 } ]
			};
			// Width is 100, height is 0
			const result = ResizeCalculator.calculatePathResize( layer, 'e', 20, 0 );
			expect( result ).not.toBeNull();
			expect( result.points ).toHaveLength( 2 );
			// scaleY = 1 (fallback for 0 height)
			expect( result.points[ 0 ].y ).toBe( 50 );
		} );

		it( 'should return null for unknown handle on path', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 100, y: 100 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 'unknown', 10, 10 );
			expect( result ).toBeNull();
		} );

		it( 'should return null when both width and height are < 1', () => {
			const layer = {
				type: 'path',
				points: [ { x: 50, y: 50 }, { x: 50.5, y: 50.5 } ]
			};
			const result = ResizeCalculator.calculatePathResize( layer, 'se', 10, 10 );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'calculateAngleDimensionResize - anchorIndex from handle', () => {
		it( 'should use anchorIndex=0 from handle to move vertex', () => {
			const layer = { cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50 };
			const handle = { anchorIndex: 0 };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 'e', 20, 10, handle );
			expect( result.cx ).toBe( 120 );
			expect( result.cy ).toBe( 110 );
			expect( result.ax ).toBeUndefined();
			expect( result.bx ).toBeUndefined();
		} );

		it( 'should use anchorIndex=1 from handle to move arm1', () => {
			const layer = { cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50 };
			const handle = { anchorIndex: 1 };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 'e', -10, -5, handle );
			expect( result.ax ).toBe( 40 );
			expect( result.ay ).toBe( 45 );
			expect( result.cx ).toBeUndefined();
		} );

		it( 'should use anchorIndex=2 from handle to move arm2', () => {
			const layer = { cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50 };
			const handle = { anchorIndex: 2 };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 'w', 15, 0, handle );
			expect( result.bx ).toBe( 165 );
			expect( result.by ).toBe( 50 );
			expect( result.cx ).toBeUndefined();
		} );

		it( 'should fallback to handleType when handle has no anchorIndex', () => {
			const layer = { cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50 };
			const handle = { someOtherProp: true };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 'nw', 10, 5, handle );
			// nw → anchorIndex=0 → vertex
			expect( result.cx ).toBe( 110 );
			expect( result.cy ).toBe( 105 );
		} );

		it( 'should fallback to handleType when handle is undefined', () => {
			const layer = { cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50 };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 'w', -10, 0 );
			// w → anchorIndex=1 → arm1
			expect( result.ax ).toBe( 40 );
			expect( result.ay ).toBe( 50 );
		} );

		it( 'should map sw handle to arm1 (anchorIndex=1)', () => {
			const layer = { cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50 };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 'sw', -5, 5 );
			expect( result.ax ).toBe( 45 );
			expect( result.ay ).toBe( 55 );
		} );

		it( 'should map e handle to arm2 (anchorIndex=2)', () => {
			const layer = { cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50 };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 'e', 10, 0 );
			expect( result.bx ).toBe( 160 );
			expect( result.by ).toBe( 50 );
		} );

		it( 'should map se handle to arm2 (anchorIndex=2)', () => {
			const layer = { cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50 };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 'se', 5, -5 );
			expect( result.bx ).toBe( 155 );
			expect( result.by ).toBe( 45 );
		} );

		it( 'should map n handle to vertex (anchorIndex=0)', () => {
			const layer = { cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50 };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 'n', 0, -20 );
			expect( result.cx ).toBe( 100 );
			expect( result.cy ).toBe( 80 );
		} );

		it( 'should map ne handle to vertex (anchorIndex=0)', () => {
			const layer = { cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50 };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 'ne', 10, -10 );
			expect( result.cx ).toBe( 110 );
			expect( result.cy ).toBe( 90 );
		} );

		it( 'should use default anchorIndex=0 for unknown handleType', () => {
			const layer = { cx: 100, cy: 100, ax: 50, ay: 50, bx: 150, by: 50 };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 's', 0, 10 );
			// default → anchorIndex=0 → vertex
			expect( result.cx ).toBe( 100 );
			expect( result.cy ).toBe( 110 );
		} );

		it( 'should handle missing coordinates with defaults', () => {
			const layer = { type: 'angleDimension' };
			const handle = { anchorIndex: 0 };
			const result = ResizeCalculator.calculateAngleDimensionResize( layer, 'n', 10, 20, handle );
			expect( result.cx ).toBe( 10 );
			expect( result.cy ).toBe( 20 );
		} );
	} );

	describe( 'getResizeCursor - edge cases', () => {
		it( 'should return default cursor for unknown handle type', () => {
			const result = ResizeCalculator.getResizeCursor( 'unknown', 0 );
			expect( result ).toBe( 'default' );
		} );

		it( 'should return default cursor for null handle type', () => {
			const result = ResizeCalculator.getResizeCursor( null, 0 );
			expect( result ).toBe( 'default' );
		} );

		it( 'should handle undefined rotation parameter', () => {
			const result = ResizeCalculator.getResizeCursor( 'n' );
			expect( result ).toBe( 'ns-resize' );
		} );

		it( 'should handle rotation=0 for all compass handles', () => {
			expect( ResizeCalculator.getResizeCursor( 'n', 0 ) ).toBe( 'ns-resize' );
			expect( ResizeCalculator.getResizeCursor( 'ne', 0 ) ).toBe( 'nesw-resize' );
			expect( ResizeCalculator.getResizeCursor( 'e', 0 ) ).toBe( 'ew-resize' );
			expect( ResizeCalculator.getResizeCursor( 'se', 0 ) ).toBe( 'nwse-resize' );
			expect( ResizeCalculator.getResizeCursor( 's', 0 ) ).toBe( 'ns-resize' );
			expect( ResizeCalculator.getResizeCursor( 'sw', 0 ) ).toBe( 'nesw-resize' );
			expect( ResizeCalculator.getResizeCursor( 'w', 0 ) ).toBe( 'ew-resize' );
			expect( ResizeCalculator.getResizeCursor( 'nw', 0 ) ).toBe( 'nwse-resize' );
		} );

		it( 'should rotate cursor for 90-degree rotation', () => {
			// At 90 degrees, N handle cursor should become E cursor
			expect( ResizeCalculator.getResizeCursor( 'n', 90 ) ).toBe( 'ew-resize' );
		} );

		it( 'should handle negative rotation', () => {
			const result = ResizeCalculator.getResizeCursor( 'n', -90 );
			expect( typeof result ).toBe( 'string' );
			expect( result ).not.toBe( 'default' );
		} );
	} );

	describe( 'calculateLineResize - perpendicular movement with rotation', () => {
		it( 'should apply perpendicular offset for N handle on arrow', () => {
			const layer = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0, rotation: 0 };
			const result = ResizeCalculator.calculateLineResize( layer, 'n', 0, -20 );
			expect( result.x1 ).toBeDefined();
			expect( result.y1 ).toBeDefined();
			expect( result.x2 ).toBeDefined();
			expect( result.y2 ).toBeDefined();
		} );

		it( 'should apply perpendicular offset for S handle on arrow', () => {
			const layer = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0, rotation: 0 };
			const result = ResizeCalculator.calculateLineResize( layer, 's', 0, 20 );
			expect( result.x1 ).toBeDefined();
			expect( result.y1 ).toBeDefined();
		} );

		it( 'should handle control point movement', () => {
			const layer = {
				type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0,
				controlX: 50, controlY: -30
			};
			const result = ResizeCalculator.calculateLineResize( layer, 'control', 10, 15 );
			expect( result.controlX ).toBe( 60 );
			expect( result.controlY ).toBe( -15 );
		} );

		it( 'should use midpoint as default control point when not specified', () => {
			const layer = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0 };
			const result = ResizeCalculator.calculateLineResize( layer, 'control', 10, 10 );
			expect( result.controlX ).toBe( 60 ); // midpoint 50 + 10
			expect( result.controlY ).toBe( 10 ); // midpoint 0 + 10
		} );

		it( 'should fall back to endpoint movement for unrecognized handle', () => {
			const layer = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 50 };
			const result = ResizeCalculator.calculateLineResize( layer, 'unknown', 10, 10 );
			expect( result.x2 ).toBe( 110 );
			expect( result.y2 ).toBe( 60 );
		} );
	} );

	describe( 'calculateCalloutTailResize - edge cases', () => {
		it( 'should calculate from legacy tail properties when tailTipX/Y not set', () => {
			const layer = {
				type: 'callout', x: 50, y: 50, width: 100, height: 80,
				tailDirection: 'bottom', tailPosition: 0.5, tailSize: 20
			};
			const result = ResizeCalculator.calculateCalloutTailResize( layer, 10, 5 );
			expect( result.tailTipX ).toBeDefined();
			expect( result.tailTipY ).toBeDefined();
		} );

		it( 'should handle rotated callout tail resize', () => {
			const layer = {
				type: 'callout', x: 50, y: 50, width: 100, height: 80,
				tailTipX: 10, tailTipY: 60, rotation: 45
			};
			const result = ResizeCalculator.calculateCalloutTailResize( layer, 10, 10 );
			expect( result.tailTipX ).toBeDefined();
			expect( result.tailTipY ).toBeDefined();
			// With rotation, the local delta differs from world delta
			expect( result.tailTipX ).not.toBe( 20 );
		} );

		it( 'should handle zero rotation', () => {
			const layer = {
				type: 'callout', x: 0, y: 0, width: 100, height: 80,
				tailTipX: 10, tailTipY: 60, rotation: 0
			};
			const result = ResizeCalculator.calculateCalloutTailResize( layer, 15, 10 );
			expect( result.tailTipX ).toBe( 25 );
			expect( result.tailTipY ).toBe( 70 );
		} );
	} );
} );
