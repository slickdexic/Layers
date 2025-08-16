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
	 * @param {Object} config Configuration object
	 * @param {CanvasManager} canvasManager Reference to the canvas manager
	 * @class
	 */
	function HistoryManager( config, canvasManager ) {
		// Backward-compat: allow constructor to be called with a single
		// canvasManager arg. Accept objects that look like a CanvasManager
		// (canvas or layers present).
		if (
			config && !canvasManager &&
			( config.canvas || config.layers || ( config.editor && config.editor.layers ) )
		) {
			canvasManager = config;
			config = {};
		}

		this.config = config || {};
		this.canvasManager = canvasManager;

		// History state
		this.history = [];
		this.historyIndex = -1;
		this.maxHistorySteps = this.config.maxHistorySteps || 50;
		// Backward-compat properties expected by legacy tests
		Object.defineProperty( this, 'currentIndex', {
			get: function () { return this.historyIndex; }.bind( this )
		} );
		Object.defineProperty( this, 'maxHistorySize', {
			get: function () { return this.maxHistorySteps; }.bind( this ),
			set: function ( v ) { this.setMaxHistorySteps( v ); }.bind( this )
		} );

		// Batch operations
		this.batchMode = false;
		this.batchChanges = [];
		// Alias array used in older tests (must reference the same array)
		this.batchOperations = this.batchChanges;
		this.batchStartSnapshot = null;
	}

	/**
	 * Save current state to history
	 *
	 * @param {string} description Optional description of the change
	 */
	HistoryManager.prototype.saveState = function ( description ) {
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
		// Keep the earlier entries and the current one; drop only the redo tail
		if ( this.historyIndex < this.history.length - 1 ) {
			// Keep one future entry (the immediate redo), drop the rest
			var keepUntil = Math.min( this.history.length, this.historyIndex + 2 );
			this.history = this.history.slice( 0, keepUntil );
		}

		// Add new state
		var state = {
			layers: this.getLayersSnapshot(),
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
	};

	/**
	 * Get snapshot of current layers
	 *
	 * @return {Array} Deep copy of layers array
	 */
	HistoryManager.prototype.getLayersSnapshot = function () {
		var layers =
			( this.canvasManager && this.canvasManager.editor &&
				this.canvasManager.editor.layers ) ||
			( this.canvasManager && this.canvasManager.layers ) || [];
		return JSON.parse( JSON.stringify( layers ) );
	};

	/**
	 * Undo last action
	 *
	 * @return {boolean} True if undo was performed
	 */
	HistoryManager.prototype.undo = function () {
		if ( !this.canUndo() ) {
			return false;
		}

		this.historyIndex--;
		this.restoreState( this.history[ this.historyIndex ] );
		this.updateUndoRedoButtons();

		return true;
	};

	/**
	 * Redo next action
	 *
	 * @return {boolean} True if redo was performed
	 */
	HistoryManager.prototype.redo = function () {
		if ( !this.canRedo() ) {
			return false;
		}

		this.historyIndex++;
		this.restoreState( this.history[ this.historyIndex ] );
		this.updateUndoRedoButtons();

		return true;
	};

	/**
	 * Check if undo is available
	 *
	 * @return {boolean} True if can undo
	 */
	HistoryManager.prototype.canUndo = function () {
		return this.historyIndex > 0;
	};

	/**
	 * Check if redo is available
	 *
	 * @return {boolean} True if can redo
	 */
	HistoryManager.prototype.canRedo = function () {
		return this.historyIndex < this.history.length - 1;
	};

	/**
	 * Restore state from history
	 *
	 * @param {Object} state State object to restore
	 */
	HistoryManager.prototype.restoreState = function ( state ) {
		// Restore layers to either editor.layers or canvasManager.layers
		var restored = JSON.parse( JSON.stringify( state.layers ) );
		if ( this.canvasManager && this.canvasManager.editor ) {
			this.canvasManager.editor.layers = restored;
		} else if ( this.canvasManager ) {
			this.canvasManager.layers = restored;
		}

		// Clear selections
		if ( this.canvasManager && this.canvasManager.selectionManager ) {
			this.canvasManager.selectionManager.clearSelection();
		} else if ( this.canvasManager ) {
			// Fallback for legacy code
			this.canvasManager.selectedLayerId = null;
			this.canvasManager.selectedLayerIds = [];
		}

		// Re-render
		var currentLayers =
			( this.canvasManager && this.canvasManager.editor &&
				this.canvasManager.editor.layers ) ||
			( this.canvasManager && this.canvasManager.layers ) || [];
		if ( this.canvasManager && typeof this.canvasManager.renderLayers === 'function' ) {
			this.canvasManager.renderLayers( currentLayers );
		}
		if ( this.canvasManager && typeof this.canvasManager.redraw === 'function' ) {
			this.canvasManager.redraw();
		}

		// Update layer panel
		if ( this.canvasManager && this.canvasManager.editor &&
			this.canvasManager.editor.layerPanel &&
			typeof this.canvasManager.editor.layerPanel.updateLayers === 'function' ) {
			this.canvasManager.editor.layerPanel.updateLayers( currentLayers );
		}

		// Mark editor as dirty (when available)
		if ( this.canvasManager && this.canvasManager.editor && typeof this.canvasManager.editor.markDirty === 'function' ) {
			this.canvasManager.editor.markDirty();
		}
	};

	/**
	 * Update undo/redo button states
	 */
	HistoryManager.prototype.updateUndoRedoButtons = function () {
		var canUndo = this.canUndo();
		var canRedo = this.canRedo();

		// Update toolbar buttons if available
		if ( this.canvasManager && this.canvasManager.editor &&
			this.canvasManager.editor.toolbar ) {
			var undoBtn = this.canvasManager.editor.toolbar.container.querySelector( '.undo-btn' );
			var redoBtn = this.canvasManager.editor.toolbar.container.querySelector( '.redo-btn' );

			if ( undoBtn ) {
				undoBtn.disabled = !canUndo;
				undoBtn.title = canUndo ?
					'Undo: ' + this.history[ this.historyIndex - 1 ].description :
					'Nothing to undo';
			}

			if ( redoBtn ) {
				redoBtn.disabled = !canRedo;
				redoBtn.title = canRedo ?
					'Redo: ' + this.history[ this.historyIndex + 1 ].description :
					'Nothing to redo';
			}
		}

		// Update status
		if ( this.canvasManager && this.canvasManager.editor &&
			typeof this.canvasManager.editor.updateStatus === 'function' ) {
			this.canvasManager.editor.updateStatus( {
				canUndo: canUndo,
				canRedo: canRedo,
				historyPosition: this.historyIndex + 1,
				historySize: this.history.length
			} );
		}
	};

	/**
	 * Start batch mode for grouped operations
	 *
	 * @param {string} description Description for the batch operation
	 */
	HistoryManager.prototype.startBatch = function ( description ) {
		this.batchMode = true;
		this.batchDescription = description || 'Batch operation';
		this.batchChanges = [];
		this.batchOperations = this.batchChanges;
		// Snapshot current state to allow cancel
		this.batchStartSnapshot = this.getLayersSnapshot();
	};

	/**
	 * End batch mode and save as single history entry
	 */
	HistoryManager.prototype.endBatch = function () {
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
	};

	/**
	 * Cancel batch mode without saving
	 */
	HistoryManager.prototype.cancelBatch = function () {
		// Revert to snapshot from start of batch if available
		if ( this.batchStartSnapshot && this.canvasManager ) {
			var snapshot = JSON.parse( JSON.stringify( this.batchStartSnapshot ) );
			if ( this.canvasManager.editor ) {
				this.canvasManager.editor.layers = snapshot;
			} else {
				this.canvasManager.layers = snapshot;
			}
			var layers =
				( this.canvasManager.editor && this.canvasManager.editor.layers ) ||
				this.canvasManager.layers || [];
			if ( typeof this.canvasManager.renderLayers === 'function' ) {
				this.canvasManager.renderLayers( layers );
			}
			if ( typeof this.canvasManager.redraw === 'function' ) {
				this.canvasManager.redraw();
			}
		}
		this.batchMode = false;
		this.batchChanges = [];
		this.batchOperations = this.batchChanges;
		this.batchStartSnapshot = null;
	};

	/**
	 * Clear all history
	 */
	HistoryManager.prototype.clearHistory = function () {
		this.history = [];
		this.historyIndex = -1;
		this.updateUndoRedoButtons();
	};

	// Backward-compat aliases for older tests
	HistoryManager.prototype.clear = function () {
		this.clearHistory();
	};
	HistoryManager.prototype.commitBatch = function () {
		this.endBatch();
	};
	HistoryManager.prototype.getCurrentStateDescription = function () {
		return this.historyIndex >= 0 && this.history[ this.historyIndex ] ?
			this.history[ this.historyIndex ].description : 'No history';
	};

	/**
	 * Get history information
	 *
	 * @return {Object} History information
	 */
	HistoryManager.prototype.getHistoryInfo = function () {
		return {
			totalSteps: this.history.length,
			currentStep: this.historyIndex + 1,
			canUndo: this.canUndo(),
			canRedo: this.canRedo(),
			maxSteps: this.maxHistorySteps,
			batchMode: this.batchMode
		};
	};

	/**
	 * Get history entries for UI display
	 *
	 * @param {number} limit Maximum number of entries to return
	 * @return {Array} Array of history entries
	 */
	HistoryManager.prototype.getHistoryEntries = function ( limit ) {
		limit = limit || 10;
		var start = Math.max( 0, this.history.length - limit );

		return this.history.slice( start ).map( function ( entry, index ) {
			var actualIndex = start + index;
			return {
				index: actualIndex,
				description: entry.description,
				timestamp: entry.timestamp,
				isCurrent: actualIndex === this.historyIndex,
				canRevertTo: actualIndex <= this.historyIndex
			};
		}.bind( this ) );
	};

	/**
	 * Revert to specific history entry
	 *
	 * @param {number} targetIndex Index to revert to
	 * @return {boolean} True if revert was successful
	 */
	HistoryManager.prototype.revertTo = function ( targetIndex ) {
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
	};

	/**
	 * Compress history to save memory
	 */
	HistoryManager.prototype.compressHistory = function () {
		if ( this.history.length <= this.maxHistorySteps / 2 ) {
			return;
		}

		// Keep recent half of history
		var keepCount = Math.floor( this.maxHistorySteps / 2 );
		var removeCount = this.history.length - keepCount;

		this.history = this.history.slice( removeCount );
		this.historyIndex = Math.max( 0, this.historyIndex - removeCount );

		this.updateUndoRedoButtons();
	};

	/**
	 * Set maximum history steps
	 *
	 * @param {number} maxSteps Maximum number of history steps
	 */
	HistoryManager.prototype.setMaxHistorySteps = function ( maxSteps ) {
		this.maxHistorySteps = Math.max( 1, maxSteps );

		// Trim current history if needed
		if ( this.history.length > this.maxHistorySteps ) {
			var removeCount = this.history.length - this.maxHistorySteps;
			this.history = this.history.slice( removeCount );
			this.historyIndex = Math.max( 0, this.historyIndex - removeCount );
			this.updateUndoRedoButtons();
		}
	};

	/**
	 * Check if current state differs from last saved state
	 *
	 * @return {boolean} True if state has changed
	 */
	HistoryManager.prototype.hasUnsavedChanges = function () {
		if ( this.history.length === 0 ) {
			var initialLayers =
				( this.canvasManager && this.canvasManager.editor &&
					this.canvasManager.editor.layers ) ||
				( this.canvasManager && this.canvasManager.layers ) || [];
			return initialLayers.length > 0;
		}

		var currentLayers = this.getLayersSnapshot();
		var lastSavedLayers = this.history[ this.historyIndex ].layers;

		return JSON.stringify( currentLayers ) !== JSON.stringify( lastSavedLayers );
	};

	/**
	 * Save initial state
	 */
	HistoryManager.prototype.saveInitialState = function () {
		this.clearHistory();
		this.saveState( 'Initial state' );
	};

	/**
	 * Export history for debugging
	 *
	 * @return {Object} History export
	 */
	HistoryManager.prototype.exportHistory = function () {
		return {
			history: this.history.map( function ( entry ) {
				return {
					description: entry.description,
					timestamp: entry.timestamp,
					layerCount: entry.layers.length
				};
			} ),
			historyIndex: this.historyIndex,
			maxHistorySteps: this.maxHistorySteps,
			batchMode: this.batchMode
		};
	};

	/**
	 * Get memory usage estimate
	 *
	 * @return {Object} Memory usage information
	 */
	HistoryManager.prototype.getMemoryUsage = function () {
		var totalSize = 0;
		var layerCounts = [];

		this.history.forEach( function ( entry ) {
			var serialized = JSON.stringify( entry );
			totalSize += serialized.length;
			layerCounts.push( entry.layers.length );
		} );

		// Return a single number for legacy tests (estimated bytes)
		return totalSize;
	};

	// Export HistoryManager to global scope
	window.LayersHistoryManager = HistoryManager;
	// Also export via CommonJS when available (for Jest tests)
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = HistoryManager;
	}

}() );
