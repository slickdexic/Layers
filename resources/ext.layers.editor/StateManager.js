/**
 * State Manager for Layers Editor
 * Centralized state management with race condition prevention
 */
class StateManager {
	constructor( editor ) {
		this.editor = editor;
		this.state = {
			// Core editor state
			isDirty: false,
			isLoading: false, // Prevents user interactions during API load
			currentTool: 'pointer',
			selectedLayerIds: [],
			layers: [],
			currentLayerSetId: null,
			allLayerSets: [],

			// Canvas/viewport state
			zoom: 1.0,
			panX: 0,
			panY: 0,
			canvasWidth: 0,
			canvasHeight: 0,

			// UI state
			showGrid: false,
			showRulers: false,
			showGuides: false,
			snapToGrid: false,
			snapToGuides: false,

			// Background image state
			backgroundVisible: true,
			backgroundOpacity: 1.0,

			// Canvas/slide layer selection state
			canvasLayerSelected: false,

			// History state
			history: [],
			historyIndex: -1,
			maxHistorySize: 50
		};

		this.listeners = {};
		
		// State locking mechanism to prevent race conditions
		this.isLocked = false;
		this.pendingOperations = [];
		this.lockingQueue = [];
		this.lockTimeout = null;
		
		this.initializeState();
	}

	initializeState() {
		// Initialize with default values
		this.state.layers = [];
		this.state.selectedLayerIds = [];
		this.state.history = [];
		this.state.historyIndex = -1;

		// Save initial state to history for proper undo/redo
		this.saveToHistory( 'initial' );
	}

	/**
	 * Get current state
	 */
	getState() {
		return Object.assign( {}, this.state );
	}

	/**
	 * Get specific state property
	 */
	get( key ) {
		return this.state[ key ];
	}

	/**
	 * Set state property and notify listeners (with race condition protection)
	 */
	set( key, value ) {
		if ( this.isLocked ) {
			// Queue the operation if state is locked
			this.pendingOperations.push( { type: 'set', key: key, value: value } );
			return;
		}

		const oldValue = this.state[ key ];
		this.state[ key ] = value;

		// Notify listeners of the change
		this.notifyListeners( key, value, oldValue );
	}

	/**
	 * Update multiple state properties at once (with race condition protection)
	 */
	update( updates ) {
		if ( this.isLocked ) {
			// Queue the operation if state is locked
			this.pendingOperations.push( { type: 'update', updates: updates } );
			return;
		}

		this.lockState();

		try {
			const oldState = Object.assign( {}, this.state );
			const changedKeys = [];

			Object.keys( updates ).forEach( key => {
				if ( this.state[ key ] !== updates[ key ] ) {
					this.state[ key ] = updates[ key ];
					changedKeys.push( key );
				}
			} );

			// Notify listeners for each changed key
			changedKeys.forEach( key => {
				this.notifyListeners( key, this.state[ key ], oldState[ key ] );
			} );
		} finally {
			this.unlockState();
		}
	}

	/**
	 * Atomically update state with a function to prevent race conditions
	 */
	atomic( updateFunction ) {
		if ( typeof updateFunction !== 'function' ) {
			throw new Error( 'Atomic update requires a function' );
		}

		this.lockState();

		try {
			const oldState = Object.assign( {}, this.state );
			
			// Apply the update function to get new state
			const newState = updateFunction( oldState );
			
			if ( newState && typeof newState === 'object' ) {
				const changedKeys = [];

				Object.keys( newState ).forEach( key => {
					if ( this.state[ key ] !== newState[ key ] ) {
						this.state[ key ] = newState[ key ];
						changedKeys.push( key );
					}
				} );

				// Notify listeners for each changed key
				changedKeys.forEach( key => {
					this.notifyListeners( key, this.state[ key ], oldState[ key ] );
				} );
			}
		} finally {
			this.unlockState();
		}
	}

	/**
	 * Lock the state to prevent concurrent modifications
	 */
	lockState() {
		// CORE-7 FIX: Check if previous lock was stuck and log recovery
		if ( this.lockStuckSince ) {
			const stuckDuration = Date.now() - this.lockStuckSince;
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[StateManager] Recovered from stuck lock after ' + stuckDuration + 'ms' );
			}
			this.lockStuckSince = null;
		}
		
		this.isLocked = true;
		
