/**
 * History Manager for Layers Editor
 * Handles undo/redo functionality
 */
( function () {
	'use strict';

	/**
	 * HistoryManager class
	 *
	 * @param {Object} config Configuration object
	 * @param {CanvasManager} canvasManager Reference to the canvas manager
	 * @class
	 */
	function HistoryManager( config, canvasManager ) {
		this.config = config || {};
		this.canvasManager = canvasManager;
		
		// History state
		this.history = [];
		this.historyIndex = -1;
		this.maxHistorySteps = this.config.maxHistorySteps || 50;
		
		// Batch operations
		this.batchMode = false;
		this.batchChanges = [];
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
			return;
		}

		// Remove any future history if we're not at the end
		if ( this.historyIndex < this.history.length - 1 ) {
			this.history = this.history.slice( 0, this.historyIndex + 1 );
		}

		// Add new state
		var state = {
			layers: this.getLayersSnapshot(),
			description: description || 'Edit',
			timestamp: Date.now()
		};

		this.history.push( state );
		this.historyIndex++;

		// Trim history if it exceeds max size
		if ( this.history.length > this.maxHistorySteps ) {
			this.history.shift();
			this.historyIndex--;
		}

		this.updateUndoRedoButtons();
	};

	/**
	 * Get snapshot of current layers
	 *
	 * @return {Array} Deep copy of layers array
	 */
	HistoryManager.prototype.getLayersSnapshot = function () {
		var layers = this.canvasManager.editor.layers || [];
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
		// Restore layers
		this.canvasManager.editor.layers = JSON.parse( JSON.stringify( state.layers ) );

		// Clear selections
		if ( this.canvasManager.selectionManager ) {
			this.canvasManager.selectionManager.clearSelection();
		} else {
			// Fallback for legacy code
			this.canvasManager.selectedLayerId = null;
			this.canvasManager.selectedLayerIds = [];
		}

		// Re-render
		this.canvasManager.renderLayers( this.canvasManager.editor.layers );

		// Update layer panel
		if ( this.canvasManager.editor.layerPanel && 
			 typeof this.canvasManager.editor.layerPanel.updateLayers === 'function' ) {
			this.canvasManager.editor.layerPanel.updateLayers( this.canvasManager.editor.layers );
		}

		// Mark editor as dirty
		this.canvasManager.editor.markDirty();
	};

	/**
	 * Update undo/redo button states
	 */
	HistoryManager.prototype.updateUndoRedoButtons = function () {
		var canUndo = this.canUndo();
		var canRedo = this.canRedo();

		// Update toolbar buttons if available
		if ( this.canvasManager.editor.toolbar ) {
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
		if ( this.canvasManager.editor && typeof this.canvasManager.editor.updateStatus === 'function' ) {
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
	};

	/**
	 * End batch mode and save as single history entry
	 */
	HistoryManager.prototype.endBatch = function () {
		if ( !this.batchMode || this.batchChanges.length === 0 ) {
			this.batchMode = false;
			this.batchChanges = [];
			return;
		}

		// Save final state as single history entry
		this.batchMode = false;
		this.saveState( this.batchDescription );
		this.batchChanges = [];
	};

	/**
	 * Cancel batch mode without saving
	 */
	HistoryManager.prototype.cancelBatch = function () {
		this.batchMode = false;
		this.batchChanges = [];
	};

	/**
	 * Clear all history
	 */
	HistoryManager.prototype.clearHistory = function () {
		this.history = [];
		this.historyIndex = -1;
		this.updateUndoRedoButtons();
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
		if ( targetIndex < 0 || targetIndex >= this.history.length || targetIndex > this.historyIndex ) {
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
			return this.canvasManager.editor.layers && this.canvasManager.editor.layers.length > 0;
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

		return {
			estimatedBytes: totalSize,
			estimatedKB: Math.round( totalSize / 1024 ),
			entryCount: this.history.length,
			averageLayersPerEntry: layerCounts.length > 0 ? 
				Math.round( layerCounts.reduce( function ( a, b ) { return a + b; }, 0 ) / layerCounts.length ) : 0,
			maxLayersInEntry: layerCounts.length > 0 ? Math.max.apply( Math, layerCounts ) : 0
		};
	};

	// Export HistoryManager to global scope
	window.LayersHistoryManager = HistoryManager;

}() );
