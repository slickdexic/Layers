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
});
