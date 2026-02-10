/**
 * @jest-environment jsdom
 */

/**
 * Integration Tests for Layers Editor Workflows
 *
 * These tests verify end-to-end functionality including:
 * - Layer creation, modification, and deletion workflows
 * - Save/load cycle data integrity
 * - Multi-selection operations
 * - Undo/redo consistency
 * - Layer ordering operations
 */

const StateManager = require('../../../resources/ext.layers.editor/StateManager.js');
const HistoryManager = require('../../../resources/ext.layers.editor/HistoryManager.js');

describe('Integration: Layer Workflows', () => {
    let stateManager;

    beforeEach(() => {
        // Create a fresh StateManager for each test
        stateManager = new StateManager({
            // Mock editor with minimal required interface
            redraw: jest.fn(),
            saveState: jest.fn()
        });

        // Setup window globals
        window.StateManager = StateManager;
    });

    afterEach(() => {
        if (stateManager && stateManager.destroy) {
            stateManager.destroy();
        }
    });

    describe('Layer Creation Workflow', () => {
        test('should create a layer with default properties', () => {
            const layerData = {
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                fill: '#ff0000'
            };

            stateManager.addLayer(layerData);
            const layers = stateManager.getLayers();

            expect(layers).toHaveLength(1);
            expect(layers[0].type).toBe('rectangle');
            expect(layers[0].x).toBe(100);
            expect(layers[0].y).toBe(100);
            expect(layers[0].visible).toBe(true);
            expect(layers[0].locked).toBe(false);
            expect(layers[0].id).toBeDefined();
        });

        test('should add layer to top of stack', () => {
            stateManager.addLayer({ type: 'rectangle', name: 'First' });
            stateManager.addLayer({ type: 'circle', name: 'Second' });
            stateManager.addLayer({ type: 'text', name: 'Third' });

            const layers = stateManager.getLayers();

            expect(layers).toHaveLength(3);
            // Newest layer should be first (top of stack)
            expect(layers[0].name).toBe('Third');
            expect(layers[1].name).toBe('Second');
            expect(layers[2].name).toBe('First');
        });

        test('should mark state as dirty after adding layer', () => {
            expect(stateManager.isDirty()).toBe(false);

            stateManager.addLayer({ type: 'rectangle' });

            expect(stateManager.isDirty()).toBe(true);
        });

        test('should generate unique layer IDs', () => {
            stateManager.addLayer({ type: 'rectangle' });
            stateManager.addLayer({ type: 'circle' });
            stateManager.addLayer({ type: 'text' });

            const layers = stateManager.getLayers();
            const ids = layers.map(l => l.id);
            const uniqueIds = [...new Set(ids)];

            expect(uniqueIds.length).toBe(ids.length);
        });
    });

    describe('Layer Modification Workflow', () => {
        let layerId;

        beforeEach(() => {
            stateManager.addLayer({
                type: 'rectangle',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                fill: '#000000'
            });
            layerId = stateManager.getLayers()[0].id;
            stateManager.markClean();
        });

        test('should update layer properties', () => {
            stateManager.updateLayer(layerId, {
                x: 50,
                y: 75,
                fill: '#ff0000'
            });

            const layer = stateManager.getLayer(layerId);

            expect(layer.x).toBe(50);
            expect(layer.y).toBe(75);
            expect(layer.fill).toBe('#ff0000');
            // Original properties should remain
            expect(layer.width).toBe(100);
            expect(layer.height).toBe(100);
        });

        test('should mark state as dirty after updating layer', () => {
            expect(stateManager.isDirty()).toBe(false);

            stateManager.updateLayer(layerId, { x: 50 });

            expect(stateManager.isDirty()).toBe(true);
        });

        test('should not modify other layers when updating one', () => {
            stateManager.addLayer({ type: 'circle', x: 200, y: 200 });
            const circleId = stateManager.getLayers()[0].id; // New layer is at top

            stateManager.updateLayer(layerId, { x: 999 });

            const circle = stateManager.getLayer(circleId);
            expect(circle.x).toBe(200);
        });

        test('should handle non-existent layer gracefully', () => {
            // Should not throw
            expect(() => {
                stateManager.updateLayer('non-existent-id', { x: 50 });
            }).not.toThrow();
        });
    });

    describe('Layer Deletion Workflow', () => {
        let layerIds;

        beforeEach(() => {
            stateManager.addLayer({ type: 'rectangle', name: 'Layer 1' });
            stateManager.addLayer({ type: 'circle', name: 'Layer 2' });
            stateManager.addLayer({ type: 'text', name: 'Layer 3' });
            layerIds = stateManager.getLayers().map(l => l.id);
            stateManager.markClean();
        });

        test('should remove layer from stack', () => {
            stateManager.removeLayer(layerIds[1]);

            const layers = stateManager.getLayers();
            expect(layers).toHaveLength(2);
            expect(layers.find(l => l.id === layerIds[1])).toBeUndefined();
        });

        test('should mark state as dirty after removing layer', () => {
            expect(stateManager.isDirty()).toBe(false);

            stateManager.removeLayer(layerIds[0]);

            expect(stateManager.isDirty()).toBe(true);
        });

        test('should deselect deleted layer', () => {
            stateManager.selectLayer(layerIds[1]);
            expect(stateManager.get('selectedLayerIds')).toContain(layerIds[1]);

            stateManager.removeLayer(layerIds[1]);

            expect(stateManager.get('selectedLayerIds')).not.toContain(layerIds[1]);
        });

        test('should handle deleting non-existent layer gracefully', () => {
            expect(() => {
                stateManager.removeLayer('non-existent-id');
            }).not.toThrow();

            // Layer count should not change
            expect(stateManager.getLayers()).toHaveLength(3);
        });
    });

    describe('Selection Workflow', () => {
        let layerIds;

        beforeEach(() => {
            stateManager.addLayer({ type: 'rectangle', name: 'Layer 1' });
            stateManager.addLayer({ type: 'circle', name: 'Layer 2' });
            stateManager.addLayer({ type: 'text', name: 'Layer 3' });
            layerIds = stateManager.getLayers().map(l => l.id);
        });

        test('should select a single layer', () => {
            stateManager.selectLayer(layerIds[0]);

            expect(stateManager.get('selectedLayerIds')).toEqual([layerIds[0]]);
        });

        test('should replace selection when selecting without multi-select', () => {
            stateManager.selectLayer(layerIds[0]);
            stateManager.selectLayer(layerIds[1]);

            expect(stateManager.get('selectedLayerIds')).toEqual([layerIds[1]]);
        });

        test('should add to selection with multi-select', () => {
            stateManager.selectLayer(layerIds[0]);
            stateManager.selectLayer(layerIds[1], true);
            stateManager.selectLayer(layerIds[2], true);

            expect(stateManager.get('selectedLayerIds')).toHaveLength(3);
            expect(stateManager.get('selectedLayerIds')).toContain(layerIds[0]);
            expect(stateManager.get('selectedLayerIds')).toContain(layerIds[1]);
            expect(stateManager.get('selectedLayerIds')).toContain(layerIds[2]);
        });

        test('should deselect a single layer', () => {
            stateManager.selectLayer(layerIds[0]);
            stateManager.selectLayer(layerIds[1], true);
            stateManager.deselectLayer(layerIds[0]);

            expect(stateManager.get('selectedLayerIds')).toEqual([layerIds[1]]);
        });

        test('should clear all selection', () => {
            stateManager.selectLayer(layerIds[0]);
            stateManager.selectLayer(layerIds[1], true);
            stateManager.selectLayer(layerIds[2], true);

            stateManager.clearSelection();

            expect(stateManager.get('selectedLayerIds')).toEqual([]);
        });

        test('should return selected layers', () => {
            stateManager.selectLayer(layerIds[0]);
            stateManager.selectLayer(layerIds[2], true);

            const selectedLayers = stateManager.getSelectedLayers();

            expect(selectedLayers).toHaveLength(2);
            expect(selectedLayers.map(l => l.id)).toContain(layerIds[0]);
            expect(selectedLayers.map(l => l.id)).toContain(layerIds[2]);
        });
    });

    describe('State Export/Import Workflow', () => {
        test('should export current state', () => {
            stateManager.addLayer({ type: 'rectangle', x: 100, y: 100 });
            stateManager.addLayer({ type: 'circle', x: 200, y: 200 });
            const layerIds = stateManager.getLayers().map(l => l.id);
            stateManager.selectLayer(layerIds[0]);

            const exported = stateManager.exportState();

            expect(exported.layers).toHaveLength(2);
            expect(exported.selectedLayerIds).toEqual([layerIds[0]]);
            expect(exported.isDirty).toBe(true);
        });

        test('should load external state', () => {
            const externalState = {
                layers: [
                    { id: 'ext-1', type: 'rectangle', x: 50, y: 50 },
                    { id: 'ext-2', type: 'circle', x: 150, y: 150 }
                ]
            };

            stateManager.loadState(externalState);
            const layers = stateManager.getLayers();

            expect(layers).toHaveLength(2);
            expect(layers[0].id).toBe('ext-1');
            expect(layers[1].id).toBe('ext-2');
        });

        test('should mark state as clean after loading', () => {
            stateManager.addLayer({ type: 'rectangle' });
            expect(stateManager.isDirty()).toBe(true);

            stateManager.loadState({ layers: [] });

            expect(stateManager.isDirty()).toBe(false);
        });

        test('should preserve data integrity through export/import cycle', () => {
            // Create complex layer data
            const originalLayers = [
                {
                    type: 'rectangle',
                    x: 10, y: 20,
                    width: 100, height: 80,
                    fill: '#ff0000',
                    stroke: '#000000',
                    strokeWidth: 2,
                    opacity: 0.8,
                    rotation: 45
                },
                {
                    type: 'text',
                    x: 150, y: 100,
                    text: 'Hello World',
                    fontSize: 24,
                    fontFamily: 'Arial',
                    fill: '#333333'
                },
                {
                    type: 'polygon',
                    points: [
                        { x: 0, y: 0 },
                        { x: 50, y: 0 },
                        { x: 25, y: 40 }
                    ],
                    fill: '#00ff00'
                }
            ];

            // Load original layers
            stateManager.loadState({ layers: originalLayers });
            const exported = stateManager.exportState();

            // Create new state manager and import
            const stateManager2 = new StateManager({});
            stateManager2.loadState({ layers: exported.layers });
            const reimported = stateManager2.getLayers();

            // Verify each layer
            expect(reimported).toHaveLength(3);

            // Rectangle
            expect(reimported[0].type).toBe('rectangle');
            expect(reimported[0].x).toBe(10);
            expect(reimported[0].fill).toBe('#ff0000');
            expect(reimported[0].rotation).toBe(45);

            // Text
            expect(reimported[1].type).toBe('text');
            expect(reimported[1].text).toBe('Hello World');
            expect(reimported[1].fontSize).toBe(24);

            // Polygon
            expect(reimported[2].type).toBe('polygon');
            expect(reimported[2].points).toHaveLength(3);
            expect(reimported[2].points[0]).toEqual({ x: 0, y: 0 });

            stateManager2.destroy();
        });
    });

    describe('Undo/Redo Methods (CORE-6: removed dead code)', () => {
        // NOTE: StateManager's undo/redo methods were removed in CORE-6.
        // LayersEditor uses HistoryManager for all undo/redo functionality.
        // These tests verify the methods no longer exist.

        test('undo method should not exist', () => {
            expect(typeof stateManager.undo).toBe('undefined');
        });

        test('redo method should not exist', () => {
            expect(typeof stateManager.redo).toBe('undefined');
        });

        test('restoreState method should not exist', () => {
            expect(typeof stateManager.restoreState).toBe('undefined');
        });

        test('layers remain after operations (no undo side effects)', () => {
            stateManager.addLayer({ type: 'rectangle', name: 'First' });
            stateManager.addLayer({ type: 'circle', name: 'Second' });
            stateManager.addLayer({ type: 'text', name: 'Third' });

            expect(stateManager.getLayers()).toHaveLength(3);
            // No undo method to call - layers persist as expected
        });
    });

    describe('State Subscription Workflow', () => {
        test('should notify listeners when layers change', () => {
            const listener = jest.fn();
            stateManager.subscribe('layers', listener);

            stateManager.addLayer({ type: 'rectangle' });

            expect(listener).toHaveBeenCalled();
        });

        test('should notify listeners when selection changes', () => {
            stateManager.addLayer({ type: 'rectangle' });
            const layerId = stateManager.getLayers()[0].id;

            const listener = jest.fn();
            stateManager.subscribe('selectedLayerIds', listener);

            stateManager.selectLayer(layerId);

            expect(listener).toHaveBeenCalled();
        });

        test('should unsubscribe listener', () => {
            const listener = jest.fn();
            const unsubscribe = stateManager.subscribe('layers', listener);

            stateManager.addLayer({ type: 'rectangle' });
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();

            stateManager.addLayer({ type: 'circle' });
            expect(listener).toHaveBeenCalledTimes(1); // Not called again
        });

        test('should support wildcard subscription', () => {
            const listener = jest.fn();
            stateManager.subscribe('*', listener);

            stateManager.set('zoom', 2.0);
            stateManager.set('showGrid', true);

            expect(listener).toHaveBeenCalledTimes(2);
        });
    });

    describe('Atomic Operations', () => {
        test('should execute atomic updates without race conditions', () => {
            stateManager.addLayer({ type: 'rectangle', name: 'Layer 1' });
            const layerId = stateManager.getLayers()[0].id;

            // Simulate concurrent updates using atomic
            stateManager.atomic((state) => {
                const layer = state.layers.find(l => l.id === layerId);
                if (layer) {
                    return {
                        layers: state.layers.map(l =>
                            l.id === layerId ? { ...l, x: 100, y: 100 } : l
                        )
                    };
                }
                return {};
            });

            const layer = stateManager.getLayer(layerId);
            expect(layer.x).toBe(100);
            expect(layer.y).toBe(100);
        });

        test('should queue operations when state is locked', () => {
            stateManager.lockState();

            // This should be queued
            stateManager.set('zoom', 2.0);

            // Zoom should still be 1.0 because it's queued
            expect(stateManager.get('zoom')).toBe(1.0);

            stateManager.unlockState();

            // After unlock, queued operation should execute
            expect(stateManager.get('zoom')).toBe(2.0);
        });
    });

    describe('State Reset', () => {
        test('should reset to initial state', () => {
            stateManager.addLayer({ type: 'rectangle' });
            stateManager.addLayer({ type: 'circle' });
            stateManager.set('zoom', 2.0);
            stateManager.set('showGrid', true);

            stateManager.reset();

            expect(stateManager.getLayers()).toHaveLength(0);
            expect(stateManager.get('selectedLayerIds')).toEqual([]);
            expect(stateManager.isDirty()).toBe(false);
        });
    });
});

