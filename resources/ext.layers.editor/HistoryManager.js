/**
 * History Manager for Layers Editor
 * Handles undo/redo functionality
 */
( function () {
	'use strict';

	/**
	 * Minimal typedef for CanvasManager used for JSDoc references in this file.
	 *
	 * @typedef {Object} CanvasManager
	 * @property {HTMLCanvasElement} canvas
	 * @property {CanvasRenderingContext2D} ctx
	 */

	/**
	 * HistoryManager class
	 *
	 * @class
	 */
	class HistoryManager {
		/**
		 * @param {Object} config Configuration object or editor/canvasManager reference
		 * @param {CanvasManager} canvasManager Reference to the canvas manager (optional)
		 */
		constructor( config, canvasManager ) {
			// Normalize arguments - support multiple calling conventions:
			// 1. new HistoryManager(editor) - editor passed as first arg
			// 2. new HistoryManager(config, canvasManager) - traditional
			// 3. new HistoryManager(canvasManager) - canvasManager as first arg
			// 4. new HistoryManager(objectWithLayers) - object with layers array

			// Detect if first arg is an editor (has stateManager, toolbar, etc.)
			// Also check for filename + containerElement which are set early in LayersEditor
			const isEditor = config && (
				config.stateManager ||
				config.toolbar ||
				( typeof config.getLayers === 'function' ) ||
				( config.filename && config.containerElement )
			);

			// Detect if first arg is a canvasManager (has canvas, ctx, editor, etc.)
			const isCanvasManager = config && !isEditor && (
				config.canvas ||
				config.ctx ||
				( config.editor && config.editor.layers )
			);

			// Detect if first arg is an object with layers (legacy/test usage)
			const hasLayers = config && !isEditor && !isCanvasManager &&
				Array.isArray( config.layers );

			if ( isEditor ) {
				// Editor passed directly - store reference
				this.editor = config;
				this.canvasManager = config.canvasManager || null;
				this.config = {};
			} else if ( isCanvasManager ) {
				// CanvasManager passed as first arg
				this.canvasManager = config;
				this.editor = config.editor || null;
				this.config = {};
			} else if ( hasLayers ) {
				// Object with layers (legacy/test pattern) - treat as canvasManager-like
				this.canvasManager = config;
				this.editor = config.editor || null;
				this.config = {};
			} else if ( canvasManager ) {
				// Traditional (config, canvasManager) signature
				this.config = config || {};
				this.canvasManager = canvasManager;
				this.editor = canvasManager.editor || null;
			} else {
				// Plain config object
				this.config = config || {};
				this.canvasManager = null;
				this.editor = null;
			}

			// History state
			this.history = [];
			this.historyIndex = -1;
			this.maxHistorySteps = this.config.maxHistorySteps || 50;
			// Backward-compat properties expected by legacy tests
			Object.defineProperty( this, 'currentIndex', {
				get: () => this.historyIndex
			} );
			Object.defineProperty( this, 'maxHistorySize', {
				get: () => this.maxHistorySteps,
				set: ( v ) => {
					this.setMaxHistorySteps( v );
				}
			} );

			// Batch operations
			this.batchMode = false;
			this.batchChanges = [];
			// Alias array used in older tests (must reference the same array)
			this.batchOperations = this.batchChanges;
			this.batchStartSnapshot = null;
		}

		/**
		 * Get the editor reference (handles both direct and via canvasManager)
		 * @private
		 * @return {Object|null} Editor reference
		 */
		getEditor() {
			if ( this.editor ) {
				return this.editor;
			}
			if ( this.canvasManager && this.canvasManager.editor ) {
				return this.canvasManager.editor;
			}
			// Check if canvasManager has stateManager (meaning it IS the editor)
			if ( this.canvasManager && this.canvasManager.stateManager ) {
				return this.canvasManager;
			}
			return null;
		}

		/**
		 * Get the canvas manager reference
		 * @private
		 * @return {Object|null} CanvasManager reference
		 */
		getCanvasManager() {
			// First, check if editor has canvasManager
			const editor = this.getEditor();
			if ( editor && editor.canvasManager ) {
				return editor.canvasManager;
			}
			// Then check direct canvasManager reference
			if ( this.canvasManager && this.canvasManager.canvas ) {
				return this.canvasManager;
			}
			// Fallback to stored canvasManager (may be a mock or simplified object)
			if ( this.canvasManager ) {
				return this.canvasManager;
			}
			return null;
		}

		/**
		 * Save current state to history
		 *
		 * @param {string} description Optional description of the change
		 */
		saveState( description ) {
			if ( this.batchMode ) {
				this.batchChanges.push( {
					layers: this.getLayersSnapshot(),
					description: description || 'Batch change',
					timestamp: Date.now()
				} );
				// Keep alias in sync
				this.batchOperations = this.batchChanges;
				return;
			}

			// Remove any future history if we're not at the end
			// When saving after an undo, truncate all redo entries
			if ( this.historyIndex < this.history.length - 1 ) {
				// Keep only entries up to and including current position
				this.history = this.history.slice( 0, this.historyIndex + 1 );
			}

			// Add new state
			const snapshot = this.getLayersSnapshot();
			const state = {
				layers: snapshot,
				description: description || 'Edit',
				timestamp: Date.now()
			};

			this.history.push( state );

			// Trim history if it exceeds max size
			if ( this.history.length > this.maxHistorySteps ) {
				this.history.shift();
			}

			// Always point to the most recently saved state
			this.historyIndex = this.history.length - 1;

			this.updateUndoRedoButtons();
		}

		/**
		 * Get snapshot of current layers
		 *
		 * @return {Array} Deep copy of layers array
		 */
		getLayersSnapshot() {
			const editor = this.getEditor();
			let layers = [];

			if ( editor && editor.stateManager && typeof editor.stateManager.getLayers === 'function' ) {
				layers = editor.stateManager.getLayers();
			} else if ( editor && editor.layers ) {
				layers = editor.layers;
			} else if ( this.canvasManager && this.canvasManager.layers ) {
				layers = this.canvasManager.layers;
			}

			return JSON.parse( JSON.stringify( layers || [] ) );
		}

		/**
		 * Undo last action
		 *
		 * @return {boolean} True if undo was performed
		 */
		undo() {
			if ( !this.canUndo() ) {
				return false;
			}

			this.historyIndex--;
			const state = this.history[ this.historyIndex ];
			this.restoreState( state );
			this.updateUndoRedoButtons();

			return true;
		}

		/**
		 * Redo next action
		 *
		 * @return {boolean} True if redo was performed
		 */
		redo() {
			if ( !this.canRedo() ) {
				return false;
			}

			this.historyIndex++;
			this.restoreState( this.history[ this.historyIndex ] );
			this.updateUndoRedoButtons();

			return true;
		}

		/**
		 * Check if undo is available
		 *
		 * @return {boolean} True if can undo
		 */
		canUndo() {
			return this.historyIndex > 0;
		}

		/**
		 * Check if redo is available
		 *
		 * @return {boolean} True if can redo
		 */
		canRedo() {
			return this.historyIndex < this.history.length - 1;
		}

		/**
		 * Restore state from history
		 *
		 * @param {Object} state State object to restore
		 */
		restoreState( state ) {
			// Restore layers to either editor.layers or canvasManager.layers
			const restored = JSON.parse( JSON.stringify( state.layers ) );

			const editor = this.getEditor();
			const canvasMgr = this.getCanvasManager();

			// Restore layers via StateManager
			if ( editor && editor.stateManager ) {
				editor.stateManager.set( 'layers', restored );
			} else if ( editor ) {
				editor.layers = restored;
			} else if ( this.canvasManager ) {
				this.canvasManager.layers = restored;
			}

			// Clear selections
			if ( canvasMgr && canvasMgr.selectionManager ) {
				canvasMgr.selectionManager.clearSelection();
			} else if ( canvasMgr ) {
				// Fallback for legacy code
				canvasMgr.selectedLayerId = null;
				canvasMgr.selectedLayerIds = [];
			}

			// Re-render using the restored layers directly
			// NOTE: renderLayers internally calls redraw(), so we only call one
			if ( canvasMgr && typeof canvasMgr.renderLayers === 'function' ) {
				canvasMgr.renderLayers( restored );
			}

			// Update layer panel directly without going through StateManager again
			// (we already set layers via stateManager.set above, so this avoids double-update)
			if ( editor && editor.layerPanel &&
				typeof editor.layerPanel.renderLayerList === 'function' ) {
				editor.layerPanel.renderLayerList();
			}

			// Mark editor as dirty (when available)
			if ( editor && typeof editor.markDirty === 'function' ) {
				editor.markDirty();
			}
		}

		/**
		 * Update undo/redo button states
		 */
		updateUndoRedoButtons() {
			const canUndo = this.canUndo();
			const canRedo = this.canRedo();
			const editor = this.getEditor();

			// Update toolbar buttons if available
			if ( editor && editor.toolbar && editor.toolbar.container ) {
				// Try both old and new selector patterns for compatibility
				const undoBtn = editor.toolbar.container.querySelector( '[data-action="undo"]' ) ||
					editor.toolbar.container.querySelector( '.undo-btn' );
				const redoBtn = editor.toolbar.container.querySelector( '[data-action="redo"]' ) ||
					editor.toolbar.container.querySelector( '.redo-btn' );

				if ( undoBtn ) {
					undoBtn.disabled = !canUndo;
					undoBtn.title = canUndo && this.historyIndex > 0 && this.history[ this.historyIndex - 1 ] ?
						'Undo: ' + this.history[ this.historyIndex - 1 ].description :
						'Nothing to undo';
				}

				if ( redoBtn ) {
					redoBtn.disabled = !canRedo;
					redoBtn.title = canRedo && this.history[ this.historyIndex + 1 ] ?
						'Redo: ' + this.history[ this.historyIndex + 1 ].description :
						'Nothing to redo';
				}
			}

			// Also try the toolbar.updateUndoRedoState method if available
			if ( editor && editor.toolbar && typeof editor.toolbar.updateUndoRedoState === 'function' ) {
				editor.toolbar.updateUndoRedoState( canUndo, canRedo );
			}

			// Update status
			if ( editor && typeof editor.updateStatus === 'function' ) {
				editor.updateStatus( {
					canUndo: canUndo,
					canRedo: canRedo,
					historyPosition: this.historyIndex + 1,
					historySize: this.history.length
				} );
			}
		}

		/**
		 * Start batch mode for grouped operations
		 *
		 * @param {string} description Description for the batch operation
		 */
		startBatch( description ) {
			this.batchMode = true;
			this.batchDescription = description || 'Batch operation';
			this.batchChanges = [];
			this.batchOperations = this.batchChanges;
			// Snapshot current state to allow cancel
			this.batchStartSnapshot = this.getLayersSnapshot();
		}

		/**
		 * End batch mode and save as single history entry
		 */
		endBatch() {
			if ( !this.batchMode || this.batchChanges.length === 0 ) {
				this.batchMode = false;
				this.batchChanges = [];
				this.batchOperations = this.batchChanges;
				return;
			}

			// Save final state as single history entry
			this.batchMode = false;
			this.saveState( this.batchDescription );
			this.batchChanges = [];
			this.batchOperations = this.batchChanges;
			this.batchStartSnapshot = null;
		}

		/**
		 * Cancel batch mode without saving
		 */
		cancelBatch() {
			// Revert to snapshot from start of batch if available
			if ( this.batchStartSnapshot ) {
				const snapshot = JSON.parse( JSON.stringify( this.batchStartSnapshot ) );
				const editor = this.getEditor();
				const canvasMgr = this.getCanvasManager();

				if ( editor && editor.stateManager ) {
					editor.stateManager.set( 'layers', snapshot );
				} else if ( editor ) {
					editor.layers = snapshot;
				} else if ( this.canvasManager ) {
					this.canvasManager.layers = snapshot;
				}

				const layers = editor ? editor.layers : ( this.canvasManager && this.canvasManager.layers ) || [];
				if ( canvasMgr && typeof canvasMgr.renderLayers === 'function' ) {
					canvasMgr.renderLayers( layers );
				}
				if ( canvasMgr && typeof canvasMgr.redraw === 'function' ) {
					canvasMgr.redraw();
				}
			}
			this.batchMode = false;
			this.batchChanges = [];
			this.batchOperations = this.batchChanges;
			this.batchStartSnapshot = null;
		}

		/**
		 * Clear all history
		 */
		clearHistory() {
			this.history = [];
			this.historyIndex = -1;
			this.updateUndoRedoButtons();
		}

		// Backward-compat aliases for older tests
		clear() {
			this.clearHistory();
		}

		commitBatch() {
			this.endBatch();
		}

		getCurrentStateDescription() {
			return this.historyIndex >= 0 && this.history[ this.historyIndex ] ?
				this.history[ this.historyIndex ].description : 'No history';
		}

		/**
		 * Get history information
		 *
		 * @return {Object} History information
		 */
		getHistoryInfo() {
			return {
				totalSteps: this.history.length,
				currentStep: this.historyIndex + 1,
				canUndo: this.canUndo(),
				canRedo: this.canRedo(),
				maxSteps: this.maxHistorySteps,
				batchMode: this.batchMode
			};
		}

		/**
		 * Get history entries for UI display
		 *
		 * @param {number} limit Maximum number of entries to return
		 * @return {Array} Array of history entries
		 */
		getHistoryEntries( limit ) {
			limit = limit || 10;
			const start = Math.max( 0, this.history.length - limit );

			return this.history.slice( start ).map( ( entry, index ) => {
				const actualIndex = start + index;
				return {
					index: actualIndex,
					description: entry.description,
					timestamp: entry.timestamp,
					isCurrent: actualIndex === this.historyIndex,
					canRevertTo: actualIndex <= this.historyIndex
				};
			} );
		}

		/**
		 * Revert to specific history entry
		 *
		 * @param {number} targetIndex Index to revert to
		 * @return {boolean} True if revert was successful
		 */
		revertTo( targetIndex ) {
			if (
				targetIndex < 0 ||
				targetIndex >= this.history.length ||
				targetIndex > this.historyIndex
			) {
				return false;
			}

			this.historyIndex = targetIndex;
			this.restoreState( this.history[ this.historyIndex ] );
			this.updateUndoRedoButtons();

			return true;
		}

		/**
		 * Compress history to save memory
		 */
		compressHistory() {
			if ( this.history.length <= this.maxHistorySteps / 2 ) {
				return;
			}

			// Keep recent half of history
			const keepCount = Math.floor( this.maxHistorySteps / 2 );
			const removeCount = this.history.length - keepCount;

			this.history = this.history.slice( removeCount );
			this.historyIndex = Math.max( 0, this.historyIndex - removeCount );

			this.updateUndoRedoButtons();
		}

		/**
		 * Set maximum history steps
		 *
		 * @param {number} maxSteps Maximum number of history steps
		 */
		setMaxHistorySteps( maxSteps ) {
			this.maxHistorySteps = Math.max( 1, maxSteps );

			// Trim current history if needed
			if ( this.history.length > this.maxHistorySteps ) {
				const removeCount = this.history.length - this.maxHistorySteps;
				this.history = this.history.slice( removeCount );
				this.historyIndex = Math.max( 0, this.historyIndex - removeCount );
				this.updateUndoRedoButtons();
			}
		}

		/**
		 * Check if current state differs from last saved state
		 *
		 * @return {boolean} True if state has changed
		 */
		hasUnsavedChanges() {
			const editor = this.getEditor();

			if ( this.history.length === 0 ) {
				const initialLayers = editor ? editor.layers : ( this.canvasManager && this.canvasManager.layers ) || [];
				return initialLayers.length > 0;
			}

			const currentLayers = this.getLayersSnapshot();
			const lastSavedLayers = this.history[ this.historyIndex ].layers;

			return JSON.stringify( currentLayers ) !== JSON.stringify( lastSavedLayers );
		}

		/**
		 * Save initial state - clears history and saves current layers as baseline.
		 * Called after layers are loaded from API to establish undo baseline.
		 */
		saveInitialState() {
			this.clearHistory();
			this.saveState( 'Initial state' );
		}

		/**
		 * Export history for debugging
		 *
		 * @return {Object} History export
		 */
		exportHistory() {
			return {
				history: this.history.map( ( entry ) => ( {
					description: entry.description,
					timestamp: entry.timestamp,
					layerCount: entry.layers.length
				} ) ),
				historyIndex: this.historyIndex,
				maxHistorySteps: this.maxHistorySteps,
				batchMode: this.batchMode
			};
		}

		/**
		 * Get memory usage estimate
		 *
		 * @return {Object} Memory usage information
		 */
		getMemoryUsage() {
			let totalSize = 0;
			const layerCounts = [];

			this.history.forEach( ( entry ) => {
				const serialized = JSON.stringify( entry );
				totalSize += serialized.length;
				layerCounts.push( entry.layers.length );
			} );

			// Return a single number for legacy tests (estimated bytes)
			return totalSize;
		}

		/**
		 * Clean up resources and clear state
		 */
		destroy() {
			// Clear history
			this.clearHistory();
			this.history = [];
			this.batchChanges = [];
			this.batchOperations = [];
			this.batchStartSnapshot = null;

			// Clear references
			this.canvasManager = null;
			this.config = null;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.HistoryManager = HistoryManager;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = HistoryManager;
	}

}() );
