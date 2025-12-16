/**
 * @jest-environment jsdom
 */

/**
 * Integration Tests for Selection Workflows
 *
 * These tests verify hit testing functionality across different layer types.
 * HitTestController is the core component for click-to-select workflows.
 *
 * Note: SelectionManager has extensive unit tests in SelectionManager.test.js
 * and SelectionManagerExtended.test.js. These integration tests focus on
 * HitTestController which is used in the selection workflow.
 */

'use strict';

const HitTestController = require( '../../../resources/ext.layers.editor/canvas/HitTestController.js' );
const SelectionManager = require( '../../../resources/ext.layers.editor/SelectionManager.js' );

describe( 'Integration: HitTestController Layer Detection', () => {
	let hitTestController;
	let mockCanvasManager;
	let mockEditor;
	let testLayers;

	beforeEach( () => {
		// Create test layers with different types and positions
		testLayers = [
			{
				id: 'rect1',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 200,
				height: 150,
				visible: true,
				locked: false,
				name: 'Rectangle 1'
			},
			{
				id: 'circle1',
				type: 'circle',
				x: 400,
				y: 200,
				radius: 50,
				visible: true,
				locked: false,
				name: 'Circle 1'
			},
			{
				id: 'text1',
				type: 'text',
				x: 150,
				y: 350,
				width: 100,
				height: 30,
				text: 'Sample Text',
				fontSize: 16,
				visible: true,
				locked: false,
				name: 'Text 1'
			},
			{
				id: 'rect2',
				type: 'rectangle',
				x: 50,
				y: 50,
				width: 100,
				height: 100,
				visible: true,
				locked: false,
				name: 'Rectangle 2 (overlapping)'
			},
			{
				id: 'hidden1',
				type: 'rectangle',
				x: 500,
				y: 100,
				width: 100,
				height: 100,
				visible: false,
				locked: false,
				name: 'Hidden Rectangle'
			},
			{
				id: 'locked1',
				type: 'rectangle',
				x: 600,
				y: 100,
				width: 100,
				height: 100,
				visible: true,
				locked: true,
				name: 'Locked Rectangle'
			}
		];

		mockEditor = {
			layers: testLayers
		};

		mockCanvasManager = {
			layers: testLayers,
			editor: mockEditor,
			canvasRenderer: {
				getSelectionHandles: jest.fn( () => [] )
			},
			getLayerBounds: jest.fn( ( layer ) => {
				if ( !layer ) {
					return null;
				}
				if ( layer.type === 'circle' ) {
					return {
						x: layer.x - layer.radius,
						y: layer.y - layer.radius,
						width: layer.radius * 2,
						height: layer.radius * 2
					};
				}
				if ( layer.type === 'ellipse' ) {
					return {
						x: layer.x - layer.radiusX,
						y: layer.y - layer.radiusY,
						width: layer.radiusX * 2,
						height: layer.radiusY * 2
					};
				}
				if ( layer.type === 'star' ) {
					const r = layer.outerRadius || 50;
					return {
						x: layer.x - r,
						y: layer.y - r,
						width: r * 2,
						height: r * 2
					};
				}
				if ( layer.type === 'text' ) {
					return {
						x: layer.x,
						y: layer.y,
						width: layer.width || 100,
						height: layer.height || ( layer.fontSize || 16 )
					};
				}
				return {
					x: layer.x,
					y: layer.y,
					width: layer.width || 100,
					height: layer.height || 100
				};
			} )
		};

		hitTestController = new HitTestController( mockCanvasManager );
	} );

	describe( 'Click-to-Select Workflow', () => {
		test( 'should select layer when clicking inside its bounds', () => {
			// Click inside rect1 (100,100 to 300,250)
			const hitLayer = hitTestController.getLayerAtPoint( { x: 150, y: 150 } );

			expect( hitLayer ).not.toBeNull();
			expect( hitLayer.id ).toBe( 'rect1' );
		} );

		test( 'should select first matching layer in overlapping area', () => {
			// rect2 (50,50 to 150,150) overlaps with rect1 (100,100 to 300,250)
			// Overlapping area: (100,100) to (150,150)
			const hitLayer = hitTestController.getLayerAtPoint( { x: 120, y: 120 } );

			expect( hitLayer ).not.toBeNull();
			// rect1 is at index 0 in iteration order
			expect( hitLayer.id ).toBe( 'rect1' );
		} );

		test( 'should not select hidden layers', () => {
			// Click inside hidden rectangle
			const hitLayer = hitTestController.getLayerAtPoint( { x: 550, y: 150 } );

			expect( hitLayer ).toBeNull();
		} );

		test( 'should not select locked layers', () => {
			// Click inside locked rectangle
			const hitLayer = hitTestController.getLayerAtPoint( { x: 650, y: 150 } );

			expect( hitLayer ).toBeNull();
		} );

		test( 'should return null when clicking empty area', () => {
			// Click in empty area
			const hitLayer = hitTestController.getLayerAtPoint( { x: 800, y: 800 } );

			expect( hitLayer ).toBeNull();
		} );

		test( 'should select circle layer correctly', () => {
			// Circle is at (400, 200) with radius 50
			// Click inside circle
			const hitLayer = hitTestController.getLayerAtPoint( { x: 420, y: 210 } );

			expect( hitLayer ).not.toBeNull();
			expect( hitLayer.id ).toBe( 'circle1' );
		} );

		test( 'should not select circle when clicking outside radius', () => {
			// Circle is at (400, 200) with radius 50
			// Click outside circle but near bounding box corner
			const hitLayer = hitTestController.getLayerAtPoint( { x: 355, y: 155 } );

			expect( hitLayer ).toBeNull();
		} );
	} );

	describe( 'Rectangle Hit Testing', () => {
		beforeEach( () => {
			mockEditor.layers = [ {
				id: 'rect',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 200,
				height: 150,
				visible: true,
				locked: false
			} ];
		} );

		test( 'should detect point inside rectangle', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 150, y: 150 } );
			expect( hit.id ).toBe( 'rect' );
		} );

		test( 'should detect point on rectangle edge', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 100, y: 100 } );
			expect( hit.id ).toBe( 'rect' );
		} );

		test( 'should not detect point outside rectangle', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 50, y: 50 } );
			expect( hit ).toBeNull();
		} );

		test( 'should handle negative width/height', () => {
			mockEditor.layers = [ {
				id: 'negRect',
				type: 'rectangle',
				x: 200,
				y: 200,
				width: -100,
				height: -80,
				visible: true,
				locked: false
			} ];

			// Should normalize coordinates: effectively 100,120 to 200,200
			const hit = hitTestController.getLayerAtPoint( { x: 150, y: 150 } );
			expect( hit.id ).toBe( 'negRect' );
		} );
	} );

	describe( 'Circle Hit Testing', () => {
		beforeEach( () => {
			mockEditor.layers = [ {
				id: 'circle',
				type: 'circle',
				x: 200,
				y: 200,
				radius: 50,
				visible: true,
				locked: false
			} ];
		} );

		test( 'should detect point inside circle', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 200, y: 200 } );
			expect( hit.id ).toBe( 'circle' );
		} );

		test( 'should detect point on circle edge', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 250, y: 200 } );
			expect( hit.id ).toBe( 'circle' );
		} );

		test( 'should not detect point outside circle', () => {
			// Point at corner of bounding box, outside circle
			const hit = hitTestController.getLayerAtPoint( { x: 155, y: 155 } );
			expect( hit ).toBeNull();
		} );
	} );

	describe( 'Ellipse Hit Testing', () => {
		beforeEach( () => {
			mockEditor.layers = [ {
				id: 'ellipse',
				type: 'ellipse',
				x: 200,
				y: 200,
				radiusX: 100,
				radiusY: 50,
				visible: true,
				locked: false
			} ];
		} );

		test( 'should detect point inside ellipse', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 200, y: 200 } );
			expect( hit.id ).toBe( 'ellipse' );
		} );

		test( 'should not detect point outside ellipse', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 350, y: 300 } );
			expect( hit ).toBeNull();
		} );

		test( 'should detect point on major axis', () => {
			// Point on the right edge of ellipse (x = 200 + 100 = 300)
			const hit = hitTestController.getLayerAtPoint( { x: 299, y: 200 } );
			expect( hit.id ).toBe( 'ellipse' );
		} );
	} );

	describe( 'Line and Arrow Hit Testing', () => {
		test( 'should detect point near line', () => {
			mockEditor.layers = [ {
				id: 'line',
				type: 'line',
				x1: 100,
				y1: 100,
				x2: 300,
				y2: 300,
				visible: true,
				locked: false
			} ];

			const hit = hitTestController.getLayerAtPoint( { x: 200, y: 200 } );
			expect( hit.id ).toBe( 'line' );
		} );

		test( 'should detect point near arrow', () => {
			mockEditor.layers = [ {
				id: 'arrow',
				type: 'arrow',
				x1: 100,
				y1: 100,
				x2: 300,
				y2: 100,
				visible: true,
				locked: false
			} ];

			const hit = hitTestController.getLayerAtPoint( { x: 200, y: 100 } );
			expect( hit.id ).toBe( 'arrow' );
		} );

		test( 'should not detect point far from line', () => {
			mockEditor.layers = [ {
				id: 'line',
				type: 'line',
				x1: 100,
				y1: 100,
				x2: 300,
				y2: 100,
				visible: true,
				locked: false
			} ];

			const hit = hitTestController.getLayerAtPoint( { x: 200, y: 200 } );
			expect( hit ).toBeNull();
		} );
	} );

	describe( 'Polygon Hit Testing', () => {
		beforeEach( () => {
			mockEditor.layers = [ {
				id: 'polygon',
				type: 'polygon',
				x: 200,
				y: 200,
				points: [
					{ x: 0, y: -50 },
					{ x: 50, y: 50 },
					{ x: -50, y: 50 }
				],
				visible: true,
				locked: false
			} ];
		} );

		test( 'should detect point inside polygon', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 200, y: 200 } );
			expect( hit.id ).toBe( 'polygon' );
		} );

		test( 'should not detect point outside polygon', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 100, y: 100 } );
			expect( hit ).toBeNull();
		} );
	} );

	describe( 'Text Hit Testing', () => {
		beforeEach( () => {
			mockEditor.layers = [ {
				id: 'text',
				type: 'text',
				x: 100,
				y: 100,
				width: 150,
				height: 30,
				text: 'Hello World',
				fontSize: 16,
				visible: true,
				locked: false
			} ];
		} );

		test( 'should detect point inside text bounds', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 150, y: 115 } );
			expect( hit.id ).toBe( 'text' );
		} );

		test( 'should not detect point outside text bounds', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 300, y: 200 } );
			expect( hit ).toBeNull();
		} );
	} );

	describe( 'Path Hit Testing', () => {
		beforeEach( () => {
			mockEditor.layers = [ {
				id: 'path',
				type: 'path',
				points: [
					{ x: 100, y: 100 },
					{ x: 200, y: 150 },
					{ x: 300, y: 100 }
				],
				visible: true,
				locked: false
			} ];
		} );

		test( 'should detect point near path', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 150, y: 125 } );
			expect( hit.id ).toBe( 'path' );
		} );

		test( 'should not detect point far from path', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 200, y: 300 } );
			expect( hit ).toBeNull();
		} );
	} );

	describe( 'Star Hit Testing', () => {
		beforeEach( () => {
			mockEditor.layers = [ {
				id: 'star',
				type: 'star',
				x: 200,
				y: 200,
				outerRadius: 50,
				innerRadius: 25,
				points: 5,
				visible: true,
				locked: false
			} ];
		} );

		test( 'should detect point inside star', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 200, y: 200 } );
			expect( hit.id ).toBe( 'star' );
		} );

		test( 'should not detect point outside star', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 300, y: 300 } );
			expect( hit ).toBeNull();
		} );
	} );

	describe( 'Blur Hit Testing', () => {
		beforeEach( () => {
			mockEditor.layers = [ {
				id: 'blur',
				type: 'blur',
				x: 100,
				y: 100,
				width: 150,
				height: 100,
				visible: true,
				locked: false
			} ];
		} );

		test( 'should detect point inside blur region', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 150, y: 150 } );
			expect( hit.id ).toBe( 'blur' );
		} );

		test( 'should not detect point outside blur region', () => {
			const hit = hitTestController.getLayerAtPoint( { x: 300, y: 300 } );
			expect( hit ).toBeNull();
		} );
	} );

	describe( 'Layer Ordering and Visibility', () => {
		test( 'should return first matching visible unlocked layer', () => {
			mockEditor.layers = [
				{
					id: 'bottom',
					type: 'rectangle',
					x: 100,
					y: 100,
					width: 200,
					height: 200,
					visible: true,
					locked: false
				},
				{
					id: 'top',
					type: 'rectangle',
					x: 150,
					y: 150,
					width: 100,
					height: 100,
					visible: true,
					locked: false
				}
			];

			const hit = hitTestController.getLayerAtPoint( { x: 175, y: 175 } );
			// Returns first matching layer in iteration order
			expect( hit.id ).toBe( 'bottom' );
		} );

		test( 'should skip invisible layers', () => {
			mockEditor.layers = [
				{
					id: 'invisible',
					type: 'rectangle',
					x: 100,
					y: 100,
					width: 200,
					height: 200,
					visible: false,
					locked: false
				},
				{
					id: 'visible',
					type: 'rectangle',
					x: 150,
					y: 150,
					width: 100,
					height: 100,
					visible: true,
					locked: false
				}
			];

			const hit = hitTestController.getLayerAtPoint( { x: 175, y: 175 } );
			expect( hit.id ).toBe( 'visible' );
		} );

		test( 'should skip locked layers', () => {
			mockEditor.layers = [
				{
					id: 'locked',
					type: 'rectangle',
					x: 100,
					y: 100,
					width: 200,
					height: 200,
					visible: true,
					locked: true
				},
				{
					id: 'unlocked',
					type: 'rectangle',
					x: 150,
					y: 150,
					width: 100,
					height: 100,
					visible: true,
					locked: false
				}
			];

			const hit = hitTestController.getLayerAtPoint( { x: 175, y: 175 } );
			expect( hit.id ).toBe( 'unlocked' );
		} );
	} );

	describe( 'Edge Cases', () => {
		test( 'should handle empty layers array', () => {
			mockEditor.layers = [];
			const hit = hitTestController.getLayerAtPoint( { x: 100, y: 100 } );
			expect( hit ).toBeNull();
		} );

		test( 'should handle unknown layer type', () => {
			mockEditor.layers = [ {
				id: 'unknown',
				type: 'custom-shape',
				x: 100,
				y: 100,
				visible: true,
				locked: false
			} ];

			const hit = hitTestController.getLayerAtPoint( { x: 100, y: 100 } );
			// Unknown types should not match
			expect( hit ).toBeNull();
		} );

		test( 'should handle layer without explicit visibility', () => {
			mockEditor.layers = [ {
				id: 'rect',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 100,
				height: 100
				// visible not set - should default to visible
			} ];

			const hit = hitTestController.getLayerAtPoint( { x: 150, y: 150 } );
			expect( hit.id ).toBe( 'rect' );
		} );

		test( 'should handle zero-size layers at exact point', () => {
			mockEditor.layers = [ {
				id: 'zeroSize',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 0,
				height: 0,
				visible: true,
				locked: false
			} ];

			// Clicking exactly at the point should hit a zero-size rectangle
			// because the point is technically on the edge
			const hit = hitTestController.getLayerAtPoint( { x: 100, y: 100 } );
			expect( hit.id ).toBe( 'zeroSize' );
		} );

		test( 'should not hit zero-size layers when clicking elsewhere', () => {
			mockEditor.layers = [ {
				id: 'zeroSize',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 0,
				height: 0,
				visible: true,
				locked: false
			} ];

			// Clicking near but not exactly at the point should miss
			const hit = hitTestController.getLayerAtPoint( { x: 101, y: 101 } );
			expect( hit ).toBeNull();
		} );
	} );
} );