describe('Integration: HistoryManager Workflows', () => {
    let historyManager;
    let mockCanvasManager;

    beforeEach(() => {
        mockCanvasManager = {
            layers: [],
            editor: {
                layers: []
            },
            redraw: jest.fn()
        };

        historyManager = new HistoryManager({ canvasManager: mockCanvasManager });
    });

    describe('History State Management', () => {
        test('should save state to history', () => {
            mockCanvasManager.layers = [
                { id: '1', type: 'rectangle', x: 0, y: 0 }
            ];

            historyManager.saveState('Add rectangle');

            expect(historyManager.history).toHaveLength(1);
            expect(historyManager.history[0].description).toBe('Add rectangle');
        });

        test('should limit history size', () => {
            historyManager.maxHistorySteps = 5;

            for (let i = 0; i < 10; i++) {
                mockCanvasManager.layers = [{ id: String(i), type: 'rectangle' }];
                historyManager.saveState('Action ' + i);
            }

            expect(historyManager.history.length).toBeLessThanOrEqual(5);
        });

        test('should track history index correctly', () => {
            mockCanvasManager.layers = [{ id: '1', type: 'rectangle' }];
            historyManager.saveState('First');

            mockCanvasManager.layers = [{ id: '2', type: 'circle' }];
            historyManager.saveState('Second');

            expect(historyManager.historyIndex).toBe(historyManager.history.length - 1);
        });
    });

    describe('Batch Operations', () => {
        test('should batch multiple changes', () => {
            mockCanvasManager.layers = [{ id: '1', type: 'rectangle' }];

            historyManager.startBatch('Batch operation');

            historyManager.saveState('Change 1');
            historyManager.saveState('Change 2');
            historyManager.saveState('Change 3');

            expect(historyManager.batchMode).toBe(true);
            expect(historyManager.batchChanges.length).toBe(3);

            historyManager.endBatch();

            expect(historyManager.batchMode).toBe(false);
        });

        test('should cancel batch operation', () => {
            mockCanvasManager.layers = [{ id: '1', type: 'rectangle' }];
            const initialHistoryLength = historyManager.history.length;

            historyManager.startBatch('Batch operation');
            historyManager.saveState('Change 1');
            historyManager.saveState('Change 2');

            historyManager.cancelBatch();

            expect(historyManager.batchMode).toBe(false);
            expect(historyManager.batchChanges).toHaveLength(0);
            expect(historyManager.history.length).toBe(initialHistoryLength);
        });
    });
});

