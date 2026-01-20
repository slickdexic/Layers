/**
 * @jest-environment jsdom
 */

const ClipboardController = require('../../resources/ext.layers.editor/canvas/ClipboardController.js');

describe('ClipboardController', () => {
    let clipboardController;
    let mockCanvasManager;
    let mockEditor;
    let mockLayers;

    beforeEach(() => {
        // Create mock layers
        mockLayers = [
            {
                id: 'layer1',
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                fillColor: '#ff0000',
                visible: true,
                locked: false
            },
            {
                id: 'layer2',
                type: 'circle',
                x: 400,
                y: 200,
                radius: 50,
                fillColor: '#00ff00',
                visible: true,
                locked: false
            },
            {
                id: 'layer3',
                type: 'line',
                x1: 50,
                y1: 300,
                x2: 250,
                y2: 350,
                strokeWidth: 2,
                visible: true,
                locked: false
            },
            {
                id: 'layer4',
                type: 'path',
                points: [
                    { x: 100, y: 400 },
                    { x: 150, y: 420 },
                    { x: 200, y: 410 }
                ],
                strokeWidth: 3,
                visible: true,
                locked: false
            },
            {
                id: 'layer5',
                type: 'arrow',
                x1: 100,
                y1: 500,
                x2: 300,
                y2: 550,
                controlX: 200,
                controlY: 450,
                arrowhead: 'arrow',
                strokeWidth: 2,
                visible: true,
                locked: false
            }
        ];

        // Create mock editor
        mockEditor = {
            layers: mockLayers,
            getLayerById: jest.fn((id) => {
                return mockLayers.find(l => l.id === id);
            }),
            generateLayerId: jest.fn(() => {
                return 'generated_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
            }),
            saveState: jest.fn(),
            markDirty: jest.fn()
        };

        // Create mock CanvasManager
        mockCanvasManager = {
            editor: mockEditor,
            selectedLayerId: null,
            selectedLayerIds: [],
            renderLayers: jest.fn(),
            deselectAll: jest.fn()
        };

        // Create ClipboardController instance
        clipboardController = new ClipboardController(mockCanvasManager);
    });

    describe('initialization', () => {
        test('should create ClipboardController with correct properties', () => {
            expect(clipboardController.canvasManager).toBe(mockCanvasManager);
            expect(clipboardController.clipboard).toEqual([]);
        });
    });

    describe('copySelected', () => {
        test('should copy single selected layer', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];

            const count = clipboardController.copySelected();

            expect(count).toBe(1);
            expect(clipboardController.clipboard.length).toBe(1);
            expect(clipboardController.clipboard[0].id).toBe('layer1');
            expect(clipboardController.clipboard[0].type).toBe('rectangle');
        });

        test('should copy multiple selected layers', () => {
            mockCanvasManager.selectedLayerIds = ['layer1', 'layer2'];

            const count = clipboardController.copySelected();

            expect(count).toBe(2);
            expect(clipboardController.clipboard.length).toBe(2);
        });

        test('should deep clone layers', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];

            clipboardController.copySelected();

            // Modify original layer
            mockLayers[0].fillColor = '#0000ff';

            // Clipboard should still have original value
            expect(clipboardController.clipboard[0].fillColor).toBe('#ff0000');
        });

        test('should return 0 when no layers selected', () => {
            mockCanvasManager.selectedLayerIds = [];

            const count = clipboardController.copySelected();

            expect(count).toBe(0);
            expect(clipboardController.clipboard.length).toBe(0);
        });

        test('should skip non-existent layer ids', () => {
            mockCanvasManager.selectedLayerIds = ['nonexistent', 'layer1'];

            const count = clipboardController.copySelected();

            expect(count).toBe(1);
        });

        test('should clear previous clipboard contents', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            mockCanvasManager.selectedLayerIds = ['layer2'];
            clipboardController.copySelected();

            expect(clipboardController.clipboard.length).toBe(1);
            expect(clipboardController.clipboard[0].id).toBe('layer2');
        });

        test('should use getSelectedLayerIds method when available', () => {
            // Add getSelectedLayerIds method to canvasManager
            mockCanvasManager.getSelectedLayerIds = jest.fn().mockReturnValue(['layer1', 'layer2']);

            const count = clipboardController.copySelected();

            expect(mockCanvasManager.getSelectedLayerIds).toHaveBeenCalled();
            expect(count).toBe(2);
            expect(clipboardController.clipboard.length).toBe(2);

            // Clean up
            delete mockCanvasManager.getSelectedLayerIds;
        });
    });

    describe('paste', () => {
        test('should paste layer from clipboard', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            const pastedIds = clipboardController.paste();

            expect(pastedIds.length).toBe(1);
            expect(mockEditor.layers.length).toBe(6); // Original 5 + 1 pasted
            expect(mockEditor.saveState).toHaveBeenCalled();
            expect(mockEditor.markDirty).toHaveBeenCalled();
            expect(mockCanvasManager.renderLayers).toHaveBeenCalled();
        });

        test('should apply paste offset to position', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            clipboardController.paste();

            // First layer (pasted) should have offset applied
            expect(mockEditor.layers[0].x).toBe(120); // 100 + 20 offset
            expect(mockEditor.layers[0].y).toBe(120); // 100 + 20 offset
        });

        test('should apply paste offset to line endpoints', () => {
            mockCanvasManager.selectedLayerIds = ['layer3'];
            clipboardController.copySelected();

            clipboardController.paste();

            const pastedLine = mockEditor.layers[0];
            expect(pastedLine.x1).toBe(70);  // 50 + 20
            expect(pastedLine.y1).toBe(320); // 300 + 20
            expect(pastedLine.x2).toBe(270); // 250 + 20
            expect(pastedLine.y2).toBe(370); // 350 + 20
        });

        test('should apply paste offset to path points', () => {
            mockCanvasManager.selectedLayerIds = ['layer4'];
            clipboardController.copySelected();

            clipboardController.paste();

            const pastedPath = mockEditor.layers[0];
            expect(pastedPath.points[0].x).toBe(120); // 100 + 20
            expect(pastedPath.points[0].y).toBe(420); // 400 + 20
            expect(pastedPath.points[1].x).toBe(170); // 150 + 20
        });

        test('should apply paste offset to curved arrow control points', () => {
            mockCanvasManager.selectedLayerIds = ['layer5'];
            clipboardController.copySelected();

            clipboardController.paste();

            const pastedArrow = mockEditor.layers[0];
            expect(pastedArrow.x1).toBe(120);       // 100 + 20
            expect(pastedArrow.y1).toBe(520);       // 500 + 20
            expect(pastedArrow.x2).toBe(320);       // 300 + 20
            expect(pastedArrow.y2).toBe(570);       // 550 + 20
            expect(pastedArrow.controlX).toBe(220); // 200 + 20
            expect(pastedArrow.controlY).toBe(470); // 450 + 20
        });

        test('should generate new unique ID for pasted layers', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            clipboardController.paste();

            expect(mockEditor.layers[0].id).not.toBe('layer1');
            expect(mockEditor.generateLayerId).toHaveBeenCalled();
        });

        test('should select pasted layers', () => {
            mockCanvasManager.selectedLayerIds = ['layer1', 'layer2'];
            clipboardController.copySelected();

            const pastedIds = clipboardController.paste();

            expect(mockCanvasManager.selectedLayerIds).toEqual(pastedIds);
        });

        test('should insert pasted layers at top of layer stack', () => {
            mockCanvasManager.selectedLayerIds = ['layer2'];
            clipboardController.copySelected();

            clipboardController.paste();

            expect(mockEditor.layers[0].type).toBe('circle');
        });

        test('should return empty array when clipboard is empty', () => {
            const pastedIds = clipboardController.paste();

            expect(pastedIds).toEqual([]);
            expect(mockEditor.saveState).not.toHaveBeenCalled();
        });
    });

    describe('cutSelected', () => {
        test('should copy and delete selected layer', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];

            const count = clipboardController.cutSelected();

            expect(count).toBe(1);
            expect(clipboardController.clipboard.length).toBe(1);
            expect(mockEditor.layers.length).toBe(4); // 5 - 1 deleted
            expect(mockEditor.layers.find(l => l.id === 'layer1')).toBeUndefined();
        });

        test('should cut multiple selected layers', () => {
            mockCanvasManager.selectedLayerIds = ['layer1', 'layer2'];

            const count = clipboardController.cutSelected();

            expect(count).toBe(2);
            expect(mockEditor.layers.length).toBe(3); // 5 - 2 deleted
        });

        test('should call deselectAll after cut', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];

            clipboardController.cutSelected();

            expect(mockCanvasManager.deselectAll).toHaveBeenCalled();
        });

        test('should return 0 when no layers selected', () => {
            mockCanvasManager.selectedLayerIds = [];

            const count = clipboardController.cutSelected();

            expect(count).toBe(0);
        });

        test('should save state and mark dirty', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];

            clipboardController.cutSelected();

            expect(mockEditor.saveState).toHaveBeenCalled();
            expect(mockEditor.markDirty).toHaveBeenCalled();
        });
    });

    describe('hasContent', () => {
        test('should return false when clipboard is empty', () => {
            expect(clipboardController.hasContent()).toBe(false);
        });

        test('should return true when clipboard has layers', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            expect(clipboardController.hasContent()).toBe(true);
        });
    });

    describe('getCount', () => {
        test('should return 0 for empty clipboard', () => {
            expect(clipboardController.getCount()).toBe(0);
        });

        test('should return correct count', () => {
            mockCanvasManager.selectedLayerIds = ['layer1', 'layer2'];
            clipboardController.copySelected();

            expect(clipboardController.getCount()).toBe(2);
        });
    });

    describe('clear', () => {
        test('should clear clipboard contents', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            clipboardController.clear();

            expect(clipboardController.clipboard).toEqual([]);
            expect(clipboardController.hasContent()).toBe(false);
        });
    });

    describe('applyPasteOffset', () => {
        test('should handle undefined position values', () => {
            const layer = {
                type: 'rectangle'
                // no x, y defined
            };

            clipboardController.applyPasteOffset(layer);

            // Should not throw
            expect(layer.x).toBeUndefined();
            expect(layer.y).toBeUndefined();
        });

        test('should handle null values gracefully', () => {
            const layer = {
                type: 'rectangle',
                x: null,
                y: null
            };

            clipboardController.applyPasteOffset(layer);

            expect(layer.x).toBe(20); // null becomes 0, + 20
            expect(layer.y).toBe(20);
        });
    });

    describe('generateLayerId', () => {
        test('should use editor generateLayerId when available', () => {
            mockEditor.generateLayerId.mockReturnValue('custom_id');

            const id = clipboardController.generateLayerId(mockEditor);

            expect(id).toBe('custom_id');
            expect(mockEditor.generateLayerId).toHaveBeenCalled();
        });

        test('should fallback to internal ID generation when editor unavailable', () => {
            const id = clipboardController.generateLayerId(null);

            expect(id).toMatch(/^layer_\d+_[a-z0-9]+$/);
        });

        test('should fallback when editor has no generateLayerId', () => {
            const editorWithoutMethod = { layers: [] };

            const id = clipboardController.generateLayerId(editorWithoutMethod);

            expect(id).toMatch(/^layer_\d+_[a-z0-9]+$/);
        });
    });

    describe('destroy', () => {
        test('should clean up resources', () => {
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            clipboardController.destroy();

            expect(clipboardController.clipboard).toEqual([]);
            expect(clipboardController.canvasManager).toBeNull();
        });
    });

    describe('edge cases and fallback branches', () => {
        test('should use setSelectedLayerIds when available on paste', () => {
            mockCanvasManager.setSelectedLayerIds = jest.fn();
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            const pastedIds = clipboardController.paste();

            expect(mockCanvasManager.setSelectedLayerIds).toHaveBeenCalledWith(pastedIds);
        });

        test('should fallback to direct assignment when setSelectedLayerIds is unavailable on paste', () => {
            // Ensure setSelectedLayerIds is not available
            delete mockCanvasManager.setSelectedLayerIds;
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            const pastedIds = clipboardController.paste();

            // Should set selectedLayerId and selectedLayerIds directly
            expect(mockCanvasManager.selectedLayerId).toBe(pastedIds[pastedIds.length - 1]);
            expect(mockCanvasManager.selectedLayerIds).toEqual(pastedIds);
        });

        test('should set lastSelectedId on selectionManager when available on paste', () => {
            mockCanvasManager.selectionManager = { lastSelectedId: null };
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            const pastedIds = clipboardController.paste();

            expect(mockCanvasManager.selectionManager.lastSelectedId).toBe(pastedIds[pastedIds.length - 1]);
        });

        test('should use stateManager.set when available during cut', () => {
            mockEditor.stateManager = {
                set: jest.fn(),
                getLayers: jest.fn(() => [])
            };
            mockCanvasManager.selectedLayerIds = ['layer1'];

            clipboardController.cutSelected();

            expect(mockEditor.stateManager.set).toHaveBeenCalledWith('layers', expect.any(Array));
        });

        test('should fallback to direct layers assignment when stateManager unavailable during cut', () => {
            // Ensure stateManager is not available
            delete mockEditor.stateManager;
            mockCanvasManager.selectedLayerIds = ['layer1'];
            const originalLayers = mockEditor.layers.slice();

            clipboardController.cutSelected();

            // Should have removed layer1 directly
            expect(mockEditor.layers.length).toBe(originalLayers.length - 1);
            expect(mockEditor.layers.find(l => l.id === 'layer1')).toBeUndefined();
        });

        test('should use getSelectedLayerIds when available during copy', () => {
            mockCanvasManager.getSelectedLayerIds = jest.fn(() => ['layer1', 'layer2']);

            const count = clipboardController.copySelected();

            expect(mockCanvasManager.getSelectedLayerIds).toHaveBeenCalled();
            expect(count).toBe(2);
        });

        test('should use getSelectedLayerIds when available during cut', () => {
            mockCanvasManager.getSelectedLayerIds = jest.fn(() => ['layer1']);

            const count = clipboardController.cutSelected();

            expect(mockCanvasManager.getSelectedLayerIds).toHaveBeenCalled();
            expect(count).toBe(1);
        });

        test('should fall back to selectedLayerIds when getSelectedLayerIds is not available', () => {
            // Remove getSelectedLayerIds to test fallback path
            delete mockCanvasManager.getSelectedLayerIds;
            mockCanvasManager.selectedLayerIds = ['layer1', 'layer2'];

            const count = clipboardController.copySelected();

            expect(count).toBe(2);
        });

        test('should not offset x1/y1/x2/y2 when layer does not have those properties', () => {
            // layer1 is a rectangle without x1/y1/x2/y2
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            clipboardController.paste();

            const pastedLayer = mockEditor.layers[0];
            // Should have x/y offset but not x1/y1/x2/y2 (they shouldn't exist)
            expect(pastedLayer.x).toBe(120); // 100 + 20
            expect(pastedLayer.y).toBe(120);
            expect(pastedLayer.x1).toBeUndefined();
            expect(pastedLayer.y1).toBeUndefined();
            expect(pastedLayer.x2).toBeUndefined();
            expect(pastedLayer.y2).toBeUndefined();
        });

        test('should handle layer without points property', () => {
            // layer1 is a rectangle without points
            mockCanvasManager.selectedLayerIds = ['layer1'];
            clipboardController.copySelected();

            clipboardController.paste();

            const pastedLayer = mockEditor.layers[0];
            expect(pastedLayer.points).toBeUndefined();
        });

        test('should skip layer with null x/y', () => {
            // Add a layer with undefined x/y
            mockLayers.push({
                id: 'layer-no-xy',
                type: 'text',
                text: 'Hello',
                visible: true,
                locked: false
            });
            mockCanvasManager.selectedLayerIds = ['layer-no-xy'];
            clipboardController.copySelected();

            // Should not throw
            expect(() => clipboardController.paste()).not.toThrow();
        });

        test('should handle line layer with zero coordinates using fallback', () => {
            // Add a line layer with x1=0, y1=0, x2=0, y2=0
            mockLayers.push({
                id: 'line-zero',
                type: 'line',
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 0,
                visible: true
            });
            mockCanvasManager.selectedLayerIds = ['line-zero'];
            clipboardController.copySelected();

            const pastedIds = clipboardController.paste();

            expect(pastedIds).toHaveLength(1);
            const pastedLine = mockLayers.find(l => l.id === pastedIds[0]);
            // Zero coords should be offset by PASTE_OFFSET (20) using fallback
            expect(pastedLine.x1).toBe(20);
            expect(pastedLine.y1).toBe(20);
            expect(pastedLine.x2).toBe(20);
            expect(pastedLine.y2).toBe(20);
        });
    });
});
