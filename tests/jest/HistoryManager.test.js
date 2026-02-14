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
            renderLayers: jest.fn(),
            redraw: jest.fn(),
            isModified: false
        };

        // Create HistoryManager instance
        historyManager = new HistoryManager({ canvasManager: mockCanvasManager });
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

            // Undo twice - now at State 1
            historyManager.undo();
            historyManager.undo();

            // Save new state - should truncate State 2 AND State 3
            mockLayers[0].y = 100;
            historyManager.saveState('New State');

            // History should be [State 1, New State] - all redo entries removed
            expect(historyManager.history).toHaveLength(2);
            expect(historyManager.currentIndex).toBe(1);
            expect(historyManager.history[0].description).toBe('State 1');
            expect(historyManager.history[1].description).toBe('New State');
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
            expect(mockCanvasManager.renderLayers).toHaveBeenCalled();
        });

        test('should return false when no undo available', () => {
            const result = historyManager.undo();

            expect(result).toBe(false);
            expect(mockCanvasManager.renderLayers).not.toHaveBeenCalled();
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
            expect(mockCanvasManager.renderLayers).toHaveBeenCalled();
        });

        test('should return false when no redo available', () => {
            historyManager.saveState('Initial');
            const result = historyManager.redo();

            expect(result).toBe(false);
            expect(mockCanvasManager.renderLayers).not.toHaveBeenCalled();
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

        test('endBatch should early return when not in batch mode', () => {
            // Save initial state
            historyManager.saveState('Initial');
            const historyLengthBefore = historyManager.history.length;
            
            // Call endBatch without starting a batch
            expect(historyManager.batchMode).toBe(false);
            historyManager.endBatch();
            
            // History should be unchanged
            expect(historyManager.history.length).toBe(historyLengthBefore);
            expect(historyManager.batchMode).toBe(false);
        });

        test('endBatch should early return when batchChanges is empty', () => {
            // Start batch but don't add any changes
            historyManager.startBatch('Empty batch');
            expect(historyManager.batchMode).toBe(true);
            expect(historyManager.batchChanges.length).toBe(0);
            
            historyManager.endBatch();
            
            // Should reset batch state but not save to history
            expect(historyManager.batchMode).toBe(false);
            expect(historyManager.history.length).toBe(0); // No history entry created
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
                    renderLayerList: jest.fn()
                },
                markDirty: jest.fn()
            };
            
            const managerWithEditor = new HistoryManager({ canvasManager: {
                editor: mockEditor,
                layers: mockLayers
            } });
            
            managerWithEditor.saveState('Initial');
            mockEditor.layers[0].x = 999;
            managerWithEditor.saveState('Changed');
            
            managerWithEditor.undo();
            
            expect(mockEditor.layers[0].x).toBe(10);
            expect(mockEditor.canvasManager.selectionManager.clearSelection).toHaveBeenCalled();
            expect(mockEditor.canvasManager.renderLayers).toHaveBeenCalled();
            expect(mockEditor.layerPanel.renderLayerList).toHaveBeenCalled();
            expect(mockEditor.markDirty).toHaveBeenCalled();
        });

        test('should use legacy selection clear when selectionManager unavailable', () => {
            const mockCanvasManagerLegacy = {
                layers: mockLayers,
                selectedLayerId: 'layer1',
                selectedLayerIds: ['layer1'],
                redraw: jest.fn()
            };
            
            const managerLegacy = new HistoryManager({ canvasManager: mockCanvasManagerLegacy });
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
            
            const managerWithToolbar = new HistoryManager({ canvasManager: mockWithToolbar });
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
            
            const managerWithToolbar = new HistoryManager({ canvasManager: mockWithToolbar });
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

    describe('text layer move and undo scenario', () => {
        let textLayerMockLayers;
        let textLayerCanvasManager;
        let textLayerHistoryManager;

        beforeEach(() => {
            // Create a text layer similar to real scenario
            textLayerMockLayers = [
                {
                    id: 'text-layer-1',
                    type: 'text',
                    text: 'Hello World',
                    x: 100,
                    y: 200,
                    fontSize: 16,
                    fontFamily: 'Arial'
                }
            ];

            textLayerCanvasManager = {
                layers: textLayerMockLayers,
                selectedLayerIds: [],
                redraw: jest.fn(),
                isModified: false
            };

            textLayerHistoryManager = new HistoryManager({ canvasManager: textLayerCanvasManager });
        });

        test('should correctly undo text layer move - verifying history[0] has layers', () => {
            // Step 1: Save initial state (simulates loadInitialLayers completion)
            expect(textLayerMockLayers.length).toBe(1);
            textLayerHistoryManager.saveState('initial');
            
            // Verify history[0] has the text layer
            expect(textLayerHistoryManager.history.length).toBe(1);
            expect(textLayerHistoryManager.history[0].layers.length).toBe(1);
            expect(textLayerHistoryManager.history[0].layers[0].id).toBe('text-layer-1');
            expect(textLayerHistoryManager.history[0].layers[0].x).toBe(100);

            // Step 2: Move the text layer
            textLayerMockLayers[0].x = 300;
            textLayerMockLayers[0].y = 400;
            textLayerHistoryManager.saveState('Move layer');

            // Verify history[1] has the moved position
            expect(textLayerHistoryManager.history.length).toBe(2);
            expect(textLayerHistoryManager.history[1].layers[0].x).toBe(300);
            expect(textLayerHistoryManager.history[1].layers[0].y).toBe(400);

            // Step 3: Undo
            const undoResult = textLayerHistoryManager.undo();

            // Verify undo worked and restored original position
            expect(undoResult).toBe(true);
            expect(textLayerHistoryManager.currentIndex).toBe(0);
            expect(textLayerCanvasManager.layers.length).toBe(1); // NOT 0!
            expect(textLayerCanvasManager.layers[0].x).toBe(100); // Original position
            expect(textLayerCanvasManager.layers[0].y).toBe(200); // Original position
        });

        test('should NOT have empty history[0] when layers exist before first saveState', () => {
            // This test verifies that when layers exist, saveState captures them
            expect(textLayerMockLayers.length).toBe(1);
            
            textLayerHistoryManager.saveState('initial');
            
            // history[0] must NOT be empty
            expect(textLayerHistoryManager.history[0].layers.length).toBeGreaterThan(0);
            expect(textLayerHistoryManager.history[0].layers.length).toBe(1);
        });
    });

    describe('simulated editor initialization flow', () => {
        test('should capture correct initial state when using StateManager pattern', () => {
            // This test simulates the real LayersEditor initialization flow
            // where HistoryManager gets layers via editor.stateManager.getLayers()

            // Step 1: Create mock StateManager with empty layers (like initializeState())
            const mockStateManagerState = { layers: [] };
            const mockStateManager = {
                getLayers: () => mockStateManagerState.layers.slice(),
                set: (key, value) => { mockStateManagerState[key] = value; }
            };

            // Step 2: Create mock editor with stateManager
            const mockEditor = {
                stateManager: mockStateManager
            };

            // Step 3: Create HistoryManager with editor reference
            const editorHistoryManager = new HistoryManager({ editor: mockEditor });

            // At this point, layers are empty (like after initializeState())
            expect(mockStateManager.getLayers().length).toBe(0);

            // Step 4: Simulate API loading layers (like loadInitialLayers())
            const loadedLayers = [
                {
                    id: 'loaded-text-1',
                    type: 'text',
                    text: 'Loaded Text',
                    x: 50,
                    y: 75
                }
            ];
            mockStateManager.set('layers', loadedLayers);

            // Step 5: Save initial state (like end of loadInitialLayers())
            editorHistoryManager.saveState('initial');

            // Verify history[0] has the LOADED layers, not empty
            expect(editorHistoryManager.history.length).toBe(1);
            expect(editorHistoryManager.history[0].layers.length).toBe(1);
            expect(editorHistoryManager.history[0].layers[0].id).toBe('loaded-text-1');

            // Step 6: Move the layer
            loadedLayers[0].x = 200;
            loadedLayers[0].y = 300;
            editorHistoryManager.saveState('Move layer');

            // Verify both states are captured correctly
            expect(editorHistoryManager.history.length).toBe(2);
            expect(editorHistoryManager.history[0].layers[0].x).toBe(50); // Original
            expect(editorHistoryManager.history[1].layers[0].x).toBe(200); // Moved

            // Step 7: Undo
            editorHistoryManager.undo();

            // Verify we're back to original position
            expect(mockStateManagerState.layers.length).toBe(1);
            expect(mockStateManagerState.layers[0].x).toBe(50);
            expect(mockStateManagerState.layers[0].y).toBe(75);
        });

        test('BUG SCENARIO: saveState called before layers are set captures empty state', () => {
            // This test demonstrates the potential bug:
            // If saveState is called BEFORE layers are set, history[0] will be empty

            const mockStateManagerState = { layers: [] };
            const mockStateManager = {
                getLayers: () => mockStateManagerState.layers.slice(),
                set: (key, value) => { mockStateManagerState[key] = value; }
            };

            const mockEditor = {
                stateManager: mockStateManager
            };

            const editorHistoryManager = new HistoryManager({ editor: mockEditor });

            // BUG: saveState called while layers are still empty
            editorHistoryManager.saveState('premature-initial');

            // history[0] is EMPTY - this is the bug!
            expect(editorHistoryManager.history[0].layers.length).toBe(0);

            // Now layers arrive
            const loadedLayers = [{ id: 'text-1', type: 'text', x: 100, y: 100 }];
            mockStateManager.set('layers', loadedLayers);
            
            // saveState for the actual initial (but history[0] is already wrong!)
            editorHistoryManager.saveState('actual-initial');

            // Move layer
            loadedLayers[0].x = 300;
            editorHistoryManager.saveState('Move layer');

            // Undo to 'actual-initial' - this works
            editorHistoryManager.undo();
            expect(mockStateManagerState.layers.length).toBe(1);
            expect(mockStateManagerState.layers[0].x).toBe(100);

            // Undo again to 'premature-initial' - this shows the BUG
            editorHistoryManager.undo();
            expect(mockStateManagerState.layers.length).toBe(0); // Canvas wiped!
        });

        test('FIX: saveInitialState clears premature history and saves correct state', () => {
            // This test verifies the fix: using saveInitialState() instead of saveState('initial')

            const mockStateManagerState = { layers: [] };
            const mockStateManager = {
                getLayers: () => mockStateManagerState.layers.slice(),
                set: (key, value) => { mockStateManagerState[key] = value; }
            };

            const mockEditor = {
                stateManager: mockStateManager
            };

            const editorHistoryManager = new HistoryManager({ editor: mockEditor });

            // Simulate premature saveState (e.g., from some initialization code)
            editorHistoryManager.saveState('premature-init');
            expect(editorHistoryManager.history[0].layers.length).toBe(0); // Bad initial state

            // Now layers arrive from API
            const loadedLayers = [{ id: 'text-1', type: 'text', x: 100, y: 100 }];
            mockStateManager.set('layers', loadedLayers);
            
            // FIX: Use saveInitialState() instead of saveState()
            editorHistoryManager.saveInitialState();

            // Verify history was cleared and initial state is correct
            expect(editorHistoryManager.history.length).toBe(1);
            expect(editorHistoryManager.history[0].layers.length).toBe(1);
            expect(editorHistoryManager.history[0].description).toBe('Initial state');

            // Move layer
            loadedLayers[0].x = 300;
            editorHistoryManager.saveState('Move layer');

            // Undo - should go back to correct initial state
            editorHistoryManager.undo();
            expect(mockStateManagerState.layers.length).toBe(1); // NOT 0!
            expect(mockStateManagerState.layers[0].x).toBe(100); // Original position

            // canUndo should be false now (at initial state)
            expect(editorHistoryManager.canUndo()).toBe(false);
        });
    });

    describe('undo then edit different layer scenario', () => {
        test('should NOT redo previous undone action when editing a different layer', () => {
            // This test reproduces the bug:
            // 1. Move layer1, undo → layer1 restored (correct)
            // 2. Move layer2, undo → layer2 restored BUT layer1 also moves back (BUG)
            
            const mockStateManagerState = { 
                layers: [
                    { id: 'layer1', type: 'text', x: 100, y: 100 },
                    { id: 'layer2', type: 'text', x: 200, y: 200 }
                ]
            };
            const mockStateManager = {
                getLayers: () => JSON.parse(JSON.stringify(mockStateManagerState.layers)),
                set: (key, value) => { mockStateManagerState[key] = value; }
            };

            const mockEditor = {
                stateManager: mockStateManager
            };

            const hm = new HistoryManager({ editor: mockEditor });

            // Initial state: both layers at original positions
            hm.saveInitialState();
            expect(hm.history.length).toBe(1);
            expect(hm.history[0].layers[0].x).toBe(100);
            expect(hm.history[0].layers[1].x).toBe(200);

            // Step 1: Move layer1 from x=100 to x=300
            mockStateManagerState.layers[0].x = 300;
            hm.saveState('Move layer1');
            expect(hm.history.length).toBe(2);
            expect(hm.historyIndex).toBe(1);

            // Step 2: Undo - layer1 should go back to x=100
            hm.undo();
            expect(hm.historyIndex).toBe(0);
            expect(mockStateManagerState.layers[0].x).toBe(100); // layer1 restored
            expect(mockStateManagerState.layers[1].x).toBe(200); // layer2 unchanged

            // Step 3: Move layer2 from x=200 to x=400
            mockStateManagerState.layers[1].x = 400;
            hm.saveState('Move layer2');
            
            // CRITICAL: After saving new state after undo, history should be truncated
            // history should now be: [initial, move-layer2]
            // The "Move layer1" state should be GONE
            expect(hm.history.length).toBe(2);
            expect(hm.historyIndex).toBe(1);
            
            // Verify the history contents are correct
            expect(hm.history[0].layers[0].x).toBe(100); // layer1 at original
            expect(hm.history[0].layers[1].x).toBe(200); // layer2 at original
            expect(hm.history[1].layers[0].x).toBe(100); // layer1 still at original
            expect(hm.history[1].layers[1].x).toBe(400); // layer2 at moved position

            // Step 4: Undo - layer2 should go back to x=200, layer1 should STAY at x=100
            hm.undo();
            expect(mockStateManagerState.layers[0].x).toBe(100); // layer1 NOT moved!
            expect(mockStateManagerState.layers[1].x).toBe(200); // layer2 restored

            // Should not be able to undo further
            expect(hm.canUndo()).toBe(false);
        });

        test('history truncation should remove all redo entries, not just some', () => {
            const mockStateManagerState = { 
                layers: [{ id: 'layer1', type: 'text', x: 0 }]
            };
            const mockStateManager = {
                getLayers: () => JSON.parse(JSON.stringify(mockStateManagerState.layers)),
                set: (key, value) => { mockStateManagerState[key] = value; }
            };

            const hm = new HistoryManager({ editor: { stateManager: mockStateManager } });

            // Build up history: initial, move1, move2, move3
            hm.saveInitialState();
            
            mockStateManagerState.layers[0].x = 100;
            hm.saveState('move1');
            
            mockStateManagerState.layers[0].x = 200;
            hm.saveState('move2');
            
            mockStateManagerState.layers[0].x = 300;
            hm.saveState('move3');

            expect(hm.history.length).toBe(4);
            expect(hm.historyIndex).toBe(3);

            // Undo twice: now at move1
            hm.undo(); // at move2
            hm.undo(); // at move1
            expect(hm.historyIndex).toBe(1);
            expect(mockStateManagerState.layers[0].x).toBe(100);

            // Make a new edit - should truncate move2 and move3
            mockStateManagerState.layers[0].x = 999;
            hm.saveState('new-edit');

            // History should be: [initial, move1, new-edit]
            expect(hm.history.length).toBe(3);
            expect(hm.historyIndex).toBe(2);
            expect(hm.history[2].layers[0].x).toBe(999);

            // Undo should go to move1 (x=100), not move2 or move3
            hm.undo();
            expect(mockStateManagerState.layers[0].x).toBe(100);

            // Undo again to initial
            hm.undo();
            expect(mockStateManagerState.layers[0].x).toBe(0);

            // No more undo available
            expect(hm.canUndo()).toBe(false);
        });
    });

    describe('constructor initialization branches', () => {
        test('should handle CanvasManager with renderLayers as first arg', () => {
            const canvasManagerLike = {
                renderLayers: jest.fn(),
                redraw: jest.fn(),
                layers: [],
                editor: { name: 'testEditor' }
            };
            
            const hm = new HistoryManager({ canvasManager: canvasManagerLike });
            
            expect(hm.canvasManager).toBe(canvasManagerLike);
            expect(hm.editor).toBeNull();
            // Editor is still accessible at runtime via getEditor()
            expect(hm.getEditor()).toBe(canvasManagerLike.editor);
            expect(hm.config).toEqual({});
        });

        test('should handle plain config object without canvasManager', () => {
            const hm = new HistoryManager({ maxHistorySteps: 25 });
            
            expect(hm.config).toEqual({});
            expect(hm.canvasManager).toBeNull();
            expect(hm.editor).toBeNull();
            expect(hm.maxHistorySteps).toBe(25);
        });

        test('should accept both editor and canvasManager via options', () => {
            const editorRef = { name: 'myEditor' };
            const canvasMgr = {
                layers: [],
                renderLayers: jest.fn()
            };
            
            const hm = new HistoryManager({ editor: editorRef, canvasManager: canvasMgr, maxHistorySteps: 30 });
            
            expect(hm.canvasManager).toBe(canvasMgr);
            expect(hm.editor).toBe(editorRef);
            expect(hm.maxHistorySteps).toBe(30);
        });
    });

    describe('getEditor edge cases', () => {
        test('should return editor from direct reference', () => {
            const editor = { name: 'directEditor' };
            const hm = new HistoryManager({ editor: { stateManager: {} } });
            hm.editor = editor;
            
            expect(hm.getEditor()).toBe(editor);
        });

        test('should return editor from canvasManager.editor', () => {
            const editorRef = { name: 'indirectEditor' };
            const canvasManagerWithEditor = {
                layers: [],
                editor: editorRef
            };
            const hm = new HistoryManager({ canvasManager: canvasManagerWithEditor });
            
            // getEditor finds editor via canvasManager.editor
            expect(hm.getEditor()).toBe(editorRef);
        });

        test('should return editor when passed explicitly with canvasManager', () => {
            const editorRef = { name: 'explicitEditor', stateManager: { get: jest.fn() } };
            const hm = new HistoryManager({ editor: editorRef });
            
            expect(hm.getEditor()).toBe(editorRef);
        });

        test('should return null when no editor references available', () => {
            const hm = new HistoryManager({ maxHistorySteps: 10 });
            
            expect(hm.getEditor()).toBeNull();
        });
    });

    describe('getCanvasManager edge cases', () => {
        test('should return canvasManager from editor.canvasManager', () => {
            const innerCanvasManager = { canvas: document.createElement('canvas') };
            const editor = { canvasManager: innerCanvasManager };
            const hm = new HistoryManager({ editor: { stateManager: {} } });
            hm.editor = editor;
            
            expect(hm.getCanvasManager()).toBe(innerCanvasManager);
        });

        test('should return canvasManager when it has canvas property', () => {
            const canvasMgr = {
                layers: [],
                canvas: document.createElement('canvas')
            };
            const hm = new HistoryManager({ canvasManager: canvasMgr });
            
            expect(hm.getCanvasManager()).toBe(canvasMgr);
        });

        test('should fallback to stored canvasManager without canvas', () => {
            const simpleMock = { layers: [] };
            const hm = new HistoryManager({ canvasManager: simpleMock });
            
            expect(hm.getCanvasManager()).toBe(simpleMock);
        });
    });

    describe('updateUndoRedoButtons with toolbar.updateUndoRedoState', () => {
        test('should call toolbar.updateUndoRedoState when available', () => {
            const mockUpdateUndoRedoState = jest.fn();
            const editor = {
                layers: [{ id: '1', type: 'rect', x: 0, y: 0, width: 50, height: 50 }],
                stateManager: {
                    get: jest.fn().mockReturnValue([{ id: '1', type: 'rect', x: 0, y: 0, width: 50, height: 50 }]),
                    set: jest.fn()
                },
                toolbar: {
                    updateUndoRedoState: mockUpdateUndoRedoState
                }
            };
            
            const hm = new HistoryManager({ editor: editor });
            hm.saveState('test');
            
            expect(mockUpdateUndoRedoState).toHaveBeenCalledWith(false, false);
        });
    });

    describe('cancelBatch with different restoration paths', () => {
        test('should restore via stateManager.set when available', () => {
            const mockSet = jest.fn();
            const editor = {
                layers: [{ id: '1', type: 'rect', x: 10, y: 10, width: 50, height: 50 }],
                stateManager: {
                    get: jest.fn().mockReturnValue([{ id: '1', type: 'rect', x: 10, y: 10, width: 50, height: 50 }]),
                    set: mockSet
                }
            };
            
            const hm = new HistoryManager({ editor: editor });
            hm.startBatch('test batch');
            
            // Simulate some changes
            editor.layers[0].x = 100;
            hm.batchChanges.push({ layers: [{ id: '1', type: 'rect', x: 100, y: 10, width: 50, height: 50 }] });
            
            hm.cancelBatch();
            
            // Should have called stateManager.set with the snapshot
            expect(mockSet).toHaveBeenCalledWith('layers', expect.any(Array));
        });

        test('should restore via editor.layers when stateManager not available', () => {
            // Create editor with getLayers function so it's recognized as editor
            // but without stateManager so it uses the else if (editor) branch
            const editor = {
                layers: [{ id: '1', type: 'rect', x: 10, y: 10, width: 50, height: 50 }],
                getLayers: jest.fn().mockReturnValue([{ id: '1', type: 'rect', x: 10, y: 10, width: 50, height: 50 }]),
                canvasManager: {
                    layers: [],
                    renderLayers: jest.fn(),
                    redraw: jest.fn()
                }
            };
            
            const hm = new HistoryManager({ editor: editor });
            hm.startBatch('test batch');
            
            // Simulate changes
            editor.layers[0].x = 200;
            
            hm.cancelBatch();
            
            // Editor layers should be restored to original x=10
            expect(editor.layers[0].x).toBe(10);
        });

        test('should call renderLayers after restoring batch', () => {
            const mockRedraw = jest.fn();
            const mockRenderLayers = jest.fn();
            const canvasMgr = {
                layers: [{ id: '1', type: 'rect', x: 10, y: 10, width: 50, height: 50 }],
                renderLayers: mockRenderLayers,
                redraw: mockRedraw,
                canvas: document.createElement('canvas')
            };
            
            const hm = new HistoryManager({ canvasManager: canvasMgr });
            hm.startBatch('test batch');
            
            // Simulate changes
            canvasMgr.layers[0].x = 300;
            
            hm.cancelBatch();
            
            // renderLayers internally calls redraw(), so only renderLayers should be called
            expect(mockRenderLayers).toHaveBeenCalled();
        });
    });

    describe('compressHistory edge cases', () => {
        test('should not compress when history is at or below half max', () => {
            const canvasMgr = {
                layers: [{ id: '1', type: 'rect', x: 0, y: 0, width: 50, height: 50 }]
            };
            const hm = new HistoryManager({ canvasManager: canvasMgr });
            hm.maxHistorySteps = 10;
            
            // Add only 5 entries (half of max)
            for (let i = 0; i < 5; i++) {
                canvasMgr.layers[0].x = i * 10;
                hm.saveState(`state ${i}`);
            }
            
            expect(hm.history.length).toBe(5);
            
            // Call compressHistory directly
            hm.compressHistory();
            
            // Should remain unchanged since it's at half
            expect(hm.history.length).toBe(5);
        });

        test('should compress when history exceeds half max', () => {
            const canvasMgr = {
                layers: [{ id: '1', type: 'rect', x: 0, y: 0, width: 50, height: 50 }]
            };
            const hm = new HistoryManager({ canvasManager: canvasMgr });
            hm.maxHistorySteps = 10;
            
            // Add 6 entries (more than half of max)
            for (let i = 0; i < 6; i++) {
                canvasMgr.layers[0].x = i * 10;
                hm.saveState(`state ${i}`);
            }
            
            expect(hm.history.length).toBe(6);
            
            // Call compressHistory directly
            hm.compressHistory();
            
            // Should compress to keepCount (5)
            expect(hm.history.length).toBe(5);
        });
    });

    describe('destroy method', () => {
        test('should clear all state and references', () => {
            const canvasMgr = {
                layers: [{ id: '1', type: 'rect', x: 0, y: 0, width: 50, height: 50 }]
            };
            const hm = new HistoryManager({ canvasManager: canvasMgr });
            
            // Add some history
            hm.saveState('state 1');
            hm.saveState('state 2');
            hm.startBatch('batch');
            hm.batchChanges.push({ layers: [] });
            
            expect(hm.history.length).toBe(2);
            expect(hm.canvasManager).toBe(canvasMgr);
            
            // Destroy
            hm.destroy();
            
            expect(hm.history).toEqual([]);
            expect(hm.batchChanges).toEqual([]);
            expect(hm.batchOperations).toEqual([]);
            expect(hm.batchStartSnapshot).toBeNull();
            expect(hm.canvasManager).toBeNull();
            expect(hm.config).toBeNull();
        });

        test('should be safe to call multiple times', () => {
            const canvasMgr = {
                layers: []
            };
            const hm = new HistoryManager({ canvasManager: canvasMgr });
            
            hm.destroy();
            hm.destroy(); // Should not throw
            
            expect(hm.history).toEqual([]);
            expect(hm.canvasManager).toBeNull();
        });
    });

    describe('getEditor additional paths', () => {
        test('should return editor from canvasManager.editor when no direct editor', () => {
            const editorRef = { name: 'editorFromCanvasManager' };
            const canvasMgr = {
                layers: [],
                editor: editorRef
            };
            
            const hm = new HistoryManager({ canvasManager: canvasMgr });
            hm.editor = null; // Ensure no direct editor reference
            
            expect(hm.getEditor()).toBe(editorRef);
        });
    });

    describe('cancelBatch restoration via canvasManager.layers', () => {
        test('should restore via canvasManager.layers when no editor available', () => {
            const canvasMgr = {
                layers: [{ id: '1', type: 'rect', x: 10, y: 10, width: 50, height: 50 }],
                renderLayers: jest.fn(),
                redraw: jest.fn()
            };
            
            const hm = new HistoryManager({ canvasManager: canvasMgr });
            hm.editor = null; // Ensure no editor
            
            hm.startBatch('test batch');
            
            // Simulate changes
            canvasMgr.layers[0].x = 500;
            
            hm.cancelBatch();
            
            // canvasManager.layers should be restored to original x=10
            expect(canvasMgr.layers[0].x).toBe(10);
        });
    });

    describe('isDestroyed guard', () => {
        test('should prevent operations after destroy', () => {
            const canvasMgr = {
                layers: [{ id: '1', type: 'rect', x: 0, y: 0, width: 50, height: 50 }]
            };
            const hm = new HistoryManager({ canvasManager: canvasMgr });
            
            // Add initial state
            hm.saveState('initial');
            expect(hm.history.length).toBe(1);
            
            // Destroy
            hm.destroy();
            expect(hm.isDestroyed).toBe(true);
            
            // Attempt to save state after destroy - should be no-op
            hm.history = []; // Reset to verify no new entries
            hm.saveState('should not save');
            expect(hm.history.length).toBe(0);
        });

        test('should prevent undo after destroy', () => {
            const canvasMgr = {
                layers: [{ id: '1', type: 'rect', x: 0, y: 0, width: 50, height: 50 }]
            };
            const hm = new HistoryManager({ canvasManager: canvasMgr });
            
            hm.saveState('state 1');
            hm.saveState('state 2');
            expect(hm.historyIndex).toBe(1);
            
            hm.destroy();
            
            // Reset history to verify undo doesn't work
            hm.history = [{ layers: [] }, { layers: [] }];
            hm.historyIndex = 1;
            const result = hm.undo();
            
            expect(result).toBe(false);
        });

        test('should prevent redo after destroy', () => {
            const canvasMgr = {
                layers: [{ id: '1', type: 'rect', x: 0, y: 0, width: 50, height: 50 }]
            };
            const hm = new HistoryManager({ canvasManager: canvasMgr });
            
            hm.saveState('state 1');
            hm.saveState('state 2');
            hm.undo();
            expect(hm.historyIndex).toBe(0);
            
            hm.destroy();
            
            // Reset history to verify redo doesn't work
            hm.history = [{ layers: [] }, { layers: [] }];
            hm.historyIndex = 0;
            const result = hm.redo();
            
            expect(result).toBe(false);
        });

        test('should set isDestroyed flag on construction', () => {
            const hm = new HistoryManager({ canvasManager: { layers: [] } });
            expect(hm.isDestroyed).toBe(false);
        });

        test('should clear editor reference on destroy', () => {
            const editor = { stateManager: { getLayers: () => [] } };
            const hm = new HistoryManager({ editor: editor });
            expect(hm.editor).toBe(editor);
            
            hm.destroy();
            expect(hm.editor).toBeNull();
        });
    });

    describe('_getCloneLayersEfficient', () => {
        test('should return null when window.Layers is not defined', () => {
            const originalLayers = window.Layers;
            delete window.Layers;
            
            const hm = new HistoryManager({ canvasManager: { layers: [] } });
            expect(hm._getCloneLayersEfficient()).toBeNull();
            
            window.Layers = originalLayers;
        });

        test('should return null when window.Layers.Utils is not defined', () => {
            const originalLayers = window.Layers;
            window.Layers = {};
            
            const hm = new HistoryManager({ canvasManager: { layers: [] } });
            expect(hm._getCloneLayersEfficient()).toBeNull();
            
            window.Layers = originalLayers;
        });

        test('should return null when cloneLayersEfficient is not a function', () => {
            const originalLayers = window.Layers;
            window.Layers = { Utils: { cloneLayersEfficient: 'not a function' } };
            
            const hm = new HistoryManager({ canvasManager: { layers: [] } });
            expect(hm._getCloneLayersEfficient()).toBeNull();
            
            window.Layers = originalLayers;
        });

        test('should return cloneLayersEfficient when available', () => {
            const originalLayers = window.Layers;
            const mockCloneFn = jest.fn();
            window.Layers = { Utils: { cloneLayersEfficient: mockCloneFn } };
            
            const hm = new HistoryManager({ canvasManager: { layers: [] } });
            expect(hm._getCloneLayersEfficient()).toBe(mockCloneFn);
            
            window.Layers = originalLayers;
        });
    });

    describe('getLayersSnapshot', () => {
        test('should use cloneLayersEfficient when available', () => {
            const originalLayers = window.Layers;
            const clonedLayers = [{ id: 'cloned' }];
            const mockCloneFn = jest.fn().mockReturnValue(clonedLayers);
            window.Layers = { Utils: { cloneLayersEfficient: mockCloneFn } };
            
            const testLayers = [{ id: '1', type: 'rect' }];
            const hm = new HistoryManager({ canvasManager: { layers: testLayers } });
            const snapshot = hm.getLayersSnapshot();
            
            expect(mockCloneFn).toHaveBeenCalledWith(testLayers);
            expect(snapshot).toBe(clonedLayers);
            
            window.Layers = originalLayers;
        });

        test('should fall back to JSON cloning when cloneLayersEfficient is not available', () => {
            const originalLayers = window.Layers;
            delete window.Layers;
            
            const testLayers = [{ id: '1', type: 'rect', x: 100 }];
            const hm = new HistoryManager({ canvasManager: { layers: testLayers } });
            const snapshot = hm.getLayersSnapshot();
            
            // Should be a deep copy
            expect(snapshot).toEqual(testLayers);
            expect(snapshot).not.toBe(testLayers);
            expect(snapshot[0]).not.toBe(testLayers[0]);
            
            window.Layers = originalLayers;
        });

        test('should handle empty layers array', () => {
            const originalLayers = window.Layers;
            delete window.Layers;
            
            const hm = new HistoryManager({ canvasManager: { layers: [] } });
            const snapshot = hm.getLayersSnapshot();
            
            expect(snapshot).toEqual([]);
            
            window.Layers = originalLayers;
        });

        test('should handle undefined layers by returning empty array', () => {
            const originalLayers = window.Layers;
            delete window.Layers;
            
            const hm = new HistoryManager({ canvasManager: { layers: undefined } });
            const snapshot = hm.getLayersSnapshot();
            
            expect(snapshot).toEqual([]);
            
            window.Layers = originalLayers;
        });
    });

    // CORE-2 FIX: Tests for efficient layer comparison and markAsSaved
    describe('layersEqual (CORE-2)', () => {
        test('should return true for identical layer arrays', () => {
            const layers1 = [
                { id: '1', type: 'rectangle', x: 10, y: 20 },
                { id: '2', type: 'text', x: 30, y: 40, text: 'Hello' }
            ];
            const layers2 = [
                { id: '1', type: 'rectangle', x: 10, y: 20 },
                { id: '2', type: 'text', x: 30, y: 40, text: 'Hello' }
            ];
            
            expect(historyManager.layersEqual(layers1, layers2)).toBe(true);
        });

        test('should return false for different layer counts', () => {
            const layers1 = [{ id: '1', x: 10 }];
            const layers2 = [{ id: '1', x: 10 }, { id: '2', x: 20 }];
            
            expect(historyManager.layersEqual(layers1, layers2)).toBe(false);
        });

        test('should return false for different property values', () => {
            const layers1 = [{ id: '1', x: 10 }];
            const layers2 = [{ id: '1', x: 999 }];
            
            expect(historyManager.layersEqual(layers1, layers2)).toBe(false);
        });

        test('should use reference comparison for src property (image data)', () => {
            const largeBase64 = 'data:image/png;base64,' + 'A'.repeat(100000);
            const layers1 = [{ id: '1', type: 'image', src: largeBase64 }];
            const layers2 = [{ id: '1', type: 'image', src: largeBase64 }]; // Same reference
            
            expect(historyManager.layersEqual(layers1, layers2)).toBe(true);
        });

        test('should use reference comparison for path property (SVG data)', () => {
            const svgPath = 'M0,0 L100,100 Z'.repeat(1000);
            const layers1 = [{ id: '1', type: 'customShape', path: svgPath }];
            const layers2 = [{ id: '1', type: 'customShape', path: svgPath }];
            
            expect(historyManager.layersEqual(layers1, layers2)).toBe(true);
        });

        test('should compare points arrays correctly', () => {
            const layers1 = [{ id: '1', type: 'path', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }];
            const layers2 = [{ id: '1', type: 'path', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }];
            
            expect(historyManager.layersEqual(layers1, layers2)).toBe(true);
        });

        test('should detect different points arrays', () => {
            const layers1 = [{ id: '1', type: 'path', points: [{ x: 0, y: 0 }] }];
            const layers2 = [{ id: '1', type: 'path', points: [{ x: 0, y: 999 }] }];
            
            expect(historyManager.layersEqual(layers1, layers2)).toBe(false);
        });

        test('should handle null/undefined inputs', () => {
            expect(historyManager.layersEqual(null, null)).toBe(true);
            expect(historyManager.layersEqual(null, [])).toBe(false);
            expect(historyManager.layersEqual([], null)).toBe(false);
        });

        test('should compare children arrays for groups', () => {
            const layers1 = [{ id: '1', type: 'group', children: ['a', 'b'] }];
            const layers2 = [{ id: '1', type: 'group', children: ['a', 'b'] }];
            
            expect(historyManager.layersEqual(layers1, layers2)).toBe(true);
        });

        test('should detect different children arrays', () => {
            const layers1 = [{ id: '1', type: 'group', children: ['a', 'b'] }];
            const layers2 = [{ id: '1', type: 'group', children: ['a', 'c'] }];
            
            expect(historyManager.layersEqual(layers1, layers2)).toBe(false);
        });
    });

    describe('markAsSaved (CORE-2)', () => {
        test('should set lastSaveHistoryIndex to current historyIndex', () => {
            historyManager.saveState('State 1');
            historyManager.saveState('State 2');
            
            expect(historyManager.lastSaveHistoryIndex).toBe(-1);
            
            historyManager.markAsSaved();
            
            expect(historyManager.lastSaveHistoryIndex).toBe(historyManager.historyIndex);
        });

        test('should make hasUnsavedChanges return false after marking as saved', () => {
            // Initial save
            historyManager.saveState('State 1');
            
            // Modify layers to create actual change
            mockLayers[0].x = 50;
            historyManager.saveState('State 2');
            
            // Before marking as saved, changes exist relative to initial state
            expect(historyManager.hasUnsavedChanges()).toBe(true);
            
            historyManager.markAsSaved();
            
            // After marking as saved, no unsaved changes (current matches saved)
            expect(historyManager.hasUnsavedChanges()).toBe(false);
        });

        test('should detect changes after undo from saved state', () => {
            // Initial save
            historyManager.saveState('State 1');
            
            // Modify layers to create actual change
            mockLayers[0].x = 50;
            historyManager.saveState('State 2');
            historyManager.markAsSaved();
            
            expect(historyManager.hasUnsavedChanges()).toBe(false);
            
            // Undo reverts layers and changes historyIndex
            historyManager.undo();
            
            // After undo, historyIndex differs from lastSaveHistoryIndex
            expect(historyManager.hasUnsavedChanges()).toBe(true);
        });
    });

    describe('saveInitialState lastSaveHistoryIndex (CORE-2)', () => {
        test('should set lastSaveHistoryIndex after saveInitialState', () => {
            historyManager.saveInitialState();
            
            expect(historyManager.lastSaveHistoryIndex).toBe(0);
        });

        test('should make hasUnsavedChanges return false after saveInitialState', () => {
            historyManager.saveInitialState();
            
            expect(historyManager.hasUnsavedChanges()).toBe(false);
        });
    });

    describe('undo/redo defensive bounds check (CORE-9)', () => {
        test('undo should handle corrupted history gracefully', () => {
            historyManager.saveState('State 1');
            historyManager.saveState('State 2');
            
            // Corrupt the history by removing an entry
            historyManager.history[0] = undefined;
            historyManager.historyIndex = 1;
            
            // undo should not crash, should return false
            const result = historyManager.undo();
            
            expect(result).toBe(false);
            // Index should be restored to 1
            expect(historyManager.historyIndex).toBe(1);
        });

        test('redo should handle corrupted history gracefully', () => {
            historyManager.saveState('State 1');
            historyManager.saveState('State 2');
            historyManager.undo();
            
            // Corrupt the history by removing the next entry
            historyManager.history[1] = undefined;
            
            // redo should not crash, should return false
            const result = historyManager.redo();
            
            expect(result).toBe(false);
            // Index should be restored to 0
            expect(historyManager.historyIndex).toBe(0);
        });

        test('undo should work normally when history is valid', () => {
            historyManager.saveState('State 1');
            mockLayers[0].x = 100;
            historyManager.saveState('State 2');
            
            expect(historyManager.historyIndex).toBe(1);
            
            const result = historyManager.undo();
            
            expect(result).toBe(true);
            expect(historyManager.historyIndex).toBe(0);
        });

        test('redo should work normally when history is valid', () => {
            historyManager.saveState('State 1');
            mockLayers[0].x = 100;
            historyManager.saveState('State 2');
            historyManager.undo();
            
            expect(historyManager.historyIndex).toBe(0);
            
            const result = historyManager.redo();
            
            expect(result).toBe(true);
            expect(historyManager.historyIndex).toBe(1);
        });
    });
});
