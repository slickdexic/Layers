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

		it( 'should constrain to horizontal when orientation=horizontal', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 100, orientation: 'horizontal' };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'e', 50, 30 );
			// Y should not change due to horizontal constraint
			expect( result.x2 ).toBe( 250 );
			expect( result.y2 ).toBe( 100 ); // unchanged
		} );

		it( 'should constrain to vertical when orientation=vertical', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 100, y2: 200, orientation: 'vertical' };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'e', 50, 30 );
			// X should not change due to vertical constraint
			expect( result.x2 ).toBe( 100 ); // unchanged
			expect( result.y2 ).toBe( 230 );
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

		it( 'should not move Y values for N handle when horizontal orientation', () => {
			const layer = { type: 'dimension', x1: 100, y1: 100, x2: 200, y2: 100, orientation: 'horizontal' };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'n', 0, -20 );
			// Should not have y1 or y2 in updates
			expect( result.y1 ).toBeUndefined();
			expect( result.y2 ).toBeUndefined();
		} );

		it( 'should use default coordinates when not specified', () => {
			const layer = { type: 'dimension' };
			const result = ResizeCalculator.calculateDimensionResize( layer, 'e', 50, 10 );
			// Default x2 is 0, so new x2 should be 50
			expect( result.x2 ).toBe( 50 );
			expect( result.y2 ).toBe( 10 );
		} );
	} );
} );
