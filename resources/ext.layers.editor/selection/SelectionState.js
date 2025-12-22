/**
 * Selection State Manager for Layers Editor
 * Handles tracking of selected layers and basic selection operations
 *
 * @class SelectionState
 */
( function () {
	'use strict';

	/**
	 * SelectionState class
	 * Manages the state of layer selection (which layers are selected)
	 */
	class SelectionState {
		/**
		 * Create a SelectionState instance
		 *
		 * @param {Object} options Configuration options
		 * @param {Function} [options.getLayersArray] Function to retrieve layers array
		 * @param {Function} [options.onSelectionChange] Callback when selection changes
		 */
		constructor( options = {} ) {
			this.options = options;

			// Selection state
			this.selectedLayerIds = [];
			this.lastSelectedId = null;
			this.multiSelectMode = false;
		}

		/**
		 * Get the layers array from the configured source
		 *
		 * @return {Array} Array of layer objects
		 */
		getLayersArray() {
			if ( typeof this.options.getLayersArray === 'function' ) {
				return this.options.getLayersArray() || [];
			}
			return [];
		}

		/**
		 * Select a layer by ID
		 *
		 * @param {string|null} layerId Layer ID to select, or null to clear
		 * @param {boolean} addToSelection Whether to add to existing selection
		 */
		selectLayer( layerId, addToSelection = false ) {
			if ( !addToSelection ) {
				this.clearSelection( false ); // Don't notify yet
			}

			// Toggle behavior when adding to selection and already selected
			if ( addToSelection && layerId && this.isSelected( layerId ) ) {
				this.deselectLayer( layerId );
				return;
			}

			// Skip if no layerId or already selected
			if ( !layerId || this.selectedLayerIds.indexOf( layerId ) !== -1 ) {
				this.notifySelectionChange();
				return;
			}

			// Get the layer to check if it's selectable
			const layer = this.getLayerById( layerId );
			if ( !layer ) {
				this.notifySelectionChange();
				return;
			}

			// Skip locked or invisible layers
			if ( layer.locked === true || layer.visible === false ) {
				this.notifySelectionChange();
				return;
			}

			this.selectedLayerIds.push( layerId );
			this.lastSelectedId = layerId;

			this.notifySelectionChange();
		}

		/**
		 * Deselect a layer by ID
		 *
		 * @param {string} layerId Layer ID to deselect
		 */
		deselectLayer( layerId ) {
			const index = this.selectedLayerIds.indexOf( layerId );
			if ( index !== -1 ) {
				this.selectedLayerIds.splice( index, 1 );

				if ( this.lastSelectedId === layerId ) {
					this.lastSelectedId = this.selectedLayerIds.length > 0 ?
						this.selectedLayerIds[ this.selectedLayerIds.length - 1 ] : null;
				}
			}

			this.notifySelectionChange();
		}

		/**
		 * Clear all selections
		 *
		 * @param {boolean} notify Whether to notify listeners (default true)
		 */
		clearSelection( notify = true ) {
			this.selectedLayerIds = [];
			this.lastSelectedId = null;

			if ( notify ) {
				this.notifySelectionChange();
			}
		}

		/**
		 * Select all layers
		 */
		selectAll() {
			const layers = this.getLayersArray();
			this.selectedLayerIds = layers
				.filter( ( layer ) => layer.visible !== false && layer.locked !== true )
				.map( ( layer ) => layer.id );

			if ( this.selectedLayerIds.length > 0 ) {
				this.lastSelectedId = this.selectedLayerIds[ this.selectedLayerIds.length - 1 ];
			}

			this.notifySelectionChange();
		}

		/**
		 * Check if a layer is selected
		 *
		 * @param {string} layerId Layer ID to check
		 * @return {boolean} True if selected
		 */
		isSelected( layerId ) {
			return this.selectedLayerIds.indexOf( layerId ) !== -1;
		}

		/**
		 * Get the number of selected layers
		 *
		 * @return {number} Number of selected layers
		 */
		getSelectionCount() {
			return this.selectedLayerIds.length;
		}

		/**
		 * Check if there is any selection
		 *
		 * @return {boolean} True if at least one layer is selected
		 */
		hasSelection() {
			return this.selectedLayerIds.length > 0;
		}

		/**
		 * Get all selected layer IDs
		 *
		 * @return {Array} Array of selected layer IDs (copy)
		 */
		getSelectedIds() {
			return this.selectedLayerIds.slice( 0 );
		}

		/**
		 * Get all selected layers
		 *
		 * @return {Array} Array of selected layer objects
		 */
		getSelectedLayers() {
			const layers = this.getLayersArray();
			return layers.filter( ( layer ) => this.isSelected( layer.id ) );
		}

		/**
		 * Set the selected layer IDs directly (used for marquee selection)
		 *
		 * @param {Array} ids Array of layer IDs to select
		 * @param {boolean} notify Whether to notify listeners (default true)
		 */
		setSelectedIds( ids, notify = true ) {
			this.selectedLayerIds = ids.slice( 0 );
			if ( this.selectedLayerIds.length > 0 ) {
				this.lastSelectedId = this.selectedLayerIds[ this.selectedLayerIds.length - 1 ];
			} else {
				this.lastSelectedId = null;
			}

			if ( notify ) {
				this.notifySelectionChange();
			}
		}

		/**
		 * Get layer by ID
		 *
		 * @param {string} layerId Layer ID
		 * @return {Object|null} Layer object or null
		 */
		getLayerById( layerId ) {
			const layers = this.getLayersArray();
			for ( let i = 0; i < layers.length; i++ ) {
				if ( layers[ i ].id === layerId ) {
					return layers[ i ];
				}
			}
			return null;
		}

		/**
		 * Get the last selected layer ID
		 *
		 * @return {string|null} Last selected layer ID
		 */
		getLastSelectedId() {
			return this.lastSelectedId;
		}

		/**
		 * Set multi-select mode
		 *
		 * @param {boolean} enabled Whether multi-select mode is enabled
		 */
		setMultiSelectMode( enabled ) {
			this.multiSelectMode = enabled;
		}

		/**
		 * Check if multi-select mode is enabled
		 *
		 * @return {boolean} True if multi-select mode is enabled
		 */
		isMultiSelectMode() {
			return this.multiSelectMode;
		}

		/**
		 * Notify listeners of selection change
		 */
		notifySelectionChange() {
			if ( typeof this.options.onSelectionChange === 'function' ) {
				this.options.onSelectionChange( this.selectedLayerIds.slice( 0 ) );
			}
		}

		/**
		 * Save current state for undo purposes
		 *
		 * @return {Object} State object
		 */
		saveState() {
			return {
				selectedLayerIds: this.selectedLayerIds.slice( 0 ),
				lastSelectedId: this.lastSelectedId,
				multiSelectMode: this.multiSelectMode
			};
		}

		/**
		 * Restore state from saved object
		 *
		 * @param {Object} state Saved state object
		 * @param {boolean} notify Whether to notify listeners (default true)
		 */
		restoreState( state, notify = true ) {
			if ( state ) {
				this.selectedLayerIds = ( state.selectedLayerIds || [] ).slice( 0 );
				this.lastSelectedId = state.lastSelectedId || null;
				this.multiSelectMode = state.multiSelectMode || false;
			}

			if ( notify ) {
				this.notifySelectionChange();
			}
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.selectedLayerIds = [];
			this.lastSelectedId = null;
			this.multiSelectMode = false;
			this.options = {};
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Selection = window.Layers.Selection || {};
		window.Layers.Selection.SelectionState = SelectionState;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = SelectionState;
	}

}() );