		// Set a timeout to detect stuck locks (but don't force unlock - that could corrupt state)
		if ( this.lockTimeout ) {
			clearTimeout( this.lockTimeout );
		}
		this.lockTimeout = setTimeout( () => {
			// Log error but DON'T force unlock - force unlocking during an active operation
			// could corrupt state. Instead, set a flag so the next operation knows there was an issue.
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.error( '[StateManager] Lock held for >5s - possible deadlock. Lock will remain until manually resolved.' );
			}
			this.lockStuckSince = Date.now();
		}, 5000 ); // 5 second detection timeout
	}

	/**
	 * Unlock the state and process any pending operations
	 */
	unlockState() {
		this.isLocked = false;
		
		if ( this.lockTimeout ) {
			clearTimeout( this.lockTimeout );
			this.lockTimeout = null;
		}

		// Process any pending operations in order
		// Wrap in try-catch to prevent deadlock if an operation throws
		while ( this.pendingOperations.length > 0 ) {
			const operation = this.pendingOperations.shift();
			
			try {
				if ( operation.type === 'set' ) {
					this.set( operation.key, operation.value );
				} else if ( operation.type === 'update' ) {
					this.update( operation.updates );
				}
			} catch ( error ) {
				// Log the error but continue processing remaining operations
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[StateManager] Error processing pending operation:', error.message || error );
				}
			}
		}
	}

	/**
	 * Subscribe to state changes
	 */
	subscribe( key, callback ) {
		if ( !this.listeners[ key ] ) {
			this.listeners[ key ] = [];
		}
		this.listeners[ key ].push( callback );

		// Return unsubscribe function
		return () => {
			// Guard against destroyed state or missing key
			if ( !this.listeners || !this.listeners[ key ] ) {
				return;
			}
			const index = this.listeners[ key ].indexOf( callback );
			if ( index > -1 ) {
				this.listeners[ key ].splice( index, 1 );
			}
		};
	}

	/**
	 * Notify listeners of state changes
	 */
	notifyListeners( key, newValue, oldValue ) {
		if ( this.listeners[ key ] ) {
			this.listeners[ key ].forEach( callback => {
				try {
					callback( newValue, oldValue, key );
				} catch ( error ) {
					// SECURITY FIX: Use mw.log instead of console.error
					if ( mw.log ) {
						mw.log.error( 'State listener error:', error.message || 'Unknown error' );
					}
				}
			} );
		}

		// Also notify global listeners
		if ( this.listeners[ '*' ] ) {
			this.listeners[ '*' ].forEach( callback => {
				try {
					callback( key, newValue, oldValue );
				} catch ( error ) {
					// SECURITY FIX: Use mw.log instead of console.error
					if ( mw.log ) {
						mw.log.error( 'Global state listener error:', error.message || 'Unknown error' );
					}
				}
			} );
		}
	}

	/**
	 * Layer management methods with atomic operations
	 */
	addLayer( layerData ) {
		const layer = Object.assign( {}, layerData, {
			id: layerData.id || this.generateLayerId(),
			visible: layerData.visible !== false,
			locked: layerData.locked || false
		} );

		this.atomic( ( state ) => {
			const newLayers = [ layer, ...state.layers ]; // Add to top
			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		// Save state AFTER modification for proper undo/redo
		this.saveToHistory( 'add-layer' );

		return layer;
	}

	removeLayer( layerId ) {
		const existingLayer = this.state.layers.find( layer => layer.id === layerId );
		if ( !existingLayer ) {
			return; // Layer doesn't exist, nothing to remove
		}

		this.atomic( ( state ) => {
			const newLayers = state.layers.filter( layer => layer.id !== layerId );
			const newSelectedLayerIds = state.selectedLayerIds.filter( id => id !== layerId );
			
			return {
				layers: newLayers,
				selectedLayerIds: newSelectedLayerIds,
				isDirty: true
			};
		} );

		// Save state AFTER modification for proper undo/redo
		this.saveToHistory( 'remove-layer' );
	}

	updateLayer( layerId, updates ) {
		const existingLayer = this.state.layers.find( layer => layer.id === layerId );
		if ( !existingLayer ) {
			return; // Layer doesn't exist, nothing to update
		}

		this.atomic( ( state ) => {
			const layerIndex = state.layers.findIndex( layer => layer.id === layerId );
			// Guard against race condition where layer was removed between check and update
			if ( layerIndex === -1 ) {
				return null; // No changes - layer was removed
			}
			const newLayers = [ ...state.layers ];
			newLayers[ layerIndex ] = Object.assign( {}, newLayers[ layerIndex ], updates );
			
			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		// Save state AFTER modification for proper undo/redo
		this.saveToHistory( 'update-layer' );
	}

	getLayer( layerId ) {
		return this.state.layers.find( layer => layer.id === layerId );
	}

	getLayers() {
		return this.state.layers.slice();
	}

	/**
	 * Layer ordering methods
	 *
	 * @param {string} layerId The ID of the layer to move
	 * @param {string} targetId The ID of the target layer
	 * @param {boolean} [insertAfter=false] If true, insert after the target; if false, insert before
	 * @return {boolean} True if reorder succeeded, false otherwise
	 */
	reorderLayer( layerId, targetId, insertAfter = false ) {
		const layers = this.state.layers;
		const draggedLayer = layers.find( layer => layer.id === layerId );
		const draggedIndex = layers.findIndex( layer => layer.id === layerId );
		const targetIndex = layers.findIndex( layer => layer.id === targetId );

		if ( draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex ) {
			return false;
		}

		// Check if the dragged layer is a folder (group) with children
		const isFolder = draggedLayer && draggedLayer.type === 'group';
		const folderChildren = isFolder && draggedLayer.children ? draggedLayer.children : [];

		this.atomic( ( state ) => {
			const newLayers = [ ...state.layers ];

			// Collect all layers to move: the folder + its children (in order)
			const layersToMove = [];
			const indicesToRemove = [];

			// First, find the folder
			const folderIdx = newLayers.findIndex( l => l.id === layerId );
			if ( folderIdx !== -1 ) {
				layersToMove.push( newLayers[ folderIdx ] );
				indicesToRemove.push( folderIdx );
			}

			// If it's a folder, also find its children in their current order
			if ( isFolder && folderChildren.length > 0 ) {
				for ( let i = 0; i < newLayers.length; i++ ) {
					if ( folderChildren.includes( newLayers[ i ].id ) ) {
						layersToMove.push( newLayers[ i ] );
						indicesToRemove.push( i );
					}
				}
			}

			// Remove all the layers to move (in reverse order to maintain indices)
			indicesToRemove.sort( ( a, b ) => b - a );
			for ( const idx of indicesToRemove ) {
				newLayers.splice( idx, 1 );
			}

			// Find the new target position in the modified array
			let newTargetIndex = newLayers.findIndex( l => l.id === targetId );
			if ( newTargetIndex === -1 ) {
				// Target was removed (shouldn't happen, but handle gracefully)
				newTargetIndex = newLayers.length;
			}

			// If insertAfter is true, we want to place the layers after the target
			if ( insertAfter ) {
				newTargetIndex = newTargetIndex + 1;
			}

			// Insert all layers at the target position (maintaining their relative order)
			newLayers.splice( newTargetIndex, 0, ...layersToMove );

			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		this.saveToHistory( 'reorder-layer' );
		return true;
	}

	moveLayerUp( layerId ) {
		const layers = this.state.layers;
		const index = layers.findIndex( layer => layer.id === layerId );

		if ( index <= 0 ) {
			return false; // Already at top or not found
		}

		this.atomic( ( state ) => {
			const newLayers = [ ...state.layers ];
			[ newLayers[ index - 1 ], newLayers[ index ] ] = [ newLayers[ index ], newLayers[ index - 1 ] ];

			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		this.saveToHistory( 'move-layer-up' );
		return true;
	}

	moveLayerDown( layerId ) {
		const layers = this.state.layers;
		const index = layers.findIndex( layer => layer.id === layerId );

		if ( index === -1 || index >= layers.length - 1 ) {
			return false; // At bottom or not found
		}

		this.atomic( ( state ) => {
			const newLayers = [ ...state.layers ];
			[ newLayers[ index ], newLayers[ index + 1 ] ] = [ newLayers[ index + 1 ], newLayers[ index ] ];

			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		this.saveToHistory( 'move-layer-down' );
		return true;
	}

	bringToFront( layerId ) {
		const layers = this.state.layers;
		const index = layers.findIndex( layer => layer.id === layerId );

		if ( index === -1 || index === 0 ) {
			return false; // Already at front or not found
		}

		this.atomic( ( state ) => {
			const newLayers = [ ...state.layers ];
			const [ layer ] = newLayers.splice( index, 1 );
			newLayers.unshift( layer );

			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		this.saveToHistory( 'bring-to-front' );
		return true;
	}

	sendToBack( layerId ) {
		const layers = this.state.layers;
		const index = layers.findIndex( layer => layer.id === layerId );

		if ( index === -1 || index === layers.length - 1 ) {
			return false; // Already at back or not found
		}

		this.atomic( ( state ) => {
			const newLayers = [ ...state.layers ];
			const [ layer ] = newLayers.splice( index, 1 );
			newLayers.push( layer );

			return {
				layers: newLayers,
				isDirty: true
			};
		} );

		this.saveToHistory( 'send-to-back' );
		return true;
	}

	/**
	 * Selection management with atomic operations
	 */
	selectLayer( layerId, multiSelect = false ) {
		this.atomic( ( state ) => {
			let newSelectedLayerIds;
			
			if ( multiSelect ) {
				if ( !state.selectedLayerIds.includes( layerId ) ) {
					newSelectedLayerIds = [ ...state.selectedLayerIds, layerId ];
				} else {
					return {}; // Already selected
				}
			} else {
				newSelectedLayerIds = [ layerId ];
			}
			
			return {
				selectedLayerIds: newSelectedLayerIds
			};
		} );
	}

	deselectLayer( layerId ) {
		this.atomic( ( state ) => {
			const newSelectedLayerIds = state.selectedLayerIds.filter( id => id !== layerId );
			
			if ( newSelectedLayerIds.length !== state.selectedLayerIds.length ) {
				return {
					selectedLayerIds: newSelectedLayerIds
				};
			}
			
			return {}; // No changes
		} );
	}

	clearSelection() {
		this.atomic( ( state ) => {
			if ( state.selectedLayerIds.length > 0 ) {
				return {
					selectedLayerIds: []
				};
			}
			
			return {}; // No changes
		} );
	}

	getSelectedLayers() {
		return this.state.layers.filter( layer =>
			this.state.selectedLayerIds.includes( layer.id )
		);
	}

	/**
	 * History management
	 *
	 * NOTE: StateManager's internal history is DISABLED because LayersEditor
	 * uses HistoryManager for undo/redo. StateManager.undo()/redo() are never
	 * called in the codebase, so saveToHistory was wasting CPU cycles cloning
	 * the entire layers array (including 500KB+ image data) on every change.
	 *
	 * Performance impact: Cloning a 1MB layer set 50 times = 50MB memory overhead.
	 */
	saveToHistory( /* action */ ) {
		// Disabled - HistoryManager handles undo/redo
		// See comment above for rationale
		return;

		// Original code (kept for reference, unreachable):
		// Remove any history after current index (for when we're not at the end)
		// this.state.history = this.state.history.slice( 0, this.state.historyIndex + 1 );
		// ... etc
	}

	// CORE-6 FIX: Removed dead undo(), redo(), restoreState() methods.
	// HistoryManager handles all undo/redo functionality.
	// See HistoryManager.js for the active implementation.

	/**
	 * Utility methods
	 */
	setDirty( isDirty ) {
		this.set( 'isDirty', isDirty );
	}

	isDirty() {
		return this.state.isDirty;
	}

	markClean() {
		this.setDirty( false );
	}

	markDirty() {
		this.setDirty( true );
	}

	generateLayerId() {
		// Use shared IdGenerator for guaranteed uniqueness with monotonic counter
		if ( window.Layers && window.Layers.Utils && window.Layers.Utils.generateLayerId ) {
			return window.Layers.Utils.generateLayerId();
		}
		// Fallback (should not be reached in production)
		return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	}

	/**
	 * Load state from external source
	 */
	loadState( externalState ) {
		if ( externalState.layers ) {
			this.state.layers = externalState.layers;
		}
		if ( externalState.currentLayerSetId !== undefined ) {
			this.state.currentLayerSetId = externalState.currentLayerSetId;
		}
		if ( externalState.allLayerSets ) {
			this.state.allLayerSets = externalState.allLayerSets;
		}

		// Save initial state to history
		this.saveToHistory( 'load-state' );
		this.markClean();

		// Notify listeners
		this.notifyListeners( 'layers', this.state.layers );
	}

	/**
	 * Export current state
	 */
	exportState() {
		return {
			layers: JSON.parse( JSON.stringify( this.state.layers ) ),
			selectedLayerIds: this.state.selectedLayerIds.slice(),
			currentLayerSetId: this.state.currentLayerSetId,
			isDirty: this.state.isDirty
		};
	}

	/**
	 * Reset state to initial values
	 */
	reset() {
		this.initializeState();
		this.notifyListeners( 'layers', this.state.layers );
		this.notifyListeners( 'selectedLayerIds', this.state.selectedLayerIds );
		this.markClean();
	}

	/**
	 * Clean up state manager resources
	/**
	 * Destroy state manager and clean up resources
	 */
	destroy() {
		// Cancel any pending lock timeout
		if ( this.lockTimeout ) {
			clearTimeout( this.lockTimeout );
			this.lockTimeout = null;
		}

		// Force unlock if locked
		if ( this.isLocked ) {
			this.isLocked = false;
		}

		// Clear pending operations
		this.pendingOperations = [];
		this.lockingQueue = [];

		// Clear all listeners
		this.listeners = {};

		// Reset state
		this.reset();
	}
}

// Export to window.Layers namespace (preferred)
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.Core = window.Layers.Core || {};
	window.Layers.Core.StateManager = StateManager;
	// NOTE: Do NOT create a global singleton here.
	// Each LayersEditor instance creates its own StateManager via the ModuleRegistry.
	// Creating a singleton at load time causes bugs with multiple editors and memory leaks.
}

// Export for CommonJS/Jest tests
if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = StateManager;
}