/**
 * Tests for rotated resize behavior in TransformController
 *
 * These tests verify that resizing rotated layers behaves correctly,
 * particularly for edge handles (n, s, e, w) on rotated shapes.
 */

const TransformController = require( '../../resources/ext.layers.editor/canvas/TransformController.js' );
const ResizeCalculator = require( '../../resources/ext.layers.editor/canvas/ResizeCalculator.js' );

// Set up ResizeCalculator in global namespace for TransformController to find
global.window = global.window || {};
global.window.Layers = global.window.Layers || {};
global.window.Layers.Canvas = global.window.Layers.Canvas || {};
global.window.Layers.Canvas.ResizeCalculator = ResizeCalculator;

/**
 * Helper to calculate world position of a local point after rotation around center
 */
function localToWorld( localX, localY, centerX, centerY, rotationDegrees ) {
	const rad = rotationDegrees * Math.PI / 180;
	const cos = Math.cos( rad );
	const sin = Math.sin( rad );
	return {
		x: centerX + localX * cos - localY * sin,
		y: centerY + localX * sin + localY * cos
	};
}

/**
 * Get world position of edge center for a layer
 */
function getEdgeCenterWorld( layer, edge ) {
	const x = layer.x || 0;
	const y = layer.y || 0;
	const w = layer.width || 0;
	const h = layer.height || 0;
	const rotation = layer.rotation || 0;
	const centerX = x + w / 2;
	const centerY = y + h / 2;

	let localX = 0, localY = 0;
	switch ( edge ) {
		case 'n': localY = -h / 2; break;
		case 's': localY = h / 2; break;
		case 'e': localX = w / 2; break;
		case 'w': localX = -w / 2; break;
	}
	return localToWorld( localX, localY, centerX, centerY, rotation );
}

