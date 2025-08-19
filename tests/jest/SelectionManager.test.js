/**
 * @jest-environment jsdom
 */

const SelectionManager = require('../../resources/ext.layers.editor/SelectionManager.js');

describe('SelectionManager', () => {
    let selectionManager;
    let mockCanvasManager;
    let mockLayers;

    beforeEach(() => {
        // Create mock layers
        mockLayers = [
            {
                id: 'layer1',
                type: 'rectangle',
                x: 10,
                y: 20,
                width: 100,
                height: 50,
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
                visible: false,
                locked: true
        }
        ];

        // Create mock CanvasManager
        mockCanvasManager = {
            layers: mockLayers,
            selectedLayerIds: [],
            redraw: jest.fn(),
            saveState: jest.fn(),
            isModified: false
        };

        // Create SelectionManager instance
        selectionManager = new SelectionManager(mockCanvasManager);
    });

    describe('initialization', () => {
        test('should create SelectionManager with correct properties', () => {
            expect(selectionManager.canvasManager).toBe(mockCanvasManager);
            expect(selectionManager.selectedLayerIds).toEqual([]);
            expect(selectionManager.marqueeStart).toBeNull();
            expect(selectionManager.marqueeEnd).toBeNull();
            expect(selectionManager.dragStart).toBeNull();
            expect(selectionManager.isDragging).toBe(false);
        });
    });

    describe('layer selection', () => {
        test('should select a single layer', () => {
            selectionManager.selectLayer('layer1', false);

            expect(selectionManager.selectedLayerIds).toEqual(['layer1']);
            expect(mockCanvasManager.selectedLayerIds).toEqual(['layer1']);
            expect(mockCanvasManager.redraw).toHaveBeenCalled();
        });

        test('should add layer to existing selection when multiSelect is true', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.selectLayer('layer2', true);

            expect(selectionManager.selectedLayerIds).toEqual(['layer1', 'layer2']);
        });

        test('should replace selection when multiSelect is false', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.selectLayer('layer2', false);

            expect(selectionManager.selectedLayerIds).toEqual(['layer2']);
        });

        test('should not select locked layers', () => {
            selectionManager.selectLayer('layer3', false);

            expect(selectionManager.selectedLayerIds).toEqual([]);
        });

        test('should not select invisible layers', () => {
            mockLayers[2].locked = false; // Unlock but keep invisible
            selectionManager.selectLayer('layer3', false);

            expect(selectionManager.selectedLayerIds).toEqual([]);
        });

        test('should deselect layer if already selected with multiSelect', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.selectLayer('layer1', true);

            expect(selectionManager.selectedLayerIds).toEqual([]);
        });
    });

    describe('clear selection', () => {
        test('should clear all selected layers', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.selectLayer('layer2', true);

            selectionManager.clearSelection();

            expect(selectionManager.selectedLayerIds).toEqual([]);
            expect(mockCanvasManager.selectedLayerIds).toEqual([]);
            expect(mockCanvasManager.redraw).toHaveBeenCalled();
        });
    });

    describe('hit testing', () => {
        test('should find layer at point', () => {
            const layer = selectionManager.getLayerAtPoint(50, 40);

            expect(layer).toBe(mockLayers[0]); // layer1 at 10,20 with 100x50
        });

        test('should return null if no layer at point', () => {
            const layer = selectionManager.getLayerAtPoint(300, 300);

            expect(layer).toBeNull();
        });

        test('should prioritize topmost visible layer', () => {
            // Add overlapping layer
            mockLayers.push({
                id: 'layer4',
                type: 'rectangle',
                x: 0,
                y: 10,
                width: 200,
                height: 100,
                visible: true,
                locked: false
            });

            const layer = selectionManager.getLayerAtPoint(50, 40);

            expect(layer.id).toBe('layer4'); // Most recent layer should be on top
        });

        test('should skip invisible layers in hit testing', () => {
            // Make layer1 invisible
            mockLayers[0].visible = false;

            const layer = selectionManager.getLayerAtPoint(50, 40);

            expect(layer).toBeNull();
        });
    });

    describe('marquee selection', () => {
        test('should start marquee selection', () => {
            selectionManager.startMarqueeSelection(10, 15);

            expect(selectionManager.marqueeStart).toEqual({ x: 10, y: 15 });
            expect(selectionManager.marqueeEnd).toEqual({ x: 10, y: 15 });
        });

        test('should update marquee selection', () => {
            selectionManager.startMarqueeSelection(10, 15);
            selectionManager.updateMarqueeSelection(50, 80);

            expect(selectionManager.marqueeEnd).toEqual({ x: 50, y: 80 });
            expect(mockCanvasManager.redraw).toHaveBeenCalled();
        });

        test('should finish marquee selection and select intersecting layers', () => {
            selectionManager.startMarqueeSelection(0, 0);
            selectionManager.updateMarqueeSelection(200, 150);
            selectionManager.finishMarqueeSelection();

            // Should select layer1 and layer2 which intersect with marquee
            expect(selectionManager.selectedLayerIds).toContain('layer1');
            expect(selectionManager.selectedLayerIds).toContain('layer2');
            expect(selectionManager.selectedLayerIds).not.toContain('layer3'); // invisible
            expect(selectionManager.marqueeStart).toBeNull();
            expect(selectionManager.marqueeEnd).toBeNull();
        });

        test('should handle empty marquee selection', () => {
            selectionManager.startMarqueeSelection(300, 300);
            selectionManager.updateMarqueeSelection(350, 350);
            selectionManager.finishMarqueeSelection();

            expect(selectionManager.selectedLayerIds).toEqual([]);
        });
    });

    describe('selection bounds', () => {
        test('should calculate bounds for single selected layer', () => {
            selectionManager.selectLayer('layer1', false);
            const bounds = selectionManager.getSelectionBounds();

            expect(bounds).toEqual({
                x: 10,
                y: 20,
                width: 100,
                height: 50
            });
        });

        test('should calculate combined bounds for multiple selected layers', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.selectLayer('layer2', true);
            const bounds = selectionManager.getSelectionBounds();

            expect(bounds).toEqual({
                x: 10,
                y: 20,
                width: 220, // from x:10 to x:230 (150+80)
                height: 160 // from y:20 to y:180 (100+80)
            });
        });

        test('should return null bounds for no selection', () => {
            const bounds = selectionManager.getSelectionBounds();

            expect(bounds).toBeNull();
        });
    });

    describe('layer dragging', () => {
        test('should start drag operation', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.startDrag(50, 45, false);

            expect(selectionManager.isDragging).toBe(true);
            expect(selectionManager.dragStart).toEqual({ x: 50, y: 45 });
        });

        test('should update drag and move layers', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.startDrag(50, 45, false);
            selectionManager.updateDrag(70, 65);

            // Layer should move by 20, 20
            expect(mockLayers[0].x).toBe(30);
            expect(mockLayers[0].y).toBe(40);
            expect(mockCanvasManager.redraw).toHaveBeenCalled();
        });

        test('should finish drag operation', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.startDrag(50, 45, false);
            selectionManager.updateDrag(70, 65);
            selectionManager.finishDrag();

            expect(selectionManager.isDragging).toBe(false);
            expect(selectionManager.dragStart).toBeNull();
            expect(mockCanvasManager.saveState).toHaveBeenCalled();
        });

        test('should not drag locked layers', () => {
            const originalX = mockLayers[2].x;
            const originalY = mockLayers[2].y;

            selectionManager.selectLayer('layer3', false);
            selectionManager.startDrag(50, 200, false);
            selectionManager.updateDrag(70, 220);

            // Locked layer should not move
            expect(mockLayers[2].x).toBe(originalX);
            expect(mockLayers[2].y).toBe(originalY);
        });
    });
});
