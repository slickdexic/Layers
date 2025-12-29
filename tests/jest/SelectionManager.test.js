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

    afterEach(() => {
        // Clean up global module stubs
        delete window.SelectionState;
        delete window.MarqueeSelection;
        delete window.SelectionHandles;
        if (window.Layers) {
            delete window.Layers.Selection;
        }
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

    describe('module delegation with SelectionState', () => {
        let mockSelectionState;
        let smWithModule;

        beforeEach(() => {
            mockSelectionState = {
                selectLayer: jest.fn(),
                deselectLayer: jest.fn(),
                clearSelection: jest.fn(),
                selectAll: jest.fn(),
                isSelected: jest.fn().mockReturnValue(true),
                getSelectionCount: jest.fn().mockReturnValue(2),
                getSelectedLayers: jest.fn().mockReturnValue([mockLayers[0], mockLayers[1]]),
                getSelectedIds: jest.fn().mockReturnValue(['layer1', 'layer2']),
                getLastSelectedId: jest.fn().mockReturnValue('layer2'),
                destroy: jest.fn()
            };

            // Create new manager and manually inject the module
            smWithModule = new SelectionManager(mockCanvasManager);
            smWithModule._selectionState = mockSelectionState;
        });

        test('should delegate selectLayer to SelectionState module', () => {
            smWithModule.selectLayer('layer1', true);
            
            expect(mockSelectionState.selectLayer).toHaveBeenCalledWith('layer1', true);
        });

        test('should delegate deselectLayer to SelectionState module', () => {
            smWithModule.deselectLayer('layer1');
            
            expect(mockSelectionState.deselectLayer).toHaveBeenCalledWith('layer1');
        });

        test('should delegate clearSelection to SelectionState module', () => {
            smWithModule.clearSelection();
            
            expect(mockSelectionState.clearSelection).toHaveBeenCalledWith(false);
        });

        test('should delegate selectAll to SelectionState module', () => {
            smWithModule.selectAll();
            
            expect(mockSelectionState.selectAll).toHaveBeenCalled();
        });

        test('should delegate isSelected to SelectionState module', () => {
            const result = smWithModule.isSelected('layer1');
            
            expect(mockSelectionState.isSelected).toHaveBeenCalledWith('layer1');
            expect(result).toBe(true);
        });

        test('should delegate getSelectionCount to SelectionState module', () => {
            const count = smWithModule.getSelectionCount();
            
            expect(mockSelectionState.getSelectionCount).toHaveBeenCalled();
            expect(count).toBe(2);
        });

        test('should delegate getSelectedLayers to SelectionState module', () => {
            const layers = smWithModule.getSelectedLayers();
            
            expect(mockSelectionState.getSelectedLayers).toHaveBeenCalled();
            expect(layers).toEqual([mockLayers[0], mockLayers[1]]);
        });
    });

    describe('module delegation with MarqueeSelection', () => {
        let mockMarqueeSelection;
        let smWithModule;

        beforeEach(() => {
            mockMarqueeSelection = {
                start: jest.fn(),
                update: jest.fn().mockReturnValue(['layer1']),
                finish: jest.fn(),
                getRect: jest.fn().mockReturnValue({ x: 0, y: 0, width: 100, height: 100 }),
                destroy: jest.fn()
            };

            // Create new manager and manually inject the module
            smWithModule = new SelectionManager(mockCanvasManager);
            smWithModule._marqueeSelection = mockMarqueeSelection;
        });

        test('should delegate startMarqueeSelection to MarqueeSelection module', () => {
            smWithModule.startMarqueeSelection(10, 20);
            
            expect(mockMarqueeSelection.start).toHaveBeenCalledWith({ x: 10, y: 20 });
            expect(smWithModule.isMarqueeSelecting).toBe(true);
        });

        test('should delegate startMarqueeSelection with point object', () => {
            smWithModule.startMarqueeSelection({ x: 15, y: 25 });
            
            expect(mockMarqueeSelection.start).toHaveBeenCalledWith({ x: 15, y: 25 });
        });

        test('should delegate updateMarqueeSelection to MarqueeSelection module', () => {
            smWithModule.startMarqueeSelection(10, 20);
            smWithModule.updateMarqueeSelection(50, 60);
            
            expect(mockMarqueeSelection.update).toHaveBeenCalledWith({ x: 50, y: 60 });
            expect(smWithModule.selectedLayerIds).toEqual(['layer1']);
        });

        test('should delegate finishMarqueeSelection to MarqueeSelection module', () => {
            smWithModule.startMarqueeSelection(10, 20);
            smWithModule.finishMarqueeSelection();
            
            expect(mockMarqueeSelection.finish).toHaveBeenCalled();
            expect(smWithModule.isMarqueeSelecting).toBe(false);
        });

        test('should delegate getMarqueeRect to MarqueeSelection module', () => {
            const rect = smWithModule.getMarqueeRect();
            
            expect(mockMarqueeSelection.getRect).toHaveBeenCalled();
            expect(rect).toEqual({ x: 0, y: 0, width: 100, height: 100 });
        });
    });

    describe('module delegation with SelectionHandles', () => {
        let mockSelectionHandles;
        let smWithModule;

        beforeEach(() => {
            mockSelectionHandles = {
                createSingleSelectionHandles: jest.fn(),
                createMultiSelectionHandles: jest.fn(),
                clear: jest.fn(),
                getHandles: jest.fn().mockReturnValue([
                    { x: 0, y: 0, type: 'nw' },
                    { x: 100, y: 0, type: 'ne' }
                ]),
                hitTest: jest.fn().mockReturnValue({ type: 'nw' }),
                destroy: jest.fn()
            };

            // Create new manager and manually inject the module
            smWithModule = new SelectionManager(mockCanvasManager);
            smWithModule._selectionHandles = mockSelectionHandles;
        });

        test('should delegate hitTestSelectionHandles to SelectionHandles module', () => {
            const result = smWithModule.hitTestSelectionHandles({ x: 5, y: 5 });
            
            expect(mockSelectionHandles.hitTest).toHaveBeenCalledWith({ x: 5, y: 5 });
            expect(result).toEqual({ type: 'nw' });
        });

        test('should delegate updateSelectionHandles for single selection', () => {
            smWithModule.selectedLayerIds = ['layer1'];
            smWithModule.updateSelectionHandles();
            
            expect(mockSelectionHandles.createSingleSelectionHandles).toHaveBeenCalled();
        });

        test('should delegate updateSelectionHandles for multi selection', () => {
            smWithModule.selectedLayerIds = ['layer1', 'layer2'];
            smWithModule.updateSelectionHandles();
            
            expect(mockSelectionHandles.createMultiSelectionHandles).toHaveBeenCalled();
        });

        test('should clear handles when no selection', () => {
            smWithModule.selectedLayerIds = [];
            smWithModule.updateSelectionHandles();
            
            expect(mockSelectionHandles.clear).toHaveBeenCalled();
        });

        test('should clear handles when selected layer not found', () => {
            smWithModule.selectedLayerIds = ['nonexistent'];
            smWithModule.updateSelectionHandles();
            
            expect(mockSelectionHandles.clear).toHaveBeenCalled();
        });
    });

    describe('destroy method', () => {
        test('should clean up all state on destroy', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.selectedLayerIds = ['layer1', 'layer2'];
            selectionManager.selectionHandles = [{ type: 'nw' }];
            selectionManager.marqueeStart = { x: 0, y: 0 };
            selectionManager.marqueeEnd = { x: 100, y: 100 };
            selectionManager.dragStart = { x: 50, y: 50 };
            selectionManager.lastSelectedId = 'layer1';

            selectionManager.destroy();

            expect(selectionManager.selectedLayerIds).toEqual([]);
            expect(selectionManager.selectionHandles).toEqual([]);
            expect(selectionManager.marqueeStart).toBeNull();
            expect(selectionManager.marqueeEnd).toBeNull();
            expect(selectionManager.dragStart).toBeNull();
            expect(selectionManager.lastSelectedId).toBeNull();
            expect(selectionManager.canvasManager).toBeNull();
            expect(selectionManager.config).toBeNull();
        });

        test('should destroy modules when present', () => {
            const mockModules = {
                selectionState: { destroy: jest.fn() },
                marqueeSelection: { destroy: jest.fn() },
                selectionHandles: { destroy: jest.fn() }
            };

            selectionManager._selectionState = mockModules.selectionState;
            selectionManager._marqueeSelection = mockModules.marqueeSelection;
            selectionManager._selectionHandles = mockModules.selectionHandles;

            selectionManager.destroy();

            expect(mockModules.selectionState.destroy).toHaveBeenCalled();
            expect(mockModules.marqueeSelection.destroy).toHaveBeenCalled();
            expect(mockModules.selectionHandles.destroy).toHaveBeenCalled();
            expect(selectionManager._selectionState).toBeNull();
            expect(selectionManager._marqueeSelection).toBeNull();
            expect(selectionManager._selectionHandles).toBeNull();
        });
    });

    describe('getLayerBoundsCompat edge cases', () => {
        test('should return null for null layer', () => {
            const bounds = selectionManager.getLayerBoundsCompat(null);
            expect(bounds).toBeNull();
        });

        test('should handle line/arrow layers with x1,y1,x2,y2', () => {
            const lineLayer = {
                id: 'line1',
                type: 'line',
                x1: 10,
                y1: 20,
                x2: 100,
                y2: 80
            };

            const bounds = selectionManager.getLayerBoundsCompat(lineLayer);

            expect(bounds).toEqual({
                x: 10,
                y: 20,
                width: 90,
                height: 60
            });
        });

        test('should handle line with reversed coordinates', () => {
            const lineLayer = {
                id: 'line1',
                type: 'line',
                x1: 100,
                y1: 80,
                x2: 10,
                y2: 20
            };

            const bounds = selectionManager.getLayerBoundsCompat(lineLayer);

            expect(bounds).toEqual({
                x: 10,
                y: 20,
                width: 90,
                height: 60
            });
        });

        test('should handle ellipse with radiusX and radiusY', () => {
            const ellipseLayer = {
                id: 'ellipse1',
                type: 'ellipse',
                x: 100,
                y: 100,
                radiusX: 50,
                radiusY: 30
            };

            const bounds = selectionManager.getLayerBoundsCompat(ellipseLayer);

            expect(bounds).toEqual({
                x: 50,
                y: 70,
                width: 100,
                height: 60
            });
        });

        test('should handle circle with radius', () => {
            const circleLayer = {
                id: 'circle1',
                type: 'circle',
                x: 100,
                y: 100,
                radius: 40
            };

            const bounds = selectionManager.getLayerBoundsCompat(circleLayer);

            expect(bounds).toEqual({
                x: 60,
                y: 60,
                width: 80,
                height: 80
            });
        });

        test('should handle polygon with points array', () => {
            const polygonLayer = {
                id: 'polygon1',
                type: 'polygon',
                points: [
                    { x: 10, y: 20 },
                    { x: 50, y: 10 },
                    { x: 80, y: 40 },
                    { x: 60, y: 70 },
                    { x: 20, y: 60 }
                ]
            };

            const bounds = selectionManager.getLayerBoundsCompat(polygonLayer);

            expect(bounds).toEqual({
                x: 10,
                y: 10,
                width: 70,
                height: 60
            });
        });

        test('should handle negative width/height rectangles', () => {
            const rectLayer = {
                id: 'rect1',
                type: 'rectangle',
                x: 100,
                y: 100,
                width: -50,
                height: -30
            };

            const bounds = selectionManager.getLayerBoundsCompat(rectLayer);

            expect(bounds).toEqual({
                x: 50,
                y: 70,
                width: 50,
                height: 30
            });
        });

        test('should delegate to canvasManager.getLayerBounds when available', () => {
            mockCanvasManager.getLayerBounds = jest.fn().mockReturnValue({
                x: 5, y: 5, width: 200, height: 200
            });

            const layer = mockLayers[0];
            const bounds = selectionManager.getLayerBoundsCompat(layer);

            expect(mockCanvasManager.getLayerBounds).toHaveBeenCalledWith(layer);
            expect(bounds).toEqual({ x: 5, y: 5, width: 200, height: 200 });
        });

        test('should return null for layer with insufficient points', () => {
            const pathLayer = {
                id: 'path1',
                type: 'path',
                points: [{ x: 10, y: 20 }, { x: 30, y: 40 }] // Only 2 points
            };

            const bounds = selectionManager.getLayerBoundsCompat(pathLayer);
            expect(bounds).toBeNull();
        });

        test('should return null for layer with no geometry properties', () => {
            const unknownLayer = {
                id: 'unknown1',
                type: 'unknown',
                name: 'Test'
            };

            const bounds = selectionManager.getLayerBoundsCompat(unknownLayer);
            expect(bounds).toBeNull();
        });
    });

    describe('deleteSelected', () => {
        test('should not delete when no selection', () => {
            selectionManager.clearSelection();
            const initialLayerCount = mockLayers.length;
            
            selectionManager.deleteSelected();
            
            expect(mockLayers.length).toBe(initialLayerCount);
        });

        test('should delete selected layers via StateManager', () => {
            const mockStateManager = {
                removeLayer: jest.fn(),
                set: jest.fn()
            };
            mockCanvasManager.editor = {
                stateManager: mockStateManager,
                layers: mockLayers,
                markDirty: jest.fn()
            };

            selectionManager.selectLayer('layer1', false);
            selectionManager.selectLayer('layer2', true);
            selectionManager.deleteSelected();

            expect(mockStateManager.removeLayer).toHaveBeenCalledWith('layer1');
            expect(mockStateManager.removeLayer).toHaveBeenCalledWith('layer2');
        });

        test('should use legacy fallback without StateManager', () => {
            mockCanvasManager.editor = {
                layers: [...mockLayers],
                markDirty: jest.fn()
            };

            selectionManager.selectLayer('layer1', false);
            selectionManager.deleteSelected();

            // Check that layer was removed from editor.layers
            expect(mockCanvasManager.editor.layers.some(l => l.id === 'layer1')).toBe(false);
        });
    });

    describe('duplicateSelected', () => {
        test('should not duplicate when no selection', () => {
            selectionManager.clearSelection();
            const initialLayerCount = mockLayers.length;
            
            selectionManager.duplicateSelected();
            
            expect(mockLayers.length).toBe(initialLayerCount);
        });

        test('should duplicate selected layers via StateManager', () => {
            const mockStateManager = {
                addLayer: jest.fn(),
                set: jest.fn()
            };
            mockCanvasManager.editor = {
                stateManager: mockStateManager,
                layers: mockLayers,
                markDirty: jest.fn()
            };

            selectionManager.selectLayer('layer1', false);
            selectionManager.duplicateSelected();

            expect(mockStateManager.addLayer).toHaveBeenCalled();
            const addedLayer = mockStateManager.addLayer.mock.calls[0][0];
            expect(addedLayer.x).toBe(mockLayers[0].x + 20);
            expect(addedLayer.y).toBe(mockLayers[0].y + 20);
            expect(addedLayer.id).not.toBe('layer1');
        });

        test('should use legacy fallback without StateManager', () => {
            mockCanvasManager.editor = {
                layers: [...mockLayers],
                markDirty: jest.fn()
            };

            selectionManager.selectLayer('layer1', false);
            const initialCount = mockCanvasManager.editor.layers.length;
            selectionManager.duplicateSelected();

            expect(mockCanvasManager.editor.layers.length).toBe(initialCount + 1);
        });

        test('should offset duplicated layers by 20,20', () => {
            mockCanvasManager.editor = {
                layers: [...mockLayers],
                markDirty: jest.fn()
            };

            selectionManager.selectLayer('layer1', false);
            selectionManager.duplicateSelected();

            const newLayer = mockCanvasManager.editor.layers[mockCanvasManager.editor.layers.length - 1];
            expect(newLayer.x).toBe(mockLayers[0].x + 20);
            expect(newLayer.y).toBe(mockLayers[0].y + 20);
        });
    });

    describe('generateLayerId', () => {
        test('should generate unique layer IDs', () => {
            const id1 = selectionManager.generateLayerId();
            const id2 = selectionManager.generateLayerId();

            expect(id1).toMatch(/^layer_\d+_[a-z0-9]+$/);
            expect(id2).toMatch(/^layer_\d+_[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });
    });

    describe('notifySelectionChange', () => {
        test('should sync selection to StateManager', () => {
            const mockStateManager = {
                set: jest.fn()
            };
            mockCanvasManager.editor = {
                stateManager: mockStateManager,
                updateStatus: jest.fn()
            };

            selectionManager.selectedLayerIds = ['layer1', 'layer2'];
            selectionManager.notifySelectionChange();

            expect(mockStateManager.set).toHaveBeenCalledWith('selectedLayerIds', ['layer1', 'layer2']);
        });

        test('should update editor status', () => {
            mockCanvasManager.editor = {
                updateStatus: jest.fn()
            };

            selectionManager.selectedLayerIds = ['layer1'];
            selectionManager.notifySelectionChange();

            expect(mockCanvasManager.editor.updateStatus).toHaveBeenCalledWith({ selection: 1 });
        });

        test('should update layer panel selection', () => {
            mockCanvasManager.editor = {
                layerPanel: {
                    updateSelection: jest.fn()
                }
            };

            selectionManager.selectedLayerIds = ['layer1', 'layer2'];
            selectionManager.notifySelectionChange();

            expect(mockCanvasManager.editor.layerPanel.updateSelection).toHaveBeenCalledWith(['layer1', 'layer2']);
        });
    });

    describe('applyDrag', () => {
        test('should apply drag to x,y coordinates', () => {
            const layer = { x: 10, y: 20 };
            const original = { x: 10, y: 20 };
            
            selectionManager.applyDrag(layer, original, 30, 40);

            expect(layer.x).toBe(40);
            expect(layer.y).toBe(60);
        });

        test('should apply drag to x1,y1,x2,y2 coordinates for lines', () => {
            const layer = { x1: 10, y1: 20, x2: 100, y2: 80 };
            const original = { x1: 10, y1: 20, x2: 100, y2: 80 };
            
            selectionManager.applyDrag(layer, original, 15, 25);

            expect(layer.x1).toBe(25);
            expect(layer.y1).toBe(45);
            expect(layer.x2).toBe(115);
            expect(layer.y2).toBe(105);
        });

        test('should apply drag to points array for polygons', () => {
            const layer = {
                points: [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 30 }]
            };
            const original = {
                points: [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 30 }]
            };
            
            selectionManager.applyDrag(layer, original, 5, 10);

            expect(layer.points).toEqual([
                { x: 15, y: 30 },
                { x: 35, y: 50 },
                { x: 55, y: 40 }
            ]);
        });
    });

    describe('applyResize', () => {
        test('should delegate to canvasManager.calculateResize when available', () => {
            mockCanvasManager.calculateResize = jest.fn().mockReturnValue({
                x: 5, y: 5, width: 150, height: 100
            });

            const layer = { x: 10, y: 10, width: 100, height: 50 };
            const original = { x: 10, y: 10, width: 100, height: 50 };
            selectionManager.resizeHandle = { type: 'se' };
            
            selectionManager.applyResize(layer, original, 50, 50, { shift: false });

            expect(mockCanvasManager.calculateResize).toHaveBeenCalledWith(
                original, 'se', 50, 50, { shift: false }
            );
            expect(layer.x).toBe(5);
            expect(layer.y).toBe(5);
            expect(layer.width).toBe(150);
            expect(layer.height).toBe(100);
        });
    });

    describe('saveSelectedLayersState', () => {
        test('should save deep copy of selected layers', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.selectLayer('layer2', true);
            
            const state = selectionManager.saveSelectedLayersState();

            expect(state.layer1).toEqual(mockLayers[0]);
            expect(state.layer2).toEqual(mockLayers[1]);
            
            // Verify it's a deep copy
            state.layer1.x = 999;
            expect(mockLayers[0].x).not.toBe(999);
        });

        test('should skip non-existent layers', () => {
            selectionManager.selectedLayerIds = ['layer1', 'nonexistent'];
            
            const state = selectionManager.saveSelectedLayersState();

            expect(state.layer1).toBeDefined();
            expect(state.nonexistent).toBeUndefined();
        });
    });

    describe('getMultiSelectionBounds', () => {
        test('should return null when no layers selected', () => {
            selectionManager.clearSelection();
            
            const bounds = selectionManager.getMultiSelectionBounds();

            expect(bounds).toBeNull();
        });

        test('should return combined bounds for multiple selections', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.selectLayer('layer2', true);
            
            const bounds = selectionManager.getMultiSelectionBounds();

            // layer1: x:10, y:20, w:100, h:50 -> max x:110, y:70
            // layer2: x:150, y:100, w:80, h:80 -> max x:230, y:180
            expect(bounds.x).toBe(10);
            expect(bounds.y).toBe(20);
            expect(bounds.width).toBe(220); // 230 - 10
            expect(bounds.height).toBe(160); // 180 - 20
        });
    });

    describe('rectIntersects', () => {
        test('should detect overlapping rectangles', () => {
            const rect1 = { x: 0, y: 0, width: 100, height: 100 };
            const rect2 = { x: 50, y: 50, width: 100, height: 100 };

            expect(selectionManager.rectIntersects(rect1, rect2)).toBe(true);
        });

        test('should detect non-overlapping rectangles', () => {
            const rect1 = { x: 0, y: 0, width: 50, height: 50 };
            const rect2 = { x: 100, y: 100, width: 50, height: 50 };

            expect(selectionManager.rectIntersects(rect1, rect2)).toBe(false);
        });

        test('should detect edge-touching rectangles as non-intersecting', () => {
            const rect1 = { x: 0, y: 0, width: 50, height: 50 };
            const rect2 = { x: 50, y: 0, width: 50, height: 50 };

            expect(selectionManager.rectIntersects(rect1, rect2)).toBe(false);
        });
    });

    describe('config and constructor variants', () => {
        test('should accept config object as first argument', () => {
            const config = { customOption: true };
            const sm = new SelectionManager(config, mockCanvasManager);

            expect(sm.config).toEqual(config);
            expect(sm.canvasManager).toBe(mockCanvasManager);
        });

        test('should handle back-compat constructor with just canvasManager', () => {
            const sm = new SelectionManager(mockCanvasManager);

            expect(sm.canvasManager).toBe(mockCanvasManager);
            expect(sm.config).toEqual({});
        });

        test('should handle null config gracefully', () => {
            const sm = new SelectionManager(null, mockCanvasManager);

            expect(sm.config).toEqual({});
            expect(sm.canvasManager).toBe(mockCanvasManager);
        });
    });

    describe('_getLayersArray fallback paths', () => {
        test('should fall back to canvasManager.layers', () => {
            const directLayersMockCanvasManager = {
                layers: mockLayers,
                selectedLayerIds: [],
                redraw: jest.fn()
            };
            
            const sm = new SelectionManager(directLayersMockCanvasManager);
            sm.selectLayer('layer1', false);

            expect(sm.selectedLayerIds).toContain('layer1');
        });

        test('should return empty array when no layers available', () => {
            const emptyManager = { 
                selectedLayerIds: [], 
                redraw: jest.fn(),
                layers: []  // Empty layers array
            };
            const sm = new SelectionManager(emptyManager);
            
            sm.selectLayer('layer1', false);

            expect(sm.selectedLayerIds).toEqual([]);
        });
    });

    describe('module initialization via Layers namespace', () => {
        test('should work with modules manually injected', () => {
            const mockState = {
                selectLayer: jest.fn(),
                getSelectedIds: jest.fn().mockReturnValue(['layer1']),
                getLastSelectedId: jest.fn().mockReturnValue('layer1'),
                destroy: jest.fn()
            };

            const sm = new SelectionManager(mockCanvasManager);
            sm._selectionState = mockState;
            
            sm.selectLayer('layer1', false);

            // Should have called the module
            expect(mockState.selectLayer).toHaveBeenCalledWith('layer1', false);
        });
    });

    describe('updateMarqueeSelection edge cases', () => {
        test('should not update if not currently marquee selecting', () => {
            selectionManager.isMarqueeSelecting = false;
            selectionManager.marqueeStart = null;
            
            selectionManager.updateMarqueeSelection(100, 100);

            expect(selectionManager.marqueeEnd).toBeNull();
        });

        test('should update with point object', () => {
            selectionManager.startMarqueeSelection(10, 10);
            selectionManager.updateMarqueeSelection({ x: 50, y: 60 });

            expect(selectionManager.marqueeEnd).toEqual({ x: 50, y: 60 });
        });
    });

    describe('createSingleSelectionHandles fallback', () => {
        test('should create handles with correct positions', () => {
            const layer = {
                id: 'test',
                x: 10,
                y: 20,
                width: 100,
                height: 50
            };

            selectionManager.createSingleSelectionHandles(layer);

            expect(selectionManager.selectionHandles.length).toBe(9); // 4 corners + 4 edges + rotation
            
            // Check corner handles
            const nw = selectionManager.selectionHandles.find(h => h.type === 'nw');
            expect(nw.x).toBe(10);
            expect(nw.y).toBe(20);
            
            const se = selectionManager.selectionHandles.find(h => h.type === 'se');
            expect(se.x).toBe(110);
            expect(se.y).toBe(70);
            
            // Check rotation handle
            const rotate = selectionManager.selectionHandles.find(h => h.type === 'rotate');
            expect(rotate.x).toBe(60); // center x
            expect(rotate.y).toBe(0); // above the layer
        });

        test('should not create handles for null bounds', () => {
            const layer = { id: 'unknown', type: 'unknown' };
            
            selectionManager.createSingleSelectionHandles(layer);

            expect(selectionManager.selectionHandles).toEqual([]);
        });
    });

    describe('createMultiSelectionHandles fallback', () => {
        test('should create corner handles only for multi-selection', () => {
            selectionManager.selectLayer('layer1', false);
            selectionManager.selectLayer('layer2', true);
            
            selectionManager.createMultiSelectionHandles();

            expect(selectionManager.selectionHandles.length).toBe(4); // 4 corners only
            
            const types = selectionManager.selectionHandles.map(h => h.type);
            expect(types).toContain('nw');
            expect(types).toContain('ne');
            expect(types).toContain('se');
            expect(types).toContain('sw');
            expect(types).not.toContain('rotate');
        });

        test('should not create handles when no selection', () => {
            selectionManager.clearSelection();
            
            selectionManager.createMultiSelectionHandles();

            expect(selectionManager.selectionHandles).toEqual([]);
        });
    });

    describe('hitTestSelectionHandles fallback', () => {
        test('should find handle at point', () => {
            const layer = {
                id: 'test',
                x: 10,
                y: 20,
                width: 100,
                height: 50
            };
            selectionManager.createSingleSelectionHandles(layer);

            // Test hit on NW corner (at 10, 20)
            const handle = selectionManager.hitTestSelectionHandles({ x: 10, y: 20 });

            expect(handle).not.toBeNull();
            expect(handle.type).toBe('nw');
        });

        test('should return null when no handle at point', () => {
            const layer = {
                id: 'test',
                x: 10,
                y: 20,
                width: 100,
                height: 50
            };
            selectionManager.createSingleSelectionHandles(layer);

            const handle = selectionManager.hitTestSelectionHandles({ x: 500, y: 500 });

            expect(handle).toBeNull();
        });
    });

    describe('getMarqueeRect fallback', () => {
        test('should return zero rect when marquee not active', () => {
            selectionManager.marqueeStart = null;
            selectionManager.marqueeEnd = null;

            const rect = selectionManager.getMarqueeRect();

            expect(rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
        });

        test('should handle reversed marquee coordinates', () => {
            selectionManager.marqueeStart = { x: 100, y: 100 };
            selectionManager.marqueeEnd = { x: 50, y: 50 };

            const rect = selectionManager.getMarqueeRect();

            expect(rect).toEqual({ x: 50, y: 50, width: 50, height: 50 });
        });
    });

    describe('getDefaultLayerName', () => {
        test('should return "Layer" for null layer', () => {
            const name = selectionManager.getDefaultLayerName(null);
            expect(name).toBe('Layer');
        });

        test('should return "Layer" for layer without type', () => {
            const name = selectionManager.getDefaultLayerName({});
            expect(name).toBe('Layer');
        });

        test('should return capitalized type when no i18n available', () => {
            delete window.layersMessages;
            const name = selectionManager.getDefaultLayerName({ type: 'rectangle' });
            expect(name).toBe('Rectangle');
        });

        test('should use i18n message when available', () => {
            window.layersMessages = {
                get: jest.fn((key, fallback) => {
                    if (key === 'layers-type-arrow') {
                        return 'Arrow Shape';
                    }
                    return fallback;
                })
            };
            const name = selectionManager.getDefaultLayerName({ type: 'arrow' });
            expect(name).toBe('Arrow Shape');
            delete window.layersMessages;
        });

        test('should fall back to capitalized type when i18n returns empty', () => {
            window.layersMessages = {
                get: jest.fn(() => '')
            };
            const name = selectionManager.getDefaultLayerName({ type: 'circle' });
            expect(name).toBe('Circle');
            delete window.layersMessages;
        });
    });

    describe('accessibility announcer', () => {
        test('should announce layer selection when announcer available', () => {
            const mockAnnouncer = {
                announceLayerSelection: jest.fn()
            };
            window.layersAnnouncer = mockAnnouncer;

            // Add a layer with a name
            mockLayers.push({ id: 'namedLayer', name: 'My Named Layer', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
            
            selectionManager.selectLayer('namedLayer', false);

            expect(mockAnnouncer.announceLayerSelection).toHaveBeenCalledWith('My Named Layer');

            delete window.layersAnnouncer;
            // Clean up
            mockLayers.pop();
        });

        test('should use default layer name when layer has no name', () => {
            const mockAnnouncer = {
                announceLayerSelection: jest.fn()
            };
            window.layersAnnouncer = mockAnnouncer;

            selectionManager.selectLayer('layer1', false);

            // Should be called with default name (capitalized type)
            expect(mockAnnouncer.announceLayerSelection).toHaveBeenCalled();

            delete window.layersAnnouncer;
        });
    });

    describe('notifyToolbarOfSelection', () => {
        test('should do nothing when editor not available', () => {
            selectionManager.canvasManager = {};
            expect(() => selectionManager.notifyToolbarOfSelection()).not.toThrow();
        });

        test('should do nothing when toolbar not available', () => {
            selectionManager.canvasManager = { editor: {} };
            expect(() => selectionManager.notifyToolbarOfSelection()).not.toThrow();
        });

        test('should do nothing when styleControls not available', () => {
            selectionManager.canvasManager = { editor: { toolbar: {} } };
            expect(() => selectionManager.notifyToolbarOfSelection()).not.toThrow();
        });

        test('should call updateForSelection when available', () => {
            const mockUpdateForSelection = jest.fn();
            selectionManager.canvasManager = {
                editor: {
                    toolbar: {
                        styleControls: {
                            updateForSelection: mockUpdateForSelection
                        }
                    },
                    layers: mockLayers
                },
                layers: mockLayers
            };
            selectionManager.selectedLayerIds = ['layer1'];

            selectionManager.notifyToolbarOfSelection();

            expect(mockUpdateForSelection).toHaveBeenCalled();
        });
    });

    describe('group layer selection', () => {
        let groupLayers;

        beforeEach(() => {
            // Create a set of layers with group structure
            groupLayers = [
                {
                    id: 'group1',
                    type: 'group',
                    name: 'My Group',
                    children: ['child1', 'child2'],
                    visible: true,
                    locked: false
                },
                {
                    id: 'child1',
                    type: 'rectangle',
                    x: 10,
                    y: 20,
                    width: 50,
                    height: 30,
                    parentGroup: 'group1',
                    visible: true,
                    locked: false
                },
                {
                    id: 'child2',
                    type: 'circle',
                    x: 100,
                    y: 50,
                    radius: 25,
                    parentGroup: 'group1',
                    visible: true,
                    locked: false
                },
                {
                    id: 'standalone',
                    type: 'rectangle',
                    x: 200,
                    y: 200,
                    width: 40,
                    height: 40,
                    visible: true,
                    locked: false
                }
            ];

            mockCanvasManager.layers = groupLayers;
            selectionManager = new SelectionManager(mockCanvasManager);
        });

        test('should select group and all children when selecting a group layer', () => {
            selectionManager.selectLayer('group1', false);

            expect(selectionManager.selectedLayerIds).toContain('group1');
            expect(selectionManager.selectedLayerIds).toContain('child1');
            expect(selectionManager.selectedLayerIds).toContain('child2');
            expect(selectionManager.selectedLayerIds.length).toBe(3);
        });

        test('should deselect group and all children when deselecting a group layer', () => {
            selectionManager.selectLayer('group1', false);
            expect(selectionManager.selectedLayerIds.length).toBe(3);

            selectionManager.deselectLayer('group1');

            expect(selectionManager.selectedLayerIds).not.toContain('group1');
            expect(selectionManager.selectedLayerIds).not.toContain('child1');
            expect(selectionManager.selectedLayerIds).not.toContain('child2');
            expect(selectionManager.selectedLayerIds.length).toBe(0);
        });

        test('should toggle deselect group and children with addToSelection', () => {
            selectionManager.selectLayer('group1', false);
            expect(selectionManager.selectedLayerIds.length).toBe(3);

            // Toggle deselect with addToSelection=true
            selectionManager.selectLayer('group1', true);

            expect(selectionManager.selectedLayerIds.length).toBe(0);
        });

        test('should only select individual layer when not a group', () => {
            selectionManager.selectLayer('child1', false);

            expect(selectionManager.selectedLayerIds).toEqual(['child1']);
        });

        test('should handle nested groups correctly', () => {
            // Create a nested group structure
            const nestedGroupLayers = [
                {
                    id: 'outerGroup',
                    type: 'group',
                    children: ['innerGroup', 'outerChild'],
                    visible: true,
                    locked: false
                },
                {
                    id: 'innerGroup',
                    type: 'group',
                    children: ['innerChild1', 'innerChild2'],
                    parentGroup: 'outerGroup',
                    visible: true,
                    locked: false
                },
                {
                    id: 'outerChild',
                    type: 'rectangle',
                    x: 10,
                    y: 10,
                    width: 50,
                    height: 50,
                    parentGroup: 'outerGroup',
                    visible: true,
                    locked: false
                },
                {
                    id: 'innerChild1',
                    type: 'circle',
                    x: 100,
                    y: 100,
                    radius: 20,
                    parentGroup: 'innerGroup',
                    visible: true,
                    locked: false
                },
                {
                    id: 'innerChild2',
                    type: 'rectangle',
                    x: 150,
                    y: 150,
                    width: 30,
                    height: 30,
                    parentGroup: 'innerGroup',
                    visible: true,
                    locked: false
                }
            ];

            mockCanvasManager.layers = nestedGroupLayers;
            selectionManager = new SelectionManager(mockCanvasManager);

            selectionManager.selectLayer('outerGroup', false);

            // Should select outer group, inner group, and all children
            expect(selectionManager.selectedLayerIds).toContain('outerGroup');
            expect(selectionManager.selectedLayerIds).toContain('innerGroup');
            expect(selectionManager.selectedLayerIds).toContain('outerChild');
            expect(selectionManager.selectedLayerIds).toContain('innerChild1');
            expect(selectionManager.selectedLayerIds).toContain('innerChild2');
            expect(selectionManager.selectedLayerIds.length).toBe(5);
        });

        test('should use GroupManager when available', () => {
            const mockGroupManager = {
                getGroupChildren: jest.fn().mockReturnValue(['child1', 'child2']),
                getGroupBounds: jest.fn().mockReturnValue({ x: 10, y: 20, width: 130, height: 100 })
            };
            mockCanvasManager.editor = {
                groupManager: mockGroupManager
            };
            selectionManager = new SelectionManager(mockCanvasManager);

            selectionManager.selectLayer('group1', false);

            expect(mockGroupManager.getGroupChildren).toHaveBeenCalledWith('group1', true);
            expect(selectionManager.selectedLayerIds).toContain('group1');
            expect(selectionManager.selectedLayerIds).toContain('child1');
            expect(selectionManager.selectedLayerIds).toContain('child2');
        });
    });

    describe('group bounds calculation', () => {
        let groupLayers;

        beforeEach(() => {
            groupLayers = [
                {
                    id: 'group1',
                    type: 'group',
                    children: ['child1', 'child2'],
                    visible: true,
                    locked: false
                },
                {
                    id: 'child1',
                    type: 'rectangle',
                    x: 10,
                    y: 20,
                    width: 50,
                    height: 30,
                    parentGroup: 'group1',
                    visible: true,
                    locked: false
                },
                {
                    id: 'child2',
                    type: 'rectangle',
                    x: 100,
                    y: 80,
                    width: 40,
                    height: 40,
                    parentGroup: 'group1',
                    visible: true,
                    locked: false
                }
            ];

            mockCanvasManager.layers = groupLayers;
            selectionManager = new SelectionManager(mockCanvasManager);
        });

        test('should calculate bounds for group based on children', () => {
            const bounds = selectionManager._getGroupBounds(groupLayers[0]);

            // child1: x:10, y:20, w:50, h:30 -> max x:60, y:50
            // child2: x:100, y:80, w:40, h:40 -> max x:140, y:120
            expect(bounds.x).toBe(10);
            expect(bounds.y).toBe(20);
            expect(bounds.width).toBe(130); // 140 - 10
            expect(bounds.height).toBe(100); // 120 - 20
        });

        test('should return null for non-group layer', () => {
            const bounds = selectionManager._getGroupBounds(groupLayers[1]);
            expect(bounds).toBeNull();
        });

        test('should return null for group with no children', () => {
            const emptyGroup = {
                id: 'emptyGroup',
                type: 'group',
                children: []
            };
            mockCanvasManager.layers.push(emptyGroup);

            const bounds = selectionManager._getGroupBounds(emptyGroup);
            expect(bounds).toBeNull();
        });

        test('should use GroupManager.getGroupBounds when available', () => {
            const mockGroupManager = {
                getGroupBounds: jest.fn().mockReturnValue({ x: 5, y: 10, width: 150, height: 120 }),
                getGroupChildren: jest.fn().mockReturnValue(['child1', 'child2'])
            };
            mockCanvasManager.editor = {
                groupManager: mockGroupManager
            };
            selectionManager = new SelectionManager(mockCanvasManager);

            const bounds = selectionManager._getGroupBounds(groupLayers[0]);

            expect(mockGroupManager.getGroupBounds).toHaveBeenCalledWith('group1');
            expect(bounds).toEqual({ x: 5, y: 10, width: 150, height: 120 });
        });

        test('should include group bounds in getMultiSelectionBounds', () => {
            selectionManager.selectLayer('group1', false);

            const bounds = selectionManager.getMultiSelectionBounds();

            // Group bounds should be calculated from children
            expect(bounds.x).toBe(10);
            expect(bounds.y).toBe(20);
            expect(bounds.width).toBe(130);
            expect(bounds.height).toBe(100);
        });
    });

    describe('isChildOfSelectedGroup', () => {
        let groupLayers;

        beforeEach(() => {
            groupLayers = [
                {
                    id: 'group1',
                    type: 'group',
                    children: ['child1'],
                    visible: true,
                    locked: false
                },
                {
                    id: 'child1',
                    type: 'rectangle',
                    x: 10,
                    y: 20,
                    width: 50,
                    height: 30,
                    parentGroup: 'group1',
                    visible: true,
                    locked: false
                },
                {
                    id: 'standalone',
                    type: 'rectangle',
                    x: 200,
                    y: 200,
                    width: 40,
                    height: 40,
                    visible: true,
                    locked: false
                }
            ];

            mockCanvasManager.layers = groupLayers;
            selectionManager = new SelectionManager(mockCanvasManager);
        });

        test('should return true when parent group is selected', () => {
            selectionManager.selectLayer('group1', false);

            expect(selectionManager.isChildOfSelectedGroup('child1')).toBe(true);
        });

        test('should return false when layer has no parent', () => {
            selectionManager.selectLayer('standalone', false);

            expect(selectionManager.isChildOfSelectedGroup('standalone')).toBe(false);
        });

        test('should return false when parent group is not selected', () => {
            selectionManager.selectLayer('standalone', false);

            expect(selectionManager.isChildOfSelectedGroup('child1')).toBe(false);
        });

        test('should handle nested groups - detect ancestor selection', () => {
            const nestedLayers = [
                {
                    id: 'outerGroup',
                    type: 'group',
                    children: ['innerGroup'],
                    visible: true,
                    locked: false
                },
                {
                    id: 'innerGroup',
                    type: 'group',
                    children: ['deepChild'],
                    parentGroup: 'outerGroup',
                    visible: true,
                    locked: false
                },
                {
                    id: 'deepChild',
                    type: 'rectangle',
                    x: 10,
                    y: 10,
                    width: 50,
                    height: 50,
                    parentGroup: 'innerGroup',
                    visible: true,
                    locked: false
                }
            ];

            mockCanvasManager.layers = nestedLayers;
            selectionManager = new SelectionManager(mockCanvasManager);
            selectionManager.selectLayer('outerGroup', false);

            expect(selectionManager.isChildOfSelectedGroup('deepChild')).toBe(true);
        });
    });

    describe('_getGroupDescendantIds', () => {
        test('should return empty array for non-group layer', () => {
            mockCanvasManager.layers = [
                { id: 'rect1', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 }
            ];
            selectionManager = new SelectionManager(mockCanvasManager);

            const ids = selectionManager._getGroupDescendantIds('rect1');
            expect(ids).toEqual([]);
        });

        test('should return empty array when group has no children', () => {
            mockCanvasManager.layers = [
                { id: 'group1', type: 'group', children: [] }
            ];
            selectionManager = new SelectionManager(mockCanvasManager);

            const ids = selectionManager._getGroupDescendantIds('group1');
            expect(ids).toEqual([]);
        });

        test('should return children for simple group', () => {
            mockCanvasManager.layers = [
                { id: 'group1', type: 'group', children: ['child1', 'child2'] },
                { id: 'child1', type: 'rectangle' },
                { id: 'child2', type: 'circle' }
            ];
            selectionManager = new SelectionManager(mockCanvasManager);

            const ids = selectionManager._getGroupDescendantIds('group1');
            expect(ids).toContain('child1');
            expect(ids).toContain('child2');
            expect(ids.length).toBe(2);
        });

        test('should recursively get nested group children', () => {
            mockCanvasManager.layers = [
                { id: 'group1', type: 'group', children: ['nested', 'child1'] },
                { id: 'nested', type: 'group', children: ['nestedChild'] },
                { id: 'child1', type: 'rectangle' },
                { id: 'nestedChild', type: 'circle' }
            ];
            selectionManager = new SelectionManager(mockCanvasManager);

            const ids = selectionManager._getGroupDescendantIds('group1');
            expect(ids).toContain('nested');
            expect(ids).toContain('child1');
            expect(ids).toContain('nestedChild');
            expect(ids.length).toBe(3);
        });

        test('should use GroupManager when available', () => {
            const mockGroupManager = {
                getGroupChildren: jest.fn().mockReturnValue(['child1', 'child2'])
            };
            mockCanvasManager.layers = [
                { id: 'group1', type: 'group', children: ['child1', 'child2'] }
            ];
            mockCanvasManager.editor = {
                groupManager: mockGroupManager
            };
            selectionManager = new SelectionManager(mockCanvasManager);

            const ids = selectionManager._getGroupDescendantIds('group1');

            expect(mockGroupManager.getGroupChildren).toHaveBeenCalledWith('group1', true);
            expect(ids).toEqual(['child1', 'child2']);
        });
    });
});