describe( 'Integration: HitTestController with SelectionManager', () => {
	let hitTestController;
	let selectionManager;
	let mockCanvasManager;
	let mockLayers;

	beforeEach( () => {
		mockLayers = [
			{
				id: 'layer1',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 100,
				height: 100,
				visible: true,
				locked: false
			},
			{
				id: 'layer2',
				type: 'circle',
				x: 300,
				y: 200,
				radius: 50,
				visible: true,
				locked: false
			}
		];

		mockCanvasManager = {
			layers: mockLayers,
			editor: {
				layers: mockLayers
			},
			selectedLayerIds: [],
			redraw: jest.fn(),
			saveState: jest.fn(),
			canvasRenderer: {
				getSelectionHandles: jest.fn( () => [] )
			},
			getLayerBounds: jest.fn( ( layer ) => {
				if ( !layer ) {
					return null;
				}
				if ( layer.type === 'circle' ) {
					return {
						x: layer.x - layer.radius,
						y: layer.y - layer.radius,
						width: layer.radius * 2,
						height: layer.radius * 2
					};
				}
				return {
					x: layer.x,
					y: layer.y,
					width: layer.width || 100,
					height: layer.height || 100
				};
			} )
		};

		hitTestController = new HitTestController( mockCanvasManager );
		selectionManager = new SelectionManager( mockCanvasManager );
	} );

	test( 'should integrate hit test with selection', () => {
		// Simulate click at point inside layer1
		const hitLayer = hitTestController.getLayerAtPoint( { x: 150, y: 150 } );

		expect( hitLayer ).not.toBeNull();
		expect( hitLayer.id ).toBe( 'layer1' );

		// Select the hit layer
		selectionManager.selectLayer( hitLayer.id );

		expect( selectionManager.selectedLayerIds ).toContain( 'layer1' );
	} );

	test( 'should not select layer when clicking empty space', () => {
		// Click empty area
		const hitLayer = hitTestController.getLayerAtPoint( { x: 500, y: 500 } );

		expect( hitLayer ).toBeNull();

		// Clear selection (what the editor does when clicking empty space)
		selectionManager.clearSelection();

		expect( selectionManager.selectedLayerIds ).toEqual( [] );
	} );

	test( 'should support multi-selection workflow', () => {
		// Click layer1
		const hit1 = hitTestController.getLayerAtPoint( { x: 150, y: 150 } );
		selectionManager.selectLayer( hit1.id );

		// Shift-click layer2 (add to selection)
		const hit2 = hitTestController.getLayerAtPoint( { x: 300, y: 200 } );
		selectionManager.selectLayer( hit2.id, true );

		expect( selectionManager.selectedLayerIds ).toContain( 'layer1' );
		expect( selectionManager.selectedLayerIds ).toContain( 'layer2' );
		expect( selectionManager.selectedLayerIds ).toHaveLength( 2 );
	} );

	test( 'should toggle selection on multi-select click', () => {
		// Select both layers
		selectionManager.selectLayer( 'layer1' );
		selectionManager.selectLayer( 'layer2', true );

		expect( selectionManager.selectedLayerIds ).toHaveLength( 2 );

		// Shift-click on already selected layer to deselect
		selectionManager.selectLayer( 'layer1', true );

		expect( selectionManager.selectedLayerIds ).toEqual( [ 'layer2' ] );
	} );
} );