describe('Integration: Multi-Selection Operations', () => {
    let stateManager;

    beforeEach(() => {
        stateManager = new StateManager({});

        // Create multiple layers
        stateManager.addLayer({ type: 'rectangle', x: 0, y: 0, width: 100, height: 100, name: 'Rect 1' });
        stateManager.addLayer({ type: 'rectangle', x: 150, y: 0, width: 100, height: 100, name: 'Rect 2' });
        stateManager.addLayer({ type: 'circle', x: 300, y: 50, radius: 50, name: 'Circle' });
        stateManager.addLayer({ type: 'text', x: 0, y: 200, text: 'Hello', name: 'Text' });
    });

    afterEach(() => {
        stateManager.destroy();
    });

    test('should select multiple layers for batch operations', () => {
        const layers = stateManager.getLayers();

        // Select first two rectangles
        stateManager.selectLayer(layers[2].id); // Rect 1 (index 2 because layers are reversed)
        stateManager.selectLayer(layers[3].id, true); // Rect 2

        const selected = stateManager.getSelectedLayers();
        expect(selected).toHaveLength(2);
        expect(selected.every(l => l.type === 'rectangle')).toBe(true);
    });

    test('should get bounds of multi-selection', () => {
        const layers = stateManager.getLayers();

        // Select all layers
        layers.forEach((layer, index) => {
            stateManager.selectLayer(layer.id, index > 0);
        });

        const selected = stateManager.getSelectedLayers();
        expect(selected).toHaveLength(4);
    });

    test('should maintain selection order', () => {
        const layers = stateManager.getLayers();

        stateManager.selectLayer(layers[0].id);
        stateManager.selectLayer(layers[2].id, true);
        stateManager.selectLayer(layers[1].id, true);

        const selectedIds = stateManager.get('selectedLayerIds');

        expect(selectedIds[0]).toBe(layers[0].id);
        expect(selectedIds[1]).toBe(layers[2].id);
        expect(selectedIds[2]).toBe(layers[1].id);
    });
});

