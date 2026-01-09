/**
 * Tests for AlignmentController
 */

const AlignmentController = require( '../../resources/ext.layers.editor/canvas/AlignmentController.js' );

describe( 'AlignmentController', () => {
	let controller;
	let mockCanvasManager;
	let mockEditor;
	let mockLayers;

	beforeEach( () => {
		mockLayers = [
			{ id: 'layer1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 },
			{ id: 'layer2', type: 'rectangle', x: 50, y: 100, width: 80, height: 60 },
			{ id: 'layer3', type: 'rectangle', x: 200, y: 50, width: 40, height: 40 }
		];

		mockEditor = {
			layers: mockLayers,
			getLayerById: jest.fn( ( id ) => mockLayers.find( ( l ) => l.id === id ) ),
			markDirty: jest.fn(),
			saveState: jest.fn()
		};

		mockCanvasManager = {
			editor: mockEditor,
			getSelectedLayerIds: jest.fn( () => [] ),
			getSelectedLayerId: jest.fn( () => null ),
			renderLayers: jest.fn(),
			selectionManager: {
				lastSelectedId: null
			}
		};

		controller = new AlignmentController( mockCanvasManager );
	} );

	afterEach( () => {
		if ( controller ) {
			controller.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should accept CanvasManager directly', () => {
			const ctrl = new AlignmentController( mockCanvasManager );
			expect( ctrl.canvasManager ).toBe( mockCanvasManager );
			expect( ctrl.editor ).toBe( mockEditor );
			ctrl.destroy();
		} );

		it( 'should accept config object with canvasManager property', () => {
			const config = {
				canvasManager: mockCanvasManager,
				editor: mockEditor
			};
			const ctrl = new AlignmentController( config );
			expect( ctrl.canvasManager ).toBe( mockCanvasManager );
			expect( ctrl.editor ).toBe( mockEditor );
			ctrl.destroy();
		} );

		it( 'should handle null input', () => {
			const ctrl = new AlignmentController( null );
			expect( ctrl.canvasManager ).toBeNull();
			expect( ctrl.editor ).toBeNull();
			ctrl.destroy();
		} );
	} );

	describe( 'getKeyObject', () => {
		it( 'should return null when no selectionManager', () => {
			mockCanvasManager.selectionManager = null;
			const keyObj = controller.getKeyObject();
			expect( keyObj ).toBeNull();
		} );

		it( 'should return null when no lastSelectedId', () => {
			mockCanvasManager.selectionManager.lastSelectedId = null;
			const keyObj = controller.getKeyObject();
			expect( keyObj ).toBeNull();
		} );

		it( 'should return the key object layer', () => {
			mockCanvasManager.selectionManager.lastSelectedId = 'layer2';
			const keyObj = controller.getKeyObject();
			expect( keyObj ).toBe( mockLayers[ 1 ] );
		} );

		it( 'should return null for locked key object', () => {
			mockLayers[ 1 ].locked = true;
			mockCanvasManager.selectionManager.lastSelectedId = 'layer2';
			const keyObj = controller.getKeyObject();
			expect( keyObj ).toBeNull();
		} );
	} );

	describe( 'getLayerBounds', () => {
		it( 'should calculate bounds for rectangle', () => {
			const bounds = controller.getLayerBounds( mockLayers[ 0 ] );
			expect( bounds.left ).toBe( 10 );
			expect( bounds.top ).toBe( 20 );
			expect( bounds.right ).toBe( 110 );
			expect( bounds.bottom ).toBe( 70 );
			expect( bounds.width ).toBe( 100 );
			expect( bounds.height ).toBe( 50 );
			expect( bounds.centerX ).toBe( 60 );
			expect( bounds.centerY ).toBe( 45 );
		} );

		it( 'should calculate bounds for line/arrow', () => {
			const line = { type: 'line', x1: 10, y1: 20, x2: 100, y2: 80 };
			const bounds = controller.getLayerBounds( line );
			expect( bounds.left ).toBe( 10 );
			expect( bounds.top ).toBe( 20 );
			expect( bounds.right ).toBe( 100 );
			expect( bounds.bottom ).toBe( 80 );
		} );

		it( 'should calculate bounds for circle', () => {
			const circle = { type: 'circle', x: 50, y: 50, radius: 25 };
			const bounds = controller.getLayerBounds( circle );
			expect( bounds.left ).toBe( 25 );
			expect( bounds.top ).toBe( 25 );
			expect( bounds.right ).toBe( 75 );
			expect( bounds.bottom ).toBe( 75 );
		} );

		it( 'should calculate bounds for path', () => {
			const path = {
				type: 'path',
				points: [ { x: 10, y: 20 }, { x: 100, y: 50 }, { x: 50, y: 80 } ]
			};
			const bounds = controller.getLayerBounds( path );
			expect( bounds.left ).toBe( 10 );
			expect( bounds.top ).toBe( 20 );
			expect( bounds.right ).toBe( 100 );
			expect( bounds.bottom ).toBe( 80 );
		} );
	} );

	describe( 'moveLayer', () => {
		it( 'should move rectangle by delta', () => {
			const layer = { type: 'rectangle', x: 10, y: 20 };
			controller.moveLayer( layer, 5, 10 );
			expect( layer.x ).toBe( 15 );
			expect( layer.y ).toBe( 30 );
		} );

		it( 'should move line by delta', () => {
			const layer = { type: 'line', x1: 10, y1: 20, x2: 100, y2: 80 };
			controller.moveLayer( layer, 5, 10 );
			expect( layer.x1 ).toBe( 15 );
			expect( layer.y1 ).toBe( 30 );
			expect( layer.x2 ).toBe( 105 );
			expect( layer.y2 ).toBe( 90 );
		} );

		it( 'should move arrow with control point by delta', () => {
			// Arrow with a curve control point (curved arrow)
			const layer = {
				type: 'arrow',
				x1: 10,
				y1: 20,
				x2: 100,
				y2: 80,
				controlX: 55,
				controlY: 30
			};
			controller.moveLayer( layer, 5, 10 );
			expect( layer.x1 ).toBe( 15 );
			expect( layer.y1 ).toBe( 30 );
			expect( layer.x2 ).toBe( 105 );
			expect( layer.y2 ).toBe( 90 );
			// Control point should also move
			expect( layer.controlX ).toBe( 60 );
			expect( layer.controlY ).toBe( 40 );
		} );

		it( 'should move arrow without control point by delta', () => {
			// Straight arrow (no control point)
			const layer = { type: 'arrow', x1: 10, y1: 20, x2: 100, y2: 80 };
			controller.moveLayer( layer, 5, 10 );
			expect( layer.x1 ).toBe( 15 );
			expect( layer.y1 ).toBe( 30 );
			expect( layer.x2 ).toBe( 105 );
			expect( layer.y2 ).toBe( 90 );
			// Control point should remain undefined
			expect( layer.controlX ).toBeUndefined();
			expect( layer.controlY ).toBeUndefined();
		} );

		it( 'should move path by delta', () => {
			const layer = {
				type: 'path',
				points: [ { x: 10, y: 20 }, { x: 50, y: 60 } ]
			};
			controller.moveLayer( layer, 5, 10 );
			expect( layer.points[ 0 ].x ).toBe( 15 );
			expect( layer.points[ 0 ].y ).toBe( 30 );
			expect( layer.points[ 1 ].x ).toBe( 55 );
			expect( layer.points[ 1 ].y ).toBe( 70 );
		} );
	} );

	describe( 'getSelectedLayers', () => {
		it( 'should return empty array when no selection', () => {
			const layers = controller.getSelectedLayers();
			expect( layers ).toEqual( [] );
		} );

		it( 'should return selected layers by IDs', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			const layers = controller.getSelectedLayers();
			expect( layers ).toHaveLength( 2 );
			expect( layers[ 0 ].id ).toBe( 'layer1' );
			expect( layers[ 1 ].id ).toBe( 'layer2' );
		} );

		it( 'should filter out locked layers', () => {
			mockLayers[ 0 ].locked = true;
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			const layers = controller.getSelectedLayers();
			expect( layers ).toHaveLength( 1 );
			expect( layers[ 0 ].id ).toBe( 'layer2' );
		} );
	} );

	describe( 'alignLeft - key object mode', () => {
		it( 'should do nothing with less than 2 layers', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1' ] );
			controller.alignLeft();
			expect( mockCanvasManager.renderLayers ).not.toHaveBeenCalled();
		} );

		it( 'should align layers to key object left edge', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2', 'layer3' ] );
			mockCanvasManager.selectionManager.lastSelectedId = 'layer2'; // Key object

			controller.alignLeft();

			// Key object (layer2) stays at x=50
			// Other layers align to key object's left edge (50)
			expect( mockLayers[ 0 ].x ).toBe( 50 ); // moved from 10 to 50
			expect( mockLayers[ 1 ].x ).toBe( 50 ); // unchanged (key object)
			expect( mockLayers[ 2 ].x ).toBe( 50 ); // moved from 200 to 50

			expect( mockCanvasManager.renderLayers ).toHaveBeenCalled();
			expect( mockEditor.markDirty ).toHaveBeenCalled();
			expect( mockEditor.saveState ).toHaveBeenCalled();
		} );

		it( 'should fall back to leftmost edge when no key object', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2', 'layer3' ] );
			mockCanvasManager.selectionManager.lastSelectedId = null; // No key object

			controller.alignLeft();

			// All layers should now have left edge at 10 (layer1's original left - the minimum)
			expect( mockLayers[ 0 ].x ).toBe( 10 ); // unchanged
			expect( mockLayers[ 1 ].x ).toBe( 10 ); // moved from 50 to 10
			expect( mockLayers[ 2 ].x ).toBe( 10 ); // moved from 200 to 10
		} );
	} );

	describe( 'alignRight - key object mode', () => {
		it( 'should align layers to key object right edge', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2', 'layer3' ] );
			mockCanvasManager.selectionManager.lastSelectedId = 'layer2'; // Key object at x=50, width=80, right=130

			controller.alignRight();

			// Key object (layer2) stays unchanged, right edge at 130
			// Other layers align to right = 130
			expect( mockLayers[ 0 ].x ).toBe( 30 ); // right at 130, width 100
			expect( mockLayers[ 1 ].x ).toBe( 50 ); // unchanged (key object)
			expect( mockLayers[ 2 ].x ).toBe( 90 ); // right at 130, width 40
		} );

		it( 'should fall back to rightmost edge when no key object', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2', 'layer3' ] );
			mockCanvasManager.selectionManager.lastSelectedId = null;

			controller.alignRight();

			// layer3's right edge is at 240 (200 + 40) - the maximum
			expect( mockLayers[ 0 ].x ).toBe( 140 ); // right at 240, width 100
			expect( mockLayers[ 1 ].x ).toBe( 160 ); // right at 240, width 80
			expect( mockLayers[ 2 ].x ).toBe( 200 ); // unchanged
		} );
	} );

	describe( 'alignTop - key object mode', () => {
		it( 'should align layers to key object top edge', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2', 'layer3' ] );
			mockCanvasManager.selectionManager.lastSelectedId = 'layer2'; // Key object at y=100

			controller.alignTop();

			// Key object (layer2) stays at y=100
			// Other layers align to top = 100
			expect( mockLayers[ 0 ].y ).toBe( 100 ); // moved from 20 to 100
			expect( mockLayers[ 1 ].y ).toBe( 100 ); // unchanged (key object)
			expect( mockLayers[ 2 ].y ).toBe( 100 ); // moved from 50 to 100
		} );

		it( 'should fall back to topmost edge when no key object', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2', 'layer3' ] );
			mockCanvasManager.selectionManager.lastSelectedId = null;

			controller.alignTop();

			// layer1's top is 20 (the minimum)
			expect( mockLayers[ 0 ].y ).toBe( 20 ); // unchanged
			expect( mockLayers[ 1 ].y ).toBe( 20 ); // moved from 100 to 20
			expect( mockLayers[ 2 ].y ).toBe( 20 ); // moved from 50 to 20
		} );
	} );

	describe( 'alignBottom - key object mode', () => {
		it( 'should align layers to key object bottom edge', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2', 'layer3' ] );
			mockCanvasManager.selectionManager.lastSelectedId = 'layer2'; // Key object at y=100, height=60, bottom=160

			controller.alignBottom();

			// Key object (layer2) stays unchanged, bottom at 160
			// Other layers align to bottom = 160
			expect( mockLayers[ 0 ].y ).toBe( 110 ); // bottom at 160, height 50
			expect( mockLayers[ 1 ].y ).toBe( 100 ); // unchanged (key object)
			expect( mockLayers[ 2 ].y ).toBe( 120 ); // bottom at 160, height 40
		} );

		it( 'should fall back to bottommost edge when no key object', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2', 'layer3' ] );
			mockCanvasManager.selectionManager.lastSelectedId = null;

			controller.alignBottom();

			// layer2's bottom is at 160 (100 + 60) - the maximum
			expect( mockLayers[ 0 ].y ).toBe( 110 ); // bottom at 160, height 50
			expect( mockLayers[ 1 ].y ).toBe( 100 ); // unchanged (happens to be at max)
			expect( mockLayers[ 2 ].y ).toBe( 120 ); // bottom at 160, height 40
		} );
	} );

	describe( 'alignCenterH - key object mode', () => {
		it( 'should align layers to key object horizontal center', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			mockCanvasManager.selectionManager.lastSelectedId = 'layer2'; // Key object centerX = 50 + 40 = 90

			controller.alignCenterH();

			// Key object (layer2) stays unchanged, centerX = 90
			// layer1: centerX should be 90, so x = 90 - 50 = 40
			expect( mockLayers[ 0 ].x ).toBe( 40 );
			expect( mockLayers[ 1 ].x ).toBe( 50 ); // unchanged (key object)
		} );

		it( 'should fall back to combined center when no key object', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			mockCanvasManager.selectionManager.lastSelectedId = null;

			controller.alignCenterH();

			// Combined bounds: left=10 (layer1), right=130 (layer2: 50+80)
			// Center = (10 + 130) / 2 = 70
			// layer1: centerX should be 70, so x = 70 - 50 = 20
			// layer2: centerX should be 70, so x = 70 - 40 = 30
			expect( mockLayers[ 0 ].x ).toBe( 20 );
			expect( mockLayers[ 1 ].x ).toBe( 30 );
		} );
	} );

	describe( 'distributeHorizontal', () => {
		it( 'should do nothing with less than 3 layers', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			controller.distributeHorizontal();
			expect( mockCanvasManager.renderLayers ).not.toHaveBeenCalled();
		} );

		it( 'should distribute layers with equal horizontal spacing', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2', 'layer3' ] );

			// Before: layer1 centerX=60, layer2 centerX=90, layer3 centerX=220
			// After: first and last unchanged, middle moves
			// Step = (220 - 60) / 2 = 80
			// layer2 new centerX = 60 + 80 = 140, so x = 140 - 40 = 100

			controller.distributeHorizontal();

			expect( mockLayers[ 0 ].x ).toBe( 10 ); // first - unchanged
			expect( mockLayers[ 2 ].x ).toBe( 200 ); // last - unchanged
			// Middle layer adjusted
		} );
	} );

	describe( 'distributeVertical', () => {
		it( 'should do nothing with less than 3 layers', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			controller.distributeVertical();
			expect( mockCanvasManager.renderLayers ).not.toHaveBeenCalled();
		} );

		it( 'should distribute layers with equal vertical spacing', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2', 'layer3' ] );

			// Before: layer1 centerY=45 (20+25), layer2 centerY=130 (100+30), layer3 centerY=70 (50+20)
			// Sorted by centerY: layer1 (45), layer3 (70), layer2 (130)
			// Step = (130 - 45) / 2 = 42.5
			// layer3 should move to centerY = 45 + 42.5 = 87.5

			controller.distributeVertical();

			// First and last should stay in place
			expect( mockLayers[ 0 ].y ).toBe( 20 ); // layer1 - first, unchanged
			expect( mockLayers[ 1 ].y ).toBe( 100 ); // layer2 - last when sorted by center, unchanged
		} );
	} );

	describe( 'alignCenterV - key object mode', () => {
		it( 'should align layers to key object vertical center', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			mockCanvasManager.selectionManager.lastSelectedId = 'layer2'; // Key object centerY = 100 + 30 = 130

			controller.alignCenterV();

			// Key object (layer2) stays unchanged, centerY = 130
			// layer1: centerY should be 130, so y = 130 - 25 = 105
			expect( mockLayers[ 0 ].y ).toBe( 105 );
			expect( mockLayers[ 1 ].y ).toBe( 100 ); // unchanged (key object)
		} );

		it( 'should fall back to combined center when no key object', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			mockCanvasManager.selectionManager.lastSelectedId = null;

			controller.alignCenterV();

			// Combined bounds: top=20 (layer1), bottom=160 (layer2: 100+60)
			// CenterY = (20 + 160) / 2 = 90
			// layer1: height=50, centerY should be 90, so y = 90 - 25 = 65
			// layer2: height=60, centerY should be 90, so y = 90 - 30 = 60
			expect( mockLayers[ 0 ].y ).toBe( 65 );
			expect( mockLayers[ 1 ].y ).toBe( 60 );
		} );

		it( 'should do nothing with less than 2 layers', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1' ] );
			controller.alignCenterV();
			expect( mockCanvasManager.renderLayers ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'getLayerBounds - text layers', () => {
		it( 'should estimate bounds for text layer without context', () => {
			const textLayer = { type: 'text', x: 100, y: 50, text: 'Hello', fontSize: 20 };
			const bounds = controller.getLayerBounds( textLayer );
			expect( bounds.left ).toBe( 100 );
			// Top is adjusted for text baseline
			expect( bounds.top ).toBeLessThan( 50 );
			expect( bounds.right ).toBeGreaterThan( 100 );
			expect( bounds.bottom ).toBeGreaterThan( bounds.top );
		} );

		it( 'should use default fontSize for text without fontSize', () => {
			const textLayer = { type: 'text', x: 100, y: 50, text: 'Test' };
			const bounds = controller.getLayerBounds( textLayer );
			expect( bounds ).toBeDefined();
			expect( bounds.left ).toBe( 100 );
		} );

		it( 'should handle empty text', () => {
			const textLayer = { type: 'text', x: 100, y: 50, text: '', fontSize: 16 };
			const bounds = controller.getLayerBounds( textLayer );
			expect( bounds ).toBeDefined();
			expect( bounds.width ).toBeGreaterThanOrEqual( 16 ); // At least fontSize
		} );
	} );

	describe( 'getSelectedLayers - single selection fallback', () => {
		it( 'should fall back to single selection when multi-select empty', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [] );
			mockCanvasManager.getSelectedLayerId.mockReturnValue( 'layer1' );

			const layers = controller.getSelectedLayers();
			expect( layers ).toHaveLength( 1 );
			expect( layers[ 0 ].id ).toBe( 'layer1' );
		} );

		it( 'should return empty array when both selections empty', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [] );
			mockCanvasManager.getSelectedLayerId.mockReturnValue( null );

			const layers = controller.getSelectedLayers();
			expect( layers ).toEqual( [] );
		} );

		it( 'should return empty array when single selection layer not found', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [] );
			mockCanvasManager.getSelectedLayerId.mockReturnValue( 'nonexistent' );

			const layers = controller.getSelectedLayers();
			expect( layers ).toEqual( [] );
		} );
	} );

	describe( 'getAvailability', () => {
		it( 'should return false for both when no selection', () => {
			const avail = controller.getAvailability();
			expect( avail.align ).toBe( false );
			expect( avail.distribute ).toBe( false );
		} );

		it( 'should return align=true with 2+ layers', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			const avail = controller.getAvailability();
			expect( avail.align ).toBe( true );
			expect( avail.distribute ).toBe( false );
		} );

		it( 'should return distribute=true with 3+ layers', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2', 'layer3' ] );
			const avail = controller.getAvailability();
			expect( avail.align ).toBe( true );
			expect( avail.distribute ).toBe( true );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up references', () => {
			controller.destroy();
			expect( controller.editor ).toBeNull();
			expect( controller.canvasManager ).toBeNull();
		} );
	} );
} );
