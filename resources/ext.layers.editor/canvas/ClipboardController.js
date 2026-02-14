/**
 * Clipboard Controller - Handles copy/paste/cut operations for the Layers extension
 *
 * This module extracts clipboard logic from CanvasManager.js to provide a focused,
 * maintainable controller for all clipboard operations.
 *
 * Responsibilities:
 * - Copy selected layers to clipboard
 * - Paste layers from clipboard (with offset)
 * - Cut selected layers
 * - Generate unique IDs for pasted layers
 *
 * @class ClipboardController
 */
( function () {
	'use strict';

	/**
	 * Default offset applied to pasted layers
	 *
	 * @constant
	 */
	const PASTE_OFFSET = 20;

	/**
	 * ClipboardController - Handles copy/paste/cut operations
	 *
	 * @class
	 */
	class ClipboardController {
		/**
		 * Create a new ClipboardController instance
		 *
		 * @param {Object} canvasManager - Reference to the parent CanvasManager
		 */
		constructor( canvasManager ) {
			this.canvasManager = canvasManager;
			this.clipboard = [];
		}

		/**
		 * Deep clone a layer using the shared DeepClone utility
		 * Falls back to structuredClone or JSON if utility unavailable
		 *
		 * @private
		 * @param {Object} layer - Layer to clone
		 * @return {Object} Cloned layer
		 */
		_cloneLayer( layer ) {
			// Prefer the shared utility which handles all edge cases
			if ( window.Layers?.Utils?.deepCloneLayer ) {
				return window.Layers.Utils.deepCloneLayer( layer );
			}
			// Fallback to structuredClone (modern browsers)
			if ( typeof structuredClone === 'function' ) {
				return structuredClone( layer );
			}
			// Last resort: JSON (loses some types but works)
			return JSON.parse( JSON.stringify( layer ) );
		}

		/**
		 * Copy selected layers to the clipboard
		 *
		 * @return {number} Number of layers copied
		 */
		copySelected() {
		const cm = this.canvasManager;
		const editor = cm.editor;
		const selectedIds = cm.getSelectedLayerIds ? cm.getSelectedLayerIds() : ( cm.selectedLayerIds || [] );

		this.clipboard = [];

		selectedIds.forEach( ( id ) => {
			const layer = editor.getLayerById( id );
			if ( layer ) {
				// Deep clone the layer using shared utility
				this.clipboard.push( this._cloneLayer( layer ) );
			}
		} );

		return this.clipboard.length;
	}

	/**
	 * Paste layers from the clipboard
	 *
	 * @return {Array} Array of pasted layer IDs
	 */
	paste() {
		if ( !this.clipboard || this.clipboard.length === 0 ) {
			return [];
		}

		const cm = this.canvasManager;
		const editor = cm.editor;
		const pastedIds = [];

		editor.saveState();

		// Build new layers array with clones at top (consistent with cutSelected)
		const currentLayers = editor.stateManager ?
			editor.stateManager.getLayers() : editor.layers;
		const newLayers = currentLayers.slice();

		this.clipboard.forEach( ( layer ) => {
			const clone = this._cloneLayer( layer );

			// Apply offset to pasted layers
			this.applyPasteOffset( clone );

			// Generate new unique ID
			clone.id = this.generateLayerId( editor );

			// Insert at top of layer stack
			newLayers.unshift( clone );
			pastedIds.push( clone.id );
		} );

		// Update via StateManager for proper event broadcasting
		if ( editor.stateManager ) {
			editor.stateManager.set( 'layers', newLayers );
		} else {
			editor.layers = newLayers;
		}

		// Select the pasted layers
		if ( pastedIds.length > 0 ) {
			if ( cm.setSelectedLayerIds ) {
				cm.setSelectedLayerIds( pastedIds );
			} else {
				cm.selectedLayerId = pastedIds[ pastedIds.length - 1 ];
				cm.selectedLayerIds = pastedIds;
			}
			// Set lastSelectedId for key object alignment (last pasted is key object)
			if ( cm.selectionManager ) {
				cm.selectionManager.lastSelectedId = pastedIds[ pastedIds.length - 1 ];
			}
		}

		cm.renderLayers( editor.layers );
		editor.markDirty();

		return pastedIds;
	}

	/**
	 * Cut selected layers (copy then delete)
	 *
	 * @return {number} Number of layers cut
	 */
	cutSelected() {
		const cm = this.canvasManager;
		const editor = cm.editor;
		const selectedIds = cm.getSelectedLayerIds ? cm.getSelectedLayerIds() : ( cm.selectedLayerIds || [] );

		if ( selectedIds.length === 0 ) {
			return 0;
		}

		// First copy the selection
		const count = this.copySelected();

		// Then delete the original layers
		const ids = selectedIds.slice();
		editor.saveState();
		const remaining = editor.layers.filter( ( layer ) => {
			return !ids.includes( layer.id );
		} );
		if ( editor.stateManager ) {
			editor.stateManager.set( 'layers', remaining );
		} else {
			editor.layers = remaining;
		}

		cm.deselectAll();
		const layers = editor.stateManager ? editor.stateManager.getLayers() : editor.layers;
		cm.renderLayers( layers );
		editor.markDirty();

		return count;
	}

	/**
	 * Check if clipboard has content
	 *
	 * @return {boolean} True if clipboard has layers
	 */
	hasContent() {
		return this.clipboard && this.clipboard.length > 0;
	}

	/**
	 * Get the number of items in the clipboard
	 *
	 * @return {number} Number of layers in clipboard
	 */
	getCount() {
		return this.clipboard ? this.clipboard.length : 0;
	}

	/**
	 * Clear the clipboard
	 */
	clear() {
		this.clipboard = [];
	}

	/**
	 * Apply paste offset to a layer's position properties
	 *
	 * @private
	 * @param {Object} layer - Layer to offset
	 */
	applyPasteOffset( layer ) {
		// Offset standard position properties
		if ( layer.x !== undefined ) {
			layer.x = ( layer.x || 0 ) + PASTE_OFFSET;
		}
		if ( layer.y !== undefined ) {
			layer.y = ( layer.y || 0 ) + PASTE_OFFSET;
		}

		// Offset line/arrow endpoints
		if ( layer.x1 !== undefined ) {
			layer.x1 = ( layer.x1 || 0 ) + PASTE_OFFSET;
		}
		if ( layer.y1 !== undefined ) {
			layer.y1 = ( layer.y1 || 0 ) + PASTE_OFFSET;
		}
		if ( layer.x2 !== undefined ) {
			layer.x2 = ( layer.x2 || 0 ) + PASTE_OFFSET;
		}
		if ( layer.y2 !== undefined ) {
			layer.y2 = ( layer.y2 || 0 ) + PASTE_OFFSET;
		}

		// Offset curved arrow control points
		if ( layer.controlX !== undefined ) {
			layer.controlX = ( layer.controlX || 0 ) + PASTE_OFFSET;
		}
		if ( layer.controlY !== undefined ) {
			layer.controlY = ( layer.controlY || 0 ) + PASTE_OFFSET;
		}

		// Offset marker/callout arrow tip and tail tip
		if ( layer.arrowX !== undefined ) {
			layer.arrowX = ( layer.arrowX || 0 ) + PASTE_OFFSET;
		}
		if ( layer.arrowY !== undefined ) {
			layer.arrowY = ( layer.arrowY || 0 ) + PASTE_OFFSET;
		}
		if ( layer.tailTipX !== undefined ) {
			layer.tailTipX = ( layer.tailTipX || 0 ) + PASTE_OFFSET;
		}
		if ( layer.tailTipY !== undefined ) {
			layer.tailTipY = ( layer.tailTipY || 0 ) + PASTE_OFFSET;
		}

		// Offset polygon/path points
		if ( layer.points && Array.isArray( layer.points ) ) {
			layer.points = layer.points.map( ( p ) => {
				return { x: p.x + PASTE_OFFSET, y: p.y + PASTE_OFFSET };
			} );
		}
	}

	/**
	 * Generate a unique layer ID
	 *
	 * @private
	 * @param {Object} editor - Editor instance
	 * @return {string} Unique layer ID
	 */
	generateLayerId( editor ) {
		if ( editor && typeof editor.generateLayerId === 'function' ) {
			return editor.generateLayerId();
		}
		// Fallback ID generation
		return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		this.clipboard = [];
		this.canvasManager = null;
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.ClipboardController = ClipboardController;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ClipboardController;
	}
}() );