describe( 'Rotated Resize Behavior', () => {
	let controller;
	let mockManager;
	let mockEditor;
	let mockCanvas;
	let testLayer;

	beforeEach( () => {
		mockCanvas = {
			style: { cursor: 'default' }
		};

		testLayer = {
			id: 'layer1',
			type: 'rectangle',
			x: 100,
			y: 100,
			width: 200,
			height: 100,
			rotation: 45
		};

		mockEditor = {
			layers: [ testLayer ],
			getLayerById: jest.fn( () => testLayer ),
			markDirty: jest.fn(),
			container: document.createElement( 'div' )
		};

		mockManager = {
			canvas: mockCanvas,
			editor: mockEditor,
			selectedLayerId: 'layer1',
			getSelectedLayerId: jest.fn( function () {
				return this.selectedLayerId;
			} ),
			renderLayers: jest.fn(),
			getToolCursor: jest.fn( () => 'default' )
		};

		controller = new TransformController( mockManager );
	} );

	describe( 'applyRotatedResizeCorrection', () => {
		it( 'should keep south edge fixed when resizing from north handle', () => {
			const layer = {
				x: 100, y: 100, width: 200, height: 100, rotation: 45
			};

			// Get original south edge position
			const origSouthEdge = getEdgeCenterWorld( layer, 's' );

			// For a non-rotated resize from north, the center would move up by 25
			// (half the height increase). But for rotated shapes, we need to 
			// account for the center moving along the rotated axis.
			// The correction should fix this.
			const updates = {
				y: layer.y - 50, // naive y change (will be corrected)
				height: layer.height + 50
			};

			// Apply correction
			controller.applyRotatedResizeCorrection( updates, layer, 'n' );

			// Calculate new south edge position
			const newLayer = {
				x: updates.x !== undefined ? updates.x : layer.x,
				y: updates.y,
				width: layer.width,
				height: updates.height,
				rotation: layer.rotation
			};
			const newSouthEdge = getEdgeCenterWorld( newLayer, 's' );

			// South edge should stay in the same world position
			expect( newSouthEdge.x ).toBeCloseTo( origSouthEdge.x, 1 );
			expect( newSouthEdge.y ).toBeCloseTo( origSouthEdge.y, 1 );
		} );

		it( 'should keep west edge fixed when resizing from east handle', () => {
			const layer = {
				x: 100, y: 100, width: 200, height: 100, rotation: 30
			};

			// Get original west edge position
			const origWestEdge = getEdgeCenterWorld( layer, 'w' );

			// Simulate resize from east: width increases by 60
			const updates = {
				width: layer.width + 60
			};

			// Apply correction
			controller.applyRotatedResizeCorrection( updates, layer, 'e' );

			// Calculate new west edge position
			const newLayer = {
				x: updates.x,
				y: updates.y !== undefined ? updates.y : layer.y,
				width: updates.width,
				height: layer.height,
				rotation: layer.rotation
			};
			const newWestEdge = getEdgeCenterWorld( newLayer, 'w' );

			// West edge should stay in the same world position
			expect( newWestEdge.x ).toBeCloseTo( origWestEdge.x, 1 );
			expect( newWestEdge.y ).toBeCloseTo( origWestEdge.y, 1 );
		} );

		it( 'should apply correction for corner handles on rotated shapes', () => {
			const layer = {
				x: 100, y: 100, width: 200, height: 100, rotation: 45
			};

			const updates = {
				x: 120, y: 80, width: 180, height: 120
			};
			const origUpdates = { ...updates };

			// Apply correction for corner handle (SE corner means NW corner should stay fixed)
			controller.applyRotatedResizeCorrection( updates, layer, 'se' );

			// Should modify x,y to keep opposite corner fixed in world space
			// The correction compensates for the rotation
			expect( updates.x ).not.toBe( origUpdates.x );
			expect( updates.y ).not.toBe( origUpdates.y );
			// Width and height should remain unchanged
			expect( updates.width ).toBe( origUpdates.width );
			expect( updates.height ).toBe( origUpdates.height );
		} );

		it( 'should not apply correction when rotation is 0', () => {
			const layer = {
				x: 100, y: 100, width: 200, height: 100, rotation: 0
			};

			const updates = {
				y: 80, height: 120
			};
			const origUpdates = { ...updates };

			// Apply correction
			controller.applyRotatedResizeCorrection( updates, layer, 'n' );

			// Should not modify updates when no rotation
			expect( updates.y ).toBe( origUpdates.y );
			expect( updates.x ).toBeUndefined();
		} );
	} );

	describe( 'Delta transformation for 45° rotation', () => {
		beforeEach( () => {
			// Start resize from north handle
			controller.startResize( { type: 'n' }, { x: 200, y: 100 } );
		} );

		it( 'should transform world-space delta to local-space', () => {
			// For a 45° rotated rectangle:
			// - The "north" edge is tilted at 45° (runs from upper-left to lower-right visually)
			// - Perpendicular to this edge (the direction that resizes height) is 45° the other way
			// - In local coords, "up" is (0, -1)
			// - After rotating by 45°, this becomes:
			//     worldX = 0 * cos(45) - (-1) * sin(45) = 0.707
			//     worldY = 0 * sin(45) + (-1) * cos(45) = -0.707
			// - So perpendicular to the visual north edge = (0.707, -0.707) in world space
			
			const perpDistance = 100;
			// Perpendicular to 45° rotated north edge is up-right diagonal
			const worldDeltaX = perpDistance * Math.sin( 45 * Math.PI / 180 ); // ~70.7
			const worldDeltaY = -perpDistance * Math.cos( 45 * Math.PI / 180 ); // ~-70.7
			
			const originalHeight = testLayer.height;
			
			controller.handleResize( { 
				x: 200 + worldDeltaX, 
				y: 100 + worldDeltaY 
			}, {} );
			
			// Height should increase by approximately 100 (the perpendicular distance)
			const heightChange = testLayer.height - originalHeight;
			
			// The height change should be close to perpDistance (100)
			expect( heightChange ).toBeCloseTo( perpDistance, 0 );
		} );

		it( 'should handle straight-up drag on 45° rotated shape', () => {
			// Dragging straight up (world coords) on a 45° rotated shape
			// World delta: (0, -100)
			// Local delta calculation:
			//   rotRad = -45° = -0.785
			//   cos(-45°) = 0.707, sin(-45°) = -0.707
			//   localDeltaX = 0 * 0.707 - (-100) * (-0.707) = -70.7
			//   localDeltaY = 0 * (-0.707) + (-100) * 0.707 = -70.7
			// So local deltaY = -70.7, which should increase height by ~70.7
			
			const originalHeight = testLayer.height;
			controller.handleResize( { x: 200, y: 0 }, {} ); // 100 pixels up
			
			const heightChange = testLayer.height - originalHeight;
			// Height should change by approximately 70.7 (not 100)
			expect( Math.abs( heightChange - 70.7 ) ).toBeLessThan( 2 );
		} );

		it( 'should handle straight-right drag on 45° rotated north handle', () => {
			// Dragging straight right (world coords) on a 45° rotated shape
			// World delta: (100, 0)
			// Local delta calculation:
			//   rotRad = -45° = -0.785
			//   cos(-45°) = 0.707, sin(-45°) = -0.707
			//   localDeltaX = 100 * 0.707 - 0 * (-0.707) = 70.7
			//   localDeltaY = 100 * (-0.707) + 0 * 0.707 = -70.7
			// So local deltaY = -70.7, which should increase height by ~70.7
			
			const originalHeight = testLayer.height;
			controller.handleResize( { x: 300, y: 100 }, {} ); // 100 pixels right
			
			const heightChange = testLayer.height - originalHeight;
			// Height should change by approximately 70.7
			expect( Math.abs( heightChange - 70.7 ) ).toBeLessThan( 2 );
		} );
	} );

	describe( 'Opposite edge stays fixed in world space', () => {
		it( 'should keep south edge fixed when resizing from north handle', () => {
			testLayer.rotation = 45;
			testLayer.x = 100;
			testLayer.y = 100;
			testLayer.width = 200;
			testLayer.height = 100;

			// Get original south edge position in world space
			const origSouthEdge = getEdgeCenterWorld( testLayer, 's' );

			controller.startResize( { type: 'n' }, { x: 200, y: 50 } );
			// Drag perpendicular to north edge (up-right at 45°) by 50 units
			const worldDeltaX = 50 * Math.sin( 45 * Math.PI / 180 );
			const worldDeltaY = -50 * Math.cos( 45 * Math.PI / 180 );
			controller.handleResize( { 
				x: 200 + worldDeltaX, 
				y: 50 + worldDeltaY 
			}, {} );

			// Get new south edge position
			const newSouthEdge = getEdgeCenterWorld( testLayer, 's' );

			// South edge should remain at the same world position
			expect( newSouthEdge.x ).toBeCloseTo( origSouthEdge.x, 0 );
			expect( newSouthEdge.y ).toBeCloseTo( origSouthEdge.y, 0 );
		} );

		it( 'should keep west edge fixed when resizing from east handle', () => {
			testLayer.rotation = 30;
			testLayer.x = 100;
			testLayer.y = 100;
			testLayer.width = 200;
			testLayer.height = 100;

			// Get original west edge position in world space
			const origWestEdge = getEdgeCenterWorld( testLayer, 'w' );

			controller.startResize( { type: 'e' }, { x: 300, y: 150 } );
			// Drag east (in local coords this is primarily deltaX)
			// At 30° rotation, perpendicular to east edge in world is (cos30, sin30) = (0.866, 0.5)
			const perpDist = 50;
			const worldDeltaX = perpDist * Math.cos( 30 * Math.PI / 180 );
			const worldDeltaY = perpDist * Math.sin( 30 * Math.PI / 180 );
			controller.handleResize( { 
				x: 300 + worldDeltaX, 
				y: 150 + worldDeltaY 
			}, {} );

			// Get new west edge position
			const newWestEdge = getEdgeCenterWorld( testLayer, 'w' );

			// West edge should remain at the same world position
			expect( newWestEdge.x ).toBeCloseTo( origWestEdge.x, 0 );
			expect( newWestEdge.y ).toBeCloseTo( origWestEdge.y, 0 );
		} );
	} );

	describe( 'East handle on 45° rotated shape', () => {
		beforeEach( () => {
			testLayer.rotation = 45;
			testLayer.width = 200;
			controller.startResize( { type: 'e' }, { x: 300, y: 100 } );
		} );

		it( 'should resize width when dragging perpendicular to east edge', () => {
			// Perpendicular to east edge at 45° means dragging diagonally down-right
			const perpDistance = 100;
			const worldDeltaX = perpDistance * Math.cos( 45 * Math.PI / 180 );
			const worldDeltaY = perpDistance * Math.sin( 45 * Math.PI / 180 );
			
			const originalWidth = testLayer.width;
			controller.handleResize( { 
				x: 300 + worldDeltaX, 
				y: 100 + worldDeltaY 
			}, {} );
			
			const widthChange = testLayer.width - originalWidth;
			expect( Math.abs( widthChange - perpDistance ) ).toBeLessThan( 2 );
		} );
	} );

	describe( '90° rotation edge cases', () => {
		beforeEach( () => {
			testLayer.rotation = 90;
			testLayer.width = 200;
			testLayer.height = 100;
		} );

		it( 'should swap axes effectively at 90° rotation', () => {
			// At 90°, dragging "up" in world space should affect width (since local Y is world X)
			controller.startResize( { type: 'n' }, { x: 200, y: 100 } );
			
			const originalHeight = testLayer.height;
			controller.handleResize( { x: 200, y: 0 }, {} ); // 100 pixels up
			
			// At 90° rotation:
			//   rotRad = -90° = -1.57
			//   cos(-90°) = 0, sin(-90°) = -1
			//   localDeltaX = 0 * 0 - (-100) * (-1) = -100
			//   localDeltaY = 0 * (-1) + (-100) * 0 = 0
			// Local deltaY = 0, so height shouldn't change much
			// But local deltaX = -100, which the 'n' handle ignores
			
			// Height change should be minimal (close to 0)
			expect( Math.abs( testLayer.height - originalHeight ) ).toBeLessThan( 2 );
		} );

		it( 'should resize correctly when dragging perpendicular to 90° rotated edge', () => {
			// At 90°, the visual "north" handle is on the original left side
			// Perpendicular direction for resize is now horizontal in world space
			// For 90° rotation:
			//   Local "up" (0, -1) maps to world (1, 0) [to the right]
			// So dragging right should increase height
			controller.startResize( { type: 'n' }, { x: 200, y: 100 } );
			
			const originalHeight = testLayer.height;
			controller.handleResize( { x: 250, y: 100 }, {} ); // 50 pixels right
			
			// At 90° rotation:
			//   rotRad = -90°
			//   cos(-90°) = 0, sin(-90°) = -1
			//   localDeltaX = 50 * 0 - 0 * (-1) = 0
			//   localDeltaY = 50 * (-1) + 0 * 0 = -50
			// Local deltaY = -50, so height increases by 50
			
			const heightChange = testLayer.height - originalHeight;
			expect( heightChange ).toBeCloseTo( 50, 0 );
		} );
	} );
} );
