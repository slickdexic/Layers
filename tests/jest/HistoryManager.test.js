/**
 * @jest-environment jsdom
 */

const HistoryManager = require('../../resources/ext.layers.editor/HistoryManager.js');

describe('HistoryManager', () => {
    let historyManager;
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
                height: 50
        }
        ];

        // Create mock CanvasManager
        mockCanvasManager = {
            layers: mockLayers,
            selectedLayerIds: [],
            redraw: jest.fn(),
            isModified: false
        };

        // Create HistoryManager instance
        historyManager = new HistoryManager(mockCanvasManager);
    });

    describe('initialization', () => {
        test('should create HistoryManager with correct properties', () => {
            expect(historyManager.canvasManager).toBe(mockCanvasManager);
            expect(historyManager.history).toEqual([]);
            expect(historyManager.currentIndex).toBe(-1);
            expect(historyManager.maxHistorySize).toBe(50);
            expect(historyManager.batchOperations).toEqual([]);
            expect(historyManager.batchMode).toBe(false);
        });
    });

    describe('state management', () => {
        test('should save initial state', () => {
            historyManager.saveState('Initial state');

            expect(historyManager.history).toHaveLength(1);
            expect(historyManager.currentIndex).toBe(0);
            expect(historyManager.history[0].description).toBe('Initial state');
            expect(historyManager.history[0].layers).toEqual(JSON.parse(JSON.stringify(mockLayers)));
        });

        test('should save multiple states', () => {
            historyManager.saveState('State 1');

            // Modify layers
            mockLayers[0].x = 50;
            historyManager.saveState('State 2');

            expect(historyManager.history).toHaveLength(2);
            expect(historyManager.currentIndex).toBe(1);
            expect(historyManager.history[0].layers[0].x).toBe(10);
            expect(historyManager.history[1].layers[0].x).toBe(50);
        });

        test('should truncate history when saving after undo', () => {
            historyManager.saveState('State 1');
            historyManager.saveState('State 2');
            historyManager.saveState('State 3');

            // Undo twice
            historyManager.undo();
            historyManager.undo();

            // Save new state - should truncate State 3
            mockLayers[0].y = 100;
            historyManager.saveState('New State');

            expect(historyManager.history).toHaveLength(3);
            expect(historyManager.currentIndex).toBe(2);
            expect(historyManager.history[2].description).toBe('New State');
        });

        test('should maintain max history size', () => {
            historyManager.maxHistorySize = 3;

            for (let i = 0; i < 5; i++) {
                mockLayers[0].x = i * 10;
                historyManager.saveState(`State ${i}`);
            }

            expect(historyManager.history).toHaveLength(3);
            expect(historyManager.currentIndex).toBe(2);
            expect(historyManager.history[0].description).toBe('State 2');
            expect(historyManager.history[2].description).toBe('State 4');
        });
    });

    describe('undo functionality', () => {
        test('should undo to previous state', () => {
            historyManager.saveState('Initial');

            mockLayers[0].x = 50;
            historyManager.saveState('Modified');

            const result = historyManager.undo();

            expect(result).toBe(true);
            expect(historyManager.currentIndex).toBe(0);
            expect(mockCanvasManager.layers[0].x).toBe(10);
            expect(mockCanvasManager.redraw).toHaveBeenCalled();
        });

        test('should return false when no undo available', () => {
            const result = historyManager.undo();

            expect(result).toBe(false);
            expect(mockCanvasManager.redraw).not.toHaveBeenCalled();
        });

        test('should handle multiple undos', () => {
            historyManager.saveState('State 1');

            mockLayers[0].x = 50;
            historyManager.saveState('State 2');

            mockLayers[0].x = 100;
            historyManager.saveState('State 3');

            historyManager.undo(); // Back to State 2
            historyManager.undo(); // Back to State 1

            expect(historyManager.currentIndex).toBe(0);
            expect(mockCanvasManager.layers[0].x).toBe(10);
        });
    });

    describe('redo functionality', () => {
        test('should redo to next state', () => {
            historyManager.saveState('Initial');

            mockLayers[0].x = 50;
            historyManager.saveState('Modified');

            historyManager.undo();
            const result = historyManager.redo();

            expect(result).toBe(true);
            expect(historyManager.currentIndex).toBe(1);
            expect(mockCanvasManager.layers[0].x).toBe(50);
            expect(mockCanvasManager.redraw).toHaveBeenCalled();
        });

        test('should return false when no redo available', () => {
            historyManager.saveState('Initial');
            const result = historyManager.redo();

            expect(result).toBe(false);
            expect(mockCanvasManager.redraw).not.toHaveBeenCalled();
        });

        test('should handle multiple redos', () => {
            historyManager.saveState('State 1');

            mockLayers[0].x = 50;
            historyManager.saveState('State 2');

            mockLayers[0].x = 100;
            historyManager.saveState('State 3');

            // Undo all the way back
            historyManager.undo();
            historyManager.undo();

            // Redo forward
            historyManager.redo(); // Forward to State 2
            historyManager.redo(); // Forward to State 3

            expect(historyManager.currentIndex).toBe(2);
            expect(mockCanvasManager.layers[0].x).toBe(100);
        });
    });

    describe('batch operations', () => {
        test('should start batch mode', () => {
            historyManager.startBatch('Batch operation');

            expect(historyManager.batchMode).toBe(true);
            expect(historyManager.batchOperations).toEqual([]);
        });

        test('should collect operations in batch mode', () => {
            historyManager.startBatch('Batch operation');

            mockLayers[0].x = 50;
            historyManager.saveState('Move 1');

            mockLayers[0].y = 100;
            historyManager.saveState('Move 2');

            // Should not add to main history during batch
            expect(historyManager.history).toHaveLength(0);
            expect(historyManager.batchOperations).toHaveLength(2);
        });

        test('should commit batch as single operation', () => {
            historyManager.saveState('Initial');

            historyManager.startBatch('Multi-move operation');

            mockLayers[0].x = 50;
            historyManager.saveState('Move 1');

            mockLayers[0].y = 100;
            historyManager.saveState('Move 2');

            historyManager.commitBatch();

            expect(historyManager.batchMode).toBe(false);
            expect(historyManager.history).toHaveLength(2);
            expect(historyManager.history[1].description).toBe('Multi-move operation');
            expect(historyManager.batchOperations).toEqual([]);
        });

        test('should cancel batch operations', () => {
            historyManager.saveState('Initial');

            historyManager.startBatch('Cancelled operation');

            mockLayers[0].x = 50;
            historyManager.saveState('Move 1');

            historyManager.cancelBatch();

            expect(historyManager.batchMode).toBe(false);
            expect(historyManager.history).toHaveLength(1);
            expect(historyManager.batchOperations).toEqual([]);
            expect(mockCanvasManager.layers[0].x).toBe(10); // Restored to initial
        });
    });

    describe('utility methods', () => {
        test('should check if undo is available', () => {
            expect(historyManager.canUndo()).toBe(false);

            historyManager.saveState('Initial');
            historyManager.saveState('Modified');

            expect(historyManager.canUndo()).toBe(true);

            historyManager.undo();
            historyManager.undo();

            expect(historyManager.canUndo()).toBe(false);
        });

        test('should check if redo is available', () => {
            expect(historyManager.canRedo()).toBe(false);

            historyManager.saveState('Initial');
            historyManager.saveState('Modified');

            expect(historyManager.canRedo()).toBe(false);

            historyManager.undo();

            expect(historyManager.canRedo()).toBe(true);
        });

        test('should clear history', () => {
            historyManager.saveState('State 1');
            historyManager.saveState('State 2');

            historyManager.clear();

            expect(historyManager.history).toEqual([]);
            expect(historyManager.currentIndex).toBe(-1);
            expect(historyManager.batchOperations).toEqual([]);
            expect(historyManager.batchMode).toBe(false);
        });

        test('should get current state description', () => {
            expect(historyManager.getCurrentStateDescription()).toBe('No history');

            historyManager.saveState('Test state');

            expect(historyManager.getCurrentStateDescription()).toBe('Test state');
        });
    });

    describe('memory management', () => {
        test('should estimate memory usage', () => {
            historyManager.saveState('Test');
            const usage = historyManager.getMemoryUsage();

            expect(typeof usage).toBe('number');
            expect(usage).toBeGreaterThan(0);
        });

        test('should compress history when memory usage is high', () => {
            // Create many large states to trigger compression
            for (let i = 0; i < 20; i++) {
                // Add large layer data
                mockLayers.push({
                    id: `layer${i}`,
                    type: 'rectangle',
                    x: i * 10,
                    y: i * 10,
                    width: 100,
                    height: 100,
                    largeData: new Array(1000).fill(i) // Simulate large data
                });
                historyManager.saveState(`Large state ${i}`);
            }

            const initialLength = historyManager.history.length;
            historyManager.compressHistory();
            const compressedLength = historyManager.history.length;

            expect(compressedLength).toBeLessThanOrEqual(initialLength);
        });
    });

    describe('restoreState with editor', () => {
        test('should restore state via editor.layers when editor exists', () => {
            const mockEditor = {
                layers: mockLayers,
                canvasManager: {
                    selectionManager: {
                        clearSelection: jest.fn()
                    },
                    renderLayers: jest.fn(),
                    redraw: jest.fn()
                },
                layerPanel: {
                    updateLayers: jest.fn()
                },
                markDirty: jest.fn()
            };
            
            const managerWithEditor = new HistoryManager({}, {
                editor: mockEditor,
                layers: mockLayers
            });
            
            managerWithEditor.saveState('Initial');
            mockEditor.layers[0].x = 999;
            managerWithEditor.saveState('Changed');
            
            managerWithEditor.undo();
            
            expect(mockEditor.layers[0].x).toBe(10);
            expect(mockEditor.canvasManager.selectionManager.clearSelection).toHaveBeenCalled();
            expect(mockEditor.canvasManager.renderLayers).toHaveBeenCalled();
            expect(mockEditor.layerPanel.updateLayers).toHaveBeenCalled();
            expect(mockEditor.markDirty).toHaveBeenCalled();
        });

        test('should use legacy selection clear when selectionManager unavailable', () => {
            const mockCanvasManagerLegacy = {
                layers: mockLayers,
                selectedLayerId: 'layer1',
                selectedLayerIds: ['layer1'],
                redraw: jest.fn()
            };
            
            const managerLegacy = new HistoryManager({}, mockCanvasManagerLegacy);
            managerLegacy.saveState('Initial');
            managerLegacy.saveState('Changed');
            managerLegacy.undo();
            
            expect(mockCanvasManagerLegacy.selectedLayerId).toBeNull();
            expect(mockCanvasManagerLegacy.selectedLayerIds).toEqual([]);
        });
    });

    describe('updateUndoRedoButtons', () => {
        test('should update toolbar buttons when available', () => {
            const undoBtn = document.createElement('button');
            undoBtn.setAttribute('data-action', 'undo');
            const redoBtn = document.createElement('button');
            redoBtn.setAttribute('data-action', 'redo');
            const container = document.createElement('div');
            container.appendChild(undoBtn);
            container.appendChild(redoBtn);
            
            const testLayers = [{ id: 'test', type: 'rectangle', x: 10, y: 20 }];
            const mockWithToolbar = {
                layers: testLayers,
                editor: {
                    layers: testLayers,
                    toolbar: { container },
                    updateStatus: jest.fn()
                },
                redraw: jest.fn()
            };
            
            const managerWithToolbar = new HistoryManager({}, mockWithToolbar);
            managerWithToolbar.saveState('First');
            managerWithToolbar.saveState('Second');
            
            expect(undoBtn.disabled).toBe(false);
            expect(redoBtn.disabled).toBe(true);
            expect(undoBtn.title).toContain('First');
            expect(mockWithToolbar.editor.updateStatus).toHaveBeenCalled();
        });

        test('should disable undo button when nothing to undo', () => {
            const undoBtn = document.createElement('button');
            undoBtn.setAttribute('data-action', 'undo');
            const redoBtn = document.createElement('button');
            redoBtn.setAttribute('data-action', 'redo');
            const container = document.createElement('div');
            container.appendChild(undoBtn);
            container.appendChild(redoBtn);
            
            const testLayers = [{ id: 'test', type: 'rectangle', x: 10, y: 20 }];
            const mockWithToolbar = {
                layers: testLayers,
                editor: {
                    layers: testLayers,
                    toolbar: { container },
                    updateStatus: jest.fn()
                },
                redraw: jest.fn()
            };
            
            const managerWithToolbar = new HistoryManager({}, mockWithToolbar);
            managerWithToolbar.saveState('Only');
            
            expect(undoBtn.disabled).toBe(true);
            expect(undoBtn.title).toBe('Nothing to undo');
        });
    });

    describe('getHistoryEntries', () => {
        test('should return recent history entries', () => {
            historyManager.saveState('State 1');
            historyManager.saveState('State 2');
            historyManager.saveState('State 3');
            
            const entries = historyManager.getHistoryEntries(10);
            
            expect(entries).toHaveLength(3);
            expect(entries[0].description).toBe('State 1');
            expect(entries[2].isCurrent).toBe(true);
            expect(entries[0].canRevertTo).toBe(true);
        });

        test('should limit returned entries', () => {
            for (let i = 0; i < 10; i++) {
                historyManager.saveState(`State ${i}`);
            }
            
            const entries = historyManager.getHistoryEntries(3);
            
            expect(entries).toHaveLength(3);
            expect(entries[0].description).toBe('State 7');
        });

        test('should use default limit of 10', () => {
            for (let i = 0; i < 15; i++) {
                historyManager.saveState(`State ${i}`);
            }
            
            const entries = historyManager.getHistoryEntries();
            
            expect(entries).toHaveLength(10);
        });
    });

    describe('revertTo', () => {
        test('should revert to specific history entry', () => {
            historyManager.saveState('State 1');
            mockLayers[0].x = 50;
            historyManager.saveState('State 2');
            mockLayers[0].x = 100;
            historyManager.saveState('State 3');
            
            const result = historyManager.revertTo(1);
            
            expect(result).toBe(true);
            expect(historyManager.currentIndex).toBe(1);
            expect(mockCanvasManager.layers[0].x).toBe(50);
        });

        test('should return false for invalid index', () => {
            historyManager.saveState('State 1');
            
            expect(historyManager.revertTo(-1)).toBe(false);
            expect(historyManager.revertTo(100)).toBe(false);
        });

        test('should return false when trying to revert to future state', () => {
            historyManager.saveState('State 1');
            historyManager.saveState('State 2');
            historyManager.undo();
            
            // Can't revert to index 1 when currentIndex is 0
            expect(historyManager.revertTo(1)).toBe(false);
        });
    });

    describe('setMaxHistorySteps', () => {
        test('should update max history steps', () => {
            historyManager.setMaxHistorySteps(10);
            
            expect(historyManager.maxHistorySize).toBe(10);
        });

        test('should enforce minimum of 1', () => {
            historyManager.setMaxHistorySteps(0);
            
            expect(historyManager.maxHistorySize).toBe(1);
        });

        test('should trim history when reducing max steps', () => {
            for (let i = 0; i < 10; i++) {
                historyManager.saveState(`State ${i}`);
            }
            
            historyManager.setMaxHistorySteps(3);
            
            expect(historyManager.history).toHaveLength(3);
            expect(historyManager.history[0].description).toBe('State 7');
        });
    });

    describe('hasUnsavedChanges', () => {
        test('should return true when layers exist but no history', () => {
            expect(historyManager.hasUnsavedChanges()).toBe(true);
        });

        test('should return false when state matches last saved', () => {
            historyManager.saveState('Initial');
            
            expect(historyManager.hasUnsavedChanges()).toBe(false);
        });

        test('should return true when state differs from last saved', () => {
            historyManager.saveState('Initial');
            mockLayers[0].x = 999;
            
            expect(historyManager.hasUnsavedChanges()).toBe(true);
        });
    });

    describe('saveInitialState', () => {
        test('should clear history and save initial state', () => {
            historyManager.saveState('Old 1');
            historyManager.saveState('Old 2');
            
            historyManager.saveInitialState();
            
            expect(historyManager.history).toHaveLength(1);
            expect(historyManager.history[0].description).toBe('Initial state');
            expect(historyManager.currentIndex).toBe(0);
        });
    });

    describe('exportHistory', () => {
        test('should export history for debugging', () => {
            historyManager.saveState('State 1');
            historyManager.saveState('State 2');
            
            const exported = historyManager.exportHistory();
            
            expect(exported.history).toHaveLength(2);
            expect(exported.history[0].description).toBe('State 1');
            expect(exported.history[0].layerCount).toBe(1);
            expect(exported.historyIndex).toBe(1);
            expect(exported.maxHistorySteps).toBe(50);
            expect(exported.batchMode).toBe(false);
        });
    });

    describe('getHistoryInfo', () => {
        test('should return history information', () => {
            historyManager.saveState('State 1');
            historyManager.saveState('State 2');
            
            const info = historyManager.getHistoryInfo();
            
            expect(info.totalSteps).toBe(2);
            expect(info.currentStep).toBe(2);
            expect(info.canUndo).toBe(true);
            expect(info.canRedo).toBe(false);
            expect(info.maxSteps).toBe(50);
            expect(info.batchMode).toBe(false);
        });
    });
});
