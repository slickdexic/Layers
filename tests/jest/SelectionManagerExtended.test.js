/**
 * @jest-environment jsdom
 */

/**
 * Extended Unit Tests for SelectionManager
 *
 * Tests additional functionality like resize, rotation, duplicate,
 * delete, alignment operations, and bounds calculations.
 */

'use strict';

const SelectionManager = require( '../../resources/ext.layers.editor/SelectionManager.js' );

describe( 'SelectionManager Extended', () => {
	let selectionManager;
	let mockCanvasManager;
	let mockLayers;

	beforeEach( () => {
		mockLayers = [
			{
				id: 'layer1',
				type: 'rectangle',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				rotation: 0,
				visible: true,
				locked: false
			},
			{
				id: 'layer2',
				type: 'circle',
				x: 150,
				y: 100,
				width: 80,
				height: 80,
				rotation: 0,
				visible: true,
				locked: false
			},
			{
				id: 'layer3',
				type: 'text',
				x: 50,
				y: 200,
				width: 120,
				height: 30,
				rotation: 0,
				visible: true,
				locked: true
			}
		];

		mockCanvasManager = {
			layers: mockLayers,
			selectedLayerIds: [],
			redraw: jest.fn(),
			saveState: jest.fn(),
			isModified: false,
			snapToGrid: false,
			gridSize: 20,
			getLayerBounds: jest.fn( ( layer ) => {
				if ( !layer ) {
					return null;
				}
				return {
					x: layer.x,
					y: layer.y,
					width: layer.width,
					height: layer.height
				};
			} ),
			editor: {
				layers: mockLayers,
				updateStatus: jest.fn(),
				layerPanel: {
					updateSelection: jest.fn()
				},
				markDirty: jest.fn()
			}
		};

		selectionManager = new SelectionManager( {}, mockCanvasManager );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
	} );

	describe( 'selectAll', () => {
		it( 'should select all unlocked visible layers', () => {
			selectionManager.selectAll();

			// layer3 is locked, so it should NOT be selected
			expect( selectionManager.selectedLayerIds ).toEqual( [ 'layer1', 'layer2' ] );
			expect( selectionManager.lastSelectedId ).toBe( 'layer2' );
		} );

		it( 'should handle empty layers array', () => {
			mockCanvasManager.layers = [];
			mockCanvasManager.editor.layers = [];

			selectionManager.selectAll();

			expect( selectionManager.selectedLayerIds ).toEqual( [] );
		} );
	} );

	describe( 'deselectLayer', () => {
		it( 'should deselect a specific layer', () => {
			selectionManager.selectLayer( 'layer1', false );
			selectionManager.selectLayer( 'layer2', true );

			selectionManager.deselectLayer( 'layer1' );

			expect( selectionManager.selectedLayerIds ).toEqual( [ 'layer2' ] );
		} );

		it( 'should update lastSelectedId when deselecting the last selected', () => {
			selectionManager.selectLayer( 'layer1', false );
			selectionManager.selectLayer( 'layer2', true );

			selectionManager.deselectLayer( 'layer2' );

			expect( selectionManager.lastSelectedId ).toBe( 'layer1' );
		} );

		it( 'should set lastSelectedId to null when all deselected', () => {
			selectionManager.selectLayer( 'layer1', false );

			selectionManager.deselectLayer( 'layer1' );

			expect( selectionManager.lastSelectedId ).toBeNull();
		} );

		it( 'should handle deselecting non-selected layer', () => {
			selectionManager.selectLayer( 'layer1', false );

			selectionManager.deselectLayer( 'layer2' );

			expect( selectionManager.selectedLayerIds ).toEqual( [ 'layer1' ] );
		} );
	} );

	describe( 'isSelected', () => {
		it( 'should return true for selected layer', () => {
			selectionManager.selectLayer( 'layer1', false );

			expect( selectionManager.isSelected( 'layer1' ) ).toBe( true );
		} );

		it( 'should return false for non-selected layer', () => {
			selectionManager.selectLayer( 'layer1', false );

			expect( selectionManager.isSelected( 'layer2' ) ).toBe( false );
		} );
	} );

	describe( 'getSelectionCount', () => {
		it( 'should return 0 for no selection', () => {
			expect( selectionManager.getSelectionCount() ).toBe( 0 );
		} );

		it( 'should return correct count for multi-selection', () => {
			selectionManager.selectLayer( 'layer1', false );
			selectionManager.selectLayer( 'layer2', true );

			expect( selectionManager.getSelectionCount() ).toBe( 2 );
		} );
	} );

	describe( 'resize operations', () => {
		it( 'should start resize operation', () => {
			selectionManager.selectLayer( 'layer1', false );
			const handle = { name: 'se', x: 110, y: 70 };
			const point = { x: 110, y: 70 };

			selectionManager.startResize( handle, point );

			expect( selectionManager.isResizing ).toBe( true );
			expect( selectionManager.resizeHandle ).toBe( handle );
			expect( selectionManager.dragStartPoint ).toEqual( point );
			expect( selectionManager.originalLayerState ).toBeDefined();
		} );

		it( 'should not update resize when not resizing', () => {
			selectionManager.selectLayer( 'layer1', false );

			selectionManager.updateResize( { x: 120, y: 80 }, {} );

			// Layer should be unchanged
			expect( mockLayers[ 0 ].width ).toBe( 100 );
		} );

		it( 'should finish resize operation', () => {
			selectionManager.selectLayer( 'layer1', false );
			selectionManager.startResize( { name: 'se' }, { x: 110, y: 70 } );

			selectionManager.finishResize();

			expect( selectionManager.isResizing ).toBe( false );
			expect( selectionManager.resizeHandle ).toBeNull();
			expect( selectionManager.dragStartPoint ).toBeNull();
			expect( mockCanvasManager.saveState ).toHaveBeenCalled();
		} );
	} );

	describe( 'rotation operations', () => {
		it( 'should start rotation operation', () => {
			selectionManager.selectLayer( 'layer1', false );
			const point = { x: 60, y: 0 };

			selectionManager.startRotation( point );

			expect( selectionManager.isRotating ).toBe( true );
			expect( selectionManager.dragStartPoint ).toEqual( point );
			expect( selectionManager.originalLayerState ).toBeDefined();
		} );

		it( 'should not update rotation when not rotating', () => {
			selectionManager.selectLayer( 'layer1', false );

			selectionManager.updateRotation( { x: 100, y: 0 } );

			// Layer should be unchanged
			expect( mockLayers[ 0 ].rotation ).toBe( 0 );
		} );

		it( 'should update rotation during drag', () => {
			selectionManager.selectLayer( 'layer1', false );
			selectionManager.startRotation( { x: 60, y: -20 } );

			selectionManager.updateRotation( { x: 110, y: 45 } );

			// Rotation should have changed
			expect( mockLayers[ 0 ].rotation ).not.toBe( 0 );
		} );

		it( 'should finish rotation operation', () => {
			selectionManager.selectLayer( 'layer1', false );
			selectionManager.startRotation( { x: 60, y: 0 } );

			selectionManager.finishRotation();

			expect( selectionManager.isRotating ).toBe( false );
			expect( selectionManager.dragStartPoint ).toBeNull();
			expect( mockCanvasManager.saveState ).toHaveBeenCalled();
		} );
	} );

	describe( 'drag with grid snapping', () => {
		it( 'should snap to grid when enabled', () => {
			mockCanvasManager.snapToGrid = true;
			mockCanvasManager.gridSize = 20;

			selectionManager.selectLayer( 'layer1', false );
			selectionManager.startDrag( { x: 50, y: 45 } );
			selectionManager.updateDrag( { x: 73, y: 68 } );

			// Delta should be snapped to grid (23->20, 23->20)
			expect( mockLayers[ 0 ].x ).toBe( 30 ); // 10 + 20
			expect( mockLayers[ 0 ].y ).toBe( 40 ); // 20 + 20
		} );

		it( 'should not snap when grid disabled', () => {
			mockCanvasManager.snapToGrid = false;

			selectionManager.selectLayer( 'layer1', false );
			selectionManager.startDrag( { x: 50, y: 45 } );
			selectionManager.updateDrag( { x: 73, y: 68 } );

			// Delta should be exact (23, 23)
			expect( mockLayers[ 0 ].x ).toBe( 33 );
			expect( mockLayers[ 0 ].y ).toBe( 43 );
		} );
	} );

	describe( 'deleteSelected', () => {
		it( 'should delete selected layers', () => {
			selectionManager.selectLayer( 'layer1', false );
			selectionManager.selectLayer( 'layer2', true );

			selectionManager.deleteSelected();

			expect( mockCanvasManager.editor.layers ).toHaveLength( 1 );
			expect( mockCanvasManager.editor.layers[ 0 ].id ).toBe( 'layer3' );
			expect( selectionManager.selectedLayerIds ).toEqual( [] );
		} );

		it( 'should do nothing when nothing selected', () => {
			selectionManager.deleteSelected();

			expect( mockCanvasManager.editor.layers ).toHaveLength( 3 );
		} );

		it( 'should call saveState and markDirty', () => {
			selectionManager.selectLayer( 'layer1', false );

			selectionManager.deleteSelected();

			expect( mockCanvasManager.saveState ).toHaveBeenCalled();
			expect( mockCanvasManager.editor.markDirty ).toHaveBeenCalled();
		} );
	} );

	describe( 'duplicateSelected', () => {
		it( 'should duplicate selected layers', () => {
			selectionManager.selectLayer( 'layer1', false );

			selectionManager.duplicateSelected();

			expect( mockCanvasManager.editor.layers ).toHaveLength( 4 );
			const duplicated = mockCanvasManager.editor.layers[ 3 ];
			expect( duplicated.type ).toBe( 'rectangle' );
			expect( duplicated.x ).toBe( 30 ); // Original + 20 offset
			expect( duplicated.y ).toBe( 40 ); // Original + 20 offset
			expect( duplicated.id ).not.toBe( 'layer1' );
		} );

		it( 'should select duplicated layers', () => {
			selectionManager.selectLayer( 'layer1', false );

			selectionManager.duplicateSelected();

			expect( selectionManager.selectedLayerIds ).toHaveLength( 1 );
			expect( selectionManager.selectedLayerIds[ 0 ] ).not.toBe( 'layer1' );
		} );

		it( 'should do nothing when nothing selected', () => {
			selectionManager.duplicateSelected();

			expect( mockCanvasManager.editor.layers ).toHaveLength( 3 );
		} );

		it( 'should duplicate multiple selected layers', () => {
			selectionManager.selectLayer( 'layer1', false );
			selectionManager.selectLayer( 'layer2', true );

			selectionManager.duplicateSelected();

			expect( mockCanvasManager.editor.layers ).toHaveLength( 5 );
			expect( selectionManager.selectedLayerIds ).toHaveLength( 2 );
		} );
	} );

	describe( 'getLayerBoundsCompat', () => {
		it( 'should delegate to canvasManager when available', () => {
			const layer = mockLayers[ 0 ];

			selectionManager.getLayerBoundsCompat( layer );

			expect( mockCanvasManager.getLayerBounds ).toHaveBeenCalledWith( layer );
		} );

		it( 'should return null for null layer', () => {
			mockCanvasManager.getLayerBounds = null;

			const bounds = selectionManager.getLayerBoundsCompat( null );

			expect( bounds ).toBeNull();
		} );

		it( 'should handle rectangular bounds without canvasManager', () => {
			mockCanvasManager.getLayerBounds = null;
			const layer = { x: 10, y: 20, width: 100, height: 50 };

			const bounds = selectionManager.getLayerBoundsCompat( layer );

			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		it( 'should handle negative width/height', () => {
			mockCanvasManager.getLayerBounds = null;
			const layer = { x: 100, y: 100, width: -50, height: -30 };

			const bounds = selectionManager.getLayerBoundsCompat( layer );

			expect( bounds.x ).toBe( 50 );
			expect( bounds.y ).toBe( 70 );
			expect( bounds.width ).toBe( 50 );
			expect( bounds.height ).toBe( 30 );
		} );

		it( 'should handle line/arrow with x1,y1,x2,y2', () => {
			mockCanvasManager.getLayerBounds = null;
			const layer = { x1: 10, y1: 20, x2: 100, y2: 80 };

			const bounds = selectionManager.getLayerBoundsCompat( layer );

			expect( bounds ).toEqual( { x: 10, y: 20, width: 90, height: 60 } );
		} );

		it( 'should handle circle with center and radius', () => {
			mockCanvasManager.getLayerBounds = null;
			const layer = { x: 50, y: 50, radius: 25 };

			const bounds = selectionManager.getLayerBoundsCompat( layer );

			expect( bounds ).toEqual( { x: 25, y: 25, width: 50, height: 50 } );
		} );

		it( 'should handle ellipse with radiusX and radiusY', () => {
			mockCanvasManager.getLayerBounds = null;
			const layer = { x: 50, y: 50, radiusX: 30, radiusY: 20 };

			const bounds = selectionManager.getLayerBoundsCompat( layer );

			expect( bounds ).toEqual( { x: 20, y: 30, width: 60, height: 40 } );
		} );

		it( 'should handle polygon with points', () => {
			mockCanvasManager.getLayerBounds = null;
			const layer = {
				points: [
					{ x: 0, y: 0 },
					{ x: 100, y: 0 },
					{ x: 50, y: 80 }
				]
			};

			const bounds = selectionManager.getLayerBoundsCompat( layer );

			expect( bounds ).toEqual( { x: 0, y: 0, width: 100, height: 80 } );
		} );

		it( 'should return null for unknown layer type', () => {
			mockCanvasManager.getLayerBounds = null;
			const layer = { type: 'unknown', someProperty: 'value' };

			const bounds = selectionManager.getLayerBoundsCompat( layer );

			expect( bounds ).toBeNull();
		} );
	} );

	describe( 'getSelectionBounds', () => {
		it( 'should return null for no selection', () => {
			const bounds = selectionManager.getSelectionBounds();

			expect( bounds ).toBeNull();
		} );

		it( 'should return bounds for single selection', () => {
			selectionManager.selectLayer( 'layer1', false );

			const bounds = selectionManager.getSelectionBounds();

			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );
	} );

	describe( 'notifySelectionChange', () => {
		it( 'should update canvasManager selectedLayerIds', () => {
			selectionManager.selectLayer( 'layer1', false );

			expect( mockCanvasManager.selectedLayerIds ).toEqual( [ 'layer1' ] );
		} );

		it( 'should call redraw', () => {
			selectionManager.selectLayer( 'layer1', false );

			expect( mockCanvasManager.redraw ).toHaveBeenCalled();
		} );

		it( 'should update editor status', () => {
			selectionManager.selectLayer( 'layer1', false );

			expect( mockCanvasManager.editor.updateStatus ).toHaveBeenCalledWith( {
				selection: 1
			} );
		} );

		it( 'should update layer panel selection', () => {
			selectionManager.selectLayer( 'layer1', false );

			expect( mockCanvasManager.editor.layerPanel.updateSelection ).toHaveBeenCalledWith( [ 'layer1' ] );
		} );
	} );

	describe( 'saveSelectedLayersState', () => {
		it( 'should save state of selected layers', () => {
			selectionManager.selectLayer( 'layer1', false );
			selectionManager.selectLayer( 'layer2', true );

			const state = selectionManager.saveSelectedLayersState();

			expect( state.layer1 ).toBeDefined();
			expect( state.layer2 ).toBeDefined();
			expect( state.layer1.x ).toBe( 10 );
			expect( state.layer2.x ).toBe( 150 );
		} );

		it( 'should deep clone layer state', () => {
			selectionManager.selectLayer( 'layer1', false );

			const state = selectionManager.saveSelectedLayersState();

			// Modify original
			mockLayers[ 0 ].x = 999;

			// State should be unchanged
			expect( state.layer1.x ).toBe( 10 );
		} );
	} );

	describe( 'getSelectedLayers', () => {
		it( 'should return empty array when nothing selected', () => {
			const layers = selectionManager.getSelectedLayers();

			expect( layers ).toEqual( [] );
		} );

		it( 'should return selected layer objects', () => {
			selectionManager.selectLayer( 'layer1', false );
			selectionManager.selectLayer( 'layer2', true );

			const layers = selectionManager.getSelectedLayers();

			expect( layers ).toHaveLength( 2 );
			expect( layers[ 0 ].id ).toBe( 'layer1' );
			expect( layers[ 1 ].id ).toBe( 'layer2' );
		} );
	} );

	describe( 'getMultiSelectionBounds', () => {
		it( 'should return null for no selection', () => {
			const bounds = selectionManager.getMultiSelectionBounds();

			expect( bounds ).toBeNull();
		} );

		it( 'should return bounds for single selection', () => {
			selectionManager.selectLayer( 'layer1', false );

			const bounds = selectionManager.getMultiSelectionBounds();

			// getMultiSelectionBounds works for any number of selected layers
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		it( 'should return combined bounds for multi-selection', () => {
			selectionManager.selectLayer( 'layer1', false );
			selectionManager.selectLayer( 'layer2', true );

			const bounds = selectionManager.getMultiSelectionBounds();

			// layer1: 10,20 -> 110,70
			// layer2: 150,100 -> 230,180
			expect( bounds.x ).toBe( 10 );
			expect( bounds.y ).toBe( 20 );
			expect( bounds.width ).toBe( 220 ); // 230 - 10
			expect( bounds.height ).toBe( 160 ); // 180 - 20
		} );
	} );

	describe( 'constructor back-compat', () => {
		it( 'should handle old-style constructor with canvasManager only', () => {
			const sm = new SelectionManager( mockCanvasManager );

			expect( sm.canvasManager ).toBe( mockCanvasManager );
		} );
	} );

	describe( 'updateSelectionHandles', () => {
		it( 'should clear handles when nothing selected', () => {
			selectionManager.selectionHandles = [ { x: 0, y: 0 } ];

			selectionManager.updateSelectionHandles();

			expect( selectionManager.selectionHandles ).toEqual( [] );
		} );
	} );

	describe( 'edge cases', () => {
		it( 'should handle missing editor gracefully for deleteSelected', () => {
			mockCanvasManager.editor = null;

			selectionManager.selectLayer( 'layer1', false );
			selectionManager.deleteSelected();

			// Should use canvasManager.layers instead
			expect( mockCanvasManager.layers ).toHaveLength( 2 );
		} );

		it( 'should handle missing editor gracefully for duplicateSelected', () => {
			mockCanvasManager.editor = null;

			selectionManager.selectLayer( 'layer1', false );
			selectionManager.duplicateSelected();

			// Should use canvasManager.layers instead
			expect( mockCanvasManager.layers ).toHaveLength( 4 );
		} );
	} );
} );
