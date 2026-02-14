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
		 * @param {Object} [options={}] Configuration options
		 * @param {Object} [options.editor] Editor reference
		 * @param {CanvasManager} [options.canvasManager] Canvas manager reference
		 * @param {number} [options.maxHistorySteps=50] Maximum history steps
		 */
		constructor( options = {} ) {
			this.editor = options.editor || null;
			this.canvasManager = options.canvasManager ||
				( this.editor && this.editor.canvasManager ) || null;
			this.config = {};

			// History state
			this.history = [];
			this.historyIndex = -1;
			this.maxHistorySteps = options.maxHistorySteps || 50;
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

			// Track which history index corresponds to last save (CORE-2 fix)
			// -1 means no save has been made yet
			this.lastSaveHistoryIndex = -1;

			// Destruction flag - prevents operations after cleanup
			this.isDestroyed = false;
		}

		/**
		 * Get the editor reference
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
			return null;
		}

		/**
		 * Get the canvas manager reference
		 * @private
		 * @return {Object|null} CanvasManager reference
		 */
		getCanvasManager() {
			const editor = this.getEditor();
			if ( editor && editor.canvasManager ) {
				return editor.canvasManager;
			}
			return this.canvasManager || null;
		}

		/**
		 * Save current state to history
		 *
		 * @param {string} description Optional description of the change
		 */
		saveState( description ) {
			if ( this.isDestroyed ) {
				return;
			}

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
		 * Get efficient cloning utility from namespace
		 *
		 * @private
		 * @return {Function|null} The cloneLayersEfficient function or null
		 */
		_getCloneLayersEfficient() {
			if ( typeof window !== 'undefined' &&
				window.Layers &&
				window.Layers.Utils &&
				typeof window.Layers.Utils.cloneLayersEfficient === 'function' ) {
				return window.Layers.Utils.cloneLayersEfficient;
			}
			return null;
		}

		/**
		 * Get snapshot of current layers
		 *
		 * Uses efficient cloning that preserves references to immutable large data
		 * (image src, SVG path) to avoid expensive JSON serialization of 500KB+ strings.
		 *
		 * @return {Array} Deep copy of layers array (with immutable data by reference)
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

			// Use efficient cloning if available (preserves src/path by reference)
			const cloneLayersEfficient = this._getCloneLayersEfficient();
			if ( cloneLayersEfficient ) {
				return cloneLayersEfficient( layers || [] );
			}

			// P2.4 FIX: Warn about memory-intensive fallback for image layers
			const hasImageLayers = Array.isArray( layers ) &&
				layers.some( layer => layer && layer.type === 'image' && layer.src );
			if ( hasImageLayers && typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[HistoryManager] Using JSON cloning for layers with images - may cause high memory usage. Consider loading DeepClone module.' );
			}

			// Fallback to JSON cloning
			return JSON.parse( JSON.stringify( layers || [] ) );
		}

		/**
		 * Undo last action
		 *
		 * @return {boolean} True if undo was performed
		 */
		undo() {
			if ( this.isDestroyed || !this.canUndo() ) {
				return false;
			}

			this.historyIndex--;
			const state = this.history[ this.historyIndex ];

			// CORE-9 FIX: Defensive bounds check
			if ( !state ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[HistoryManager] undo() - state at index', this.historyIndex, 'is undefined' );
				}
				this.historyIndex++; // Restore index
				return false;
			}

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
			if ( this.isDestroyed || !this.canRedo() ) {
				return false;
			}

			this.historyIndex++;
			const state = this.history[ this.historyIndex ];

			// CORE-9 FIX: Defensive bounds check
			if ( !state ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[HistoryManager] redo() - state at index', this.historyIndex, 'is undefined' );
				}
				this.historyIndex--; // Restore index
				return false;
			}

			this.restoreState( state );
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
			// Restore layers using efficient cloning if available
			const cloneLayersEfficient = this._getCloneLayersEfficient();
			const restored = cloneLayersEfficient ?
				cloneLayersEfficient( state.layers ) :
				JSON.parse( JSON.stringify( state.layers ) );

			const editor = this.getEditor();
			const canvasMgr = this.getCanvasManager();

			// Track whether StateManager is used (determines if we need explicit renderLayerList)
			let usedStateManager = false;

			// Restore layers via StateManager (this triggers the 'layers' listener
			// which already calls renderLayerList(), so we don't call it explicitly)
			if ( editor && editor.stateManager ) {
				editor.stateManager.set( 'layers', restored );
				usedStateManager = true;
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

			// Only call renderLayerList explicitly when StateManager was NOT used.
			// When StateManager IS used, the 'layers' subscription in LayerPanel already
			// triggers renderLayerList(), so calling it again would cause double-update.
			if ( !usedStateManager && editor && editor.layerPanel &&
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
		 * Check if current state differs from last saved state.
		 *
		 * CORE-2 FIX: Uses efficient comparison that avoids serializing large
		 * base64 image data (500KB+ per image). Falls back to layersEqual()
		 * which compares properties individually.
		 *
		 * @return {boolean} True if state has changed
		 */
		hasUnsavedChanges() {
			const editor = this.getEditor();

			if ( this.history.length === 0 ) {
				const initialLayers = editor ? editor.layers : ( this.canvasManager && this.canvasManager.layers ) || [];
				return initialLayers.length > 0;
			}

			// Fast path: if historyIndex matches lastSaveHistoryIndex and
			// no edits have been made since, there are no unsaved changes
			if ( this.lastSaveHistoryIndex >= 0 && this.historyIndex === this.lastSaveHistoryIndex ) {
				return false;
			}

			// Need to compare current state with saved state
			const currentLayers = this.getLayersSnapshot();

			// If we have a saved index, compare against that entry
			if ( this.lastSaveHistoryIndex >= 0 && this.history[ this.lastSaveHistoryIndex ] ) {
				return !this.layersEqual( currentLayers, this.history[ this.lastSaveHistoryIndex ].layers );
			}

			// Fall back to comparing with initial state (index 0)
			const referenceIndex = 0;
			if ( this.history[ referenceIndex ] ) {
				return !this.layersEqual( currentLayers, this.history[ referenceIndex ].layers );
			}

			return true;
		}

		/**
		 * Compare two layer arrays for equality efficiently.
		 *
		 * CORE-2 FIX: For large immutable properties (src, path), uses reference
		 * comparison instead of value comparison since cloneLayersEfficient
		 * preserves these references.
		 *
		 * @param {Array} layers1 - First layers array
		 * @param {Array} layers2 - Second layers array
		 * @return {boolean} True if layers are equal
		 */
		layersEqual( layers1, layers2 ) {
			if ( !Array.isArray( layers1 ) || !Array.isArray( layers2 ) ) {
				return layers1 === layers2;
			}

			if ( layers1.length !== layers2.length ) {
				return false;
			}

			// Properties that are large and immutable - compare by reference
			const immutableProps = [ 'src', 'path' ];

			for ( let i = 0; i < layers1.length; i++ ) {
				const l1 = layers1[ i ];
				const l2 = layers2[ i ];

				// Get all keys from both objects
				const keys1 = Object.keys( l1 || {} );
				const keys2 = Object.keys( l2 || {} );

				// Quick length check
				if ( keys1.length !== keys2.length ) {
					return false;
				}

				// Compare each key
				for ( const key of keys1 ) {
					const v1 = l1[ key ];
					const v2 = l2[ key ];

					// For immutable large props, reference equality is sufficient
					if ( immutableProps.includes( key ) ) {
						if ( v1 !== v2 ) {
							return false;
						}
					} else if ( key === 'points' && Array.isArray( v1 ) && Array.isArray( v2 ) ) {
						// Points array - compare length and values
						if ( v1.length !== v2.length ) {
							return false;
						}
						for ( let j = 0; j < v1.length; j++ ) {
							if ( v1[ j ].x !== v2[ j ].x || v1[ j ].y !== v2[ j ].y ) {
								return false;
							}
						}
					} else if ( key === 'children' && Array.isArray( v1 ) && Array.isArray( v2 ) ) {
						// Children array (for groups) - compare by JSON
						if ( JSON.stringify( v1 ) !== JSON.stringify( v2 ) ) {
							return false;
						}
					} else if ( v1 !== null && typeof v1 === 'object' ) {
						// Other objects - use JSON comparison (these are typically small)
						if ( JSON.stringify( v1 ) !== JSON.stringify( v2 ) ) {
							return false;
						}
					} else {
						// Primitives
						if ( v1 !== v2 ) {
							return false;
						}
					}
				}
			}

			return true;
		}

		/**
		 * Save initial state - clears history and saves current layers as baseline.
		 * Called after layers are loaded from API to establish undo baseline.
		 */
		saveInitialState() {
			this.clearHistory();
			this.saveState( 'Initial state' );
			// Mark initial state as saved (CORE-2 fix)
			this.lastSaveHistoryIndex = this.historyIndex;
		}

		/**
		 * Mark current history state as saved.
		 * Called by APIManager after successful save to API.
		 * CORE-2 FIX: Enables efficient hasUnsavedChanges() check.
		 */
		markAsSaved() {
			this.lastSaveHistoryIndex = this.historyIndex;
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
			// Mark as destroyed to prevent further operations
			this.isDestroyed = true;

			// Clear history
			this.clearHistory();
			this.history = [];
			this.batchChanges = [];
			this.batchOperations = [];
			this.batchStartSnapshot = null;

			// Clear references
			this.canvasManager = null;
			this.config = null;
			this.editor = null;
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