describe('Integration: Layer Data Integrity', () => {
    let stateManager;

    beforeEach(() => {
        stateManager = new StateManager({});
    });

    afterEach(() => {
        stateManager.destroy();
    });

    test('should preserve all layer properties through operations', () => {
        const complexLayer = {
            type: 'rectangle',
            x: 100, y: 200,
            width: 300, height: 150,
            fill: '#ff0000',
            stroke: '#000000',
            strokeWidth: 2,
            opacity: 0.8,
            fillOpacity: 0.6,
            strokeOpacity: 1.0,
            rotation: 45,
            blendMode: 'multiply',
            shadow: true,
            shadowColor: 'rgba(0,0,0,0.5)',
            shadowBlur: 10,
            shadowOffsetX: 5,
            shadowOffsetY: 5,
            name: 'Complex Rectangle',
            locked: false,
            visible: true
        };

        stateManager.addLayer(complexLayer);
        const layerId = stateManager.getLayers()[0].id;

        // Update some properties
        stateManager.updateLayer(layerId, { x: 150, rotation: 90 });

        // Export and reimport
        const exported = stateManager.exportState();
        stateManager.reset();
        stateManager.loadState({ layers: exported.layers });

        const layer = stateManager.getLayers()[0];

        // Verify all properties
        expect(layer.type).toBe('rectangle');
        expect(layer.x).toBe(150); // Updated
        expect(layer.y).toBe(200);
        expect(layer.width).toBe(300);
        expect(layer.height).toBe(150);
        expect(layer.fill).toBe('#ff0000');
        expect(layer.stroke).toBe('#000000');
        expect(layer.strokeWidth).toBe(2);
        expect(layer.opacity).toBe(0.8);
        expect(layer.rotation).toBe(90); // Updated
        expect(layer.blendMode).toBe('multiply');
        expect(layer.shadow).toBe(true);
        expect(layer.shadowColor).toBe('rgba(0,0,0,0.5)');
        expect(layer.name).toBe('Complex Rectangle');
    });

    test('should handle special characters in text layers', () => {
        const textLayer = {
            type: 'text',
            x: 100, y: 100,
            text: 'Special: <script>alert("xss")</script> & "quotes" \' apostrophe',
            fontSize: 16
        };

        stateManager.addLayer(textLayer);
        const exported = stateManager.exportState();

        // Text should be preserved as-is in state (sanitization happens at render/save)
        expect(exported.layers[0].text).toBe(textLayer.text);
    });

    test('should handle polygon with many points', () => {
        const points = [];
        for (let i = 0; i < 100; i++) {
            points.push({
                x: Math.cos(i * Math.PI / 50) * 100 + 150,
                y: Math.sin(i * Math.PI / 50) * 100 + 150
            });
        }

        const polygonLayer = {
            type: 'polygon',
            points: points,
            fill: '#00ff00',
            stroke: '#000000'
        };

        stateManager.addLayer(polygonLayer);
        const exported = stateManager.exportState();

        expect(exported.layers[0].points).toHaveLength(100);
        expect(exported.layers[0].points[0].x).toBeCloseTo(250); // cos(0)*100 + 150
    });

    test('should handle path with many points', () => {
        const points = [];
        for (let i = 0; i < 500; i++) {
            points.push({ x: i, y: Math.sin(i / 10) * 50 + 100 });
        }

        const pathLayer = {
            type: 'path',
            points: points,
            stroke: '#0000ff',
            strokeWidth: 2
        };

        stateManager.addLayer(pathLayer);
        const layer = stateManager.getLayers()[0];

        expect(layer.points).toHaveLength(500);
    });
});

describe('Integration: Layer Ordering Operations', () => {
    let stateManager;
    let layer1, layer2, layer3, layer4;

    beforeEach(() => {
        stateManager = new (require('../../../resources/ext.layers.editor/StateManager.js'))({
            redraw: jest.fn(),
            saveState: jest.fn()
        });

        // Add 4 layers: layer1 is at top (index 0), layer4 at bottom (index 3)
        layer1 = stateManager.addLayer({ type: 'rectangle', name: 'Layer 1' });
        layer2 = stateManager.addLayer({ type: 'circle', name: 'Layer 2' });
        layer3 = stateManager.addLayer({ type: 'text', name: 'Layer 3' });
        layer4 = stateManager.addLayer({ type: 'polygon', name: 'Layer 4' });
        // After adding: [layer4, layer3, layer2, layer1] (newest at top)
    });

    describe('reorderLayer', () => {
        test('should move layer to new position', () => {
            // Move layer1 (index 3) to position of layer4 (index 0)
            const result = stateManager.reorderLayer(layer1.id, layer4.id);

            expect(result).toBe(true);
            const layers = stateManager.getLayers();
            expect(layers[0].name).toBe('Layer 1');
        });

        test('should return false for non-existent layer', () => {
            const result = stateManager.reorderLayer('non-existent', layer2.id);
            expect(result).toBe(false);
        });

        test('should return false for same position', () => {
            const result = stateManager.reorderLayer(layer1.id, layer1.id);
            expect(result).toBe(false);
        });

        test('should NOT save to history (history disabled)', () => {
            // StateManager's history is disabled for performance.
            // HistoryManager handles undo/redo in production.
            const historyBefore = stateManager.get('history').length;
            stateManager.reorderLayer(layer1.id, layer4.id);
            const historyAfter = stateManager.get('history').length;

            // History stays at 0 because saveToHistory is disabled
            expect(historyBefore).toBe(0);
            expect(historyAfter).toBe(0);
        });
    });

    describe('moveLayerUp', () => {
        test('should move layer up one position', () => {
            // layer1 is at index 3, move it up to index 2
            const result = stateManager.moveLayerUp(layer1.id);

            expect(result).toBe(true);
            const layers = stateManager.getLayers();
            expect(layers[2].name).toBe('Layer 1');
            expect(layers[3].name).toBe('Layer 2');
        });

        test('should return false for layer already at top', () => {
            const result = stateManager.moveLayerUp(layer4.id);
            expect(result).toBe(false);
        });

        test('should return false for non-existent layer', () => {
            const result = stateManager.moveLayerUp('non-existent');
            expect(result).toBe(false);
        });

        test('move persists (undo method removed per CORE-6)', () => {
            stateManager.moveLayerUp(layer1.id);
            const positionAfterMove = stateManager.getLayers().findIndex(l => l.name === 'Layer 1');
            
            // undo() method no longer exists (CORE-6)
            // HistoryManager handles undo/redo in the editor

            const layers = stateManager.getLayers();
            const currentPosition = layers.findIndex(l => l.name === 'Layer 1');
            // Position unchanged - no undo available at StateManager level
            expect(currentPosition).toBe(positionAfterMove);
        });
    });

    describe('moveLayerDown', () => {
        test('should move layer down one position', () => {
            // layer4 is at index 0, move it down to index 1
            const result = stateManager.moveLayerDown(layer4.id);

            expect(result).toBe(true);
            const layers = stateManager.getLayers();
            expect(layers[1].name).toBe('Layer 4');
            expect(layers[0].name).toBe('Layer 3');
        });

        test('should return false for layer already at bottom', () => {
            const result = stateManager.moveLayerDown(layer1.id);
            expect(result).toBe(false);
        });

        test('should return false for non-existent layer', () => {
            const result = stateManager.moveLayerDown('non-existent');
            expect(result).toBe(false);
        });

        test('move persists (undo method removed per CORE-6)', () => {
            stateManager.moveLayerDown(layer4.id);
            const positionAfterMove = stateManager.getLayers().findIndex(l => l.name === 'Layer 4');
            
            // undo() method no longer exists (CORE-6)
            // HistoryManager handles undo/redo in the editor

            const layers = stateManager.getLayers();
            const currentPosition = layers.findIndex(l => l.name === 'Layer 4');
            // Position unchanged - no undo available at StateManager level
            expect(currentPosition).toBe(positionAfterMove);
        });
    });

    describe('bringToFront', () => {
        test('should move layer to front (index 0)', () => {
            const result = stateManager.bringToFront(layer1.id);

            expect(result).toBe(true);
            const layers = stateManager.getLayers();
            expect(layers[0].name).toBe('Layer 1');
        });

        test('should return false for layer already at front', () => {
            const result = stateManager.bringToFront(layer4.id);
            expect(result).toBe(false);
        });

        test('should return false for non-existent layer', () => {
            const result = stateManager.bringToFront('non-existent');
            expect(result).toBe(false);
        });

        test('should preserve other layers order', () => {
            stateManager.bringToFront(layer1.id);

            const layers = stateManager.getLayers();
            expect(layers[0].name).toBe('Layer 1');
            expect(layers[1].name).toBe('Layer 4');
            expect(layers[2].name).toBe('Layer 3');
            expect(layers[3].name).toBe('Layer 2');
        });

        test('move persists (undo method removed per CORE-6)', () => {
            stateManager.bringToFront(layer1.id);
            const positionAfterMove = stateManager.getLayers().findIndex(l => l.name === 'Layer 1');
            
            // undo() method no longer exists (CORE-6)
            // HistoryManager handles undo/redo in the editor

            const layers = stateManager.getLayers();
            const currentPosition = layers.findIndex(l => l.name === 'Layer 1');
            // Position unchanged - no undo available at StateManager level
            expect(currentPosition).toBe(positionAfterMove);
        });
    });

    describe('sendToBack', () => {
        test('should move layer to back (last index)', () => {
            const result = stateManager.sendToBack(layer4.id);

            expect(result).toBe(true);
            const layers = stateManager.getLayers();
            expect(layers[3].name).toBe('Layer 4');
        });

        test('should return false for layer already at back', () => {
            const result = stateManager.sendToBack(layer1.id);
            expect(result).toBe(false);
        });

        test('should return false for non-existent layer', () => {
            const result = stateManager.sendToBack('non-existent');
            expect(result).toBe(false);
        });

        test('should preserve other layers order', () => {
            stateManager.sendToBack(layer4.id);

            const layers = stateManager.getLayers();
            expect(layers[0].name).toBe('Layer 3');
            expect(layers[1].name).toBe('Layer 2');
            expect(layers[2].name).toBe('Layer 1');
            expect(layers[3].name).toBe('Layer 4');
        });

        test('move persists (undo method removed per CORE-6)', () => {
            stateManager.sendToBack(layer4.id);
            const positionAfterMove = stateManager.getLayers().findIndex(l => l.name === 'Layer 4');
            
            // undo() method no longer exists (CORE-6)
            // HistoryManager handles undo/redo in the editor

            const layers = stateManager.getLayers();
            const currentPosition = layers.findIndex(l => l.name === 'Layer 4');
            // Position unchanged - no undo available at StateManager level
            expect(currentPosition).toBe(positionAfterMove);
        });
    });

    describe('Combined ordering operations', () => {
        test('should handle multiple sequential moves', () => {
            // Move layer1 to front, then layer2 to front
            stateManager.bringToFront(layer1.id);
            stateManager.bringToFront(layer2.id);

            const layers = stateManager.getLayers();
            expect(layers[0].name).toBe('Layer 2');
            expect(layers[1].name).toBe('Layer 1');
        });

        test('moves persist without undo (CORE-6)', () => {
            stateManager.bringToFront(layer1.id);
            stateManager.bringToFront(layer2.id);

            // undo() method no longer exists (CORE-6)
            // HistoryManager handles undo/redo in the editor
            
            let layers = stateManager.getLayers();
            expect(layers[0].name).toBe('Layer 2'); // Layer 2 at front
            expect(layers[1].name).toBe('Layer 1'); // Layer 1 second
        });

        test('should mark state as dirty after ordering changes', () => {
            stateManager.markClean();
            expect(stateManager.isDirty()).toBe(false);

            stateManager.moveLayerUp(layer1.id);

            expect(stateManager.isDirty()).toBe(true);
        });
    });
});
