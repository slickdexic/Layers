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
	 * @constructor
	 * @param {Object} canvasManager - Reference to the parent CanvasManager
	 */
	function ClipboardController( canvasManager ) {
		this.canvasManager = canvasManager;
		this.clipboard = [];
	}

	/**
	 * Copy selected layers to the clipboard
	 *
	 * @return {number} Number of layers copied
	 */
	ClipboardController.prototype.copySelected = function () {
		const cm = this.canvasManager;
		const editor = cm.editor;
		const selectedIds = cm.getSelectedLayerIds ? cm.getSelectedLayerIds() : ( cm.selectedLayerIds || [] );

		this.clipboard = [];

		selectedIds.forEach( ( id ) => {
			const layer = editor.getLayerById( id );
			if ( layer ) {
				// Deep clone the layer
				this.clipboard.push( JSON.parse( JSON.stringify( layer ) ) );
			}
		} );

		return this.clipboard.length;
	};

	/**
	 * Paste layers from the clipboard
	 *
	 * @return {Array} Array of pasted layer IDs
	 */
	ClipboardController.prototype.paste = function () {
		if ( !this.clipboard || this.clipboard.length === 0 ) {
			return [];
		}

		const cm = this.canvasManager;
		const editor = cm.editor;
		const pastedIds = [];

		editor.saveState();

		this.clipboard.forEach( ( layer ) => {
			const clone = JSON.parse( JSON.stringify( layer ) );

			// Apply offset to pasted layers
			this.applyPasteOffset( clone );

			// Generate new unique ID
			clone.id = this.generateLayerId( editor );

			// Insert at top of layer stack
			editor.layers.unshift( clone );
			pastedIds.push( clone.id );
		} );

		// Select the last pasted layer
		if ( pastedIds.length > 0 ) {
			if ( cm.setSelectedLayerIds ) {
				cm.setSelectedLayerIds( pastedIds );
			} else {
				cm.selectedLayerId = pastedIds[ pastedIds.length - 1 ];
				cm.selectedLayerIds = pastedIds;
			}
		}

		cm.renderLayers( editor.layers );
		editor.markDirty();

		return pastedIds;
	};

	/**
	 * Cut selected layers (copy then delete)
	 *
	 * @return {number} Number of layers cut
	 */
	ClipboardController.prototype.cutSelected = function () {
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
		editor.layers = editor.layers.filter( ( layer ) => {
			return ids.indexOf( layer.id ) === -1;
		} );

		cm.deselectAll();
		cm.renderLayers( editor.layers );
		editor.markDirty();

		return count;
	};

	/**
	 * Check if clipboard has content
	 *
	 * @return {boolean} True if clipboard has layers
	 */
	ClipboardController.prototype.hasContent = function () {
		return this.clipboard && this.clipboard.length > 0;
	};

	/**
	 * Get the number of items in the clipboard
	 *
	 * @return {number} Number of layers in clipboard
	 */
	ClipboardController.prototype.getCount = function () {
		return this.clipboard ? this.clipboard.length : 0;
	};

	/**
	 * Clear the clipboard
	 */
	ClipboardController.prototype.clear = function () {
		this.clipboard = [];
	};

	/**
	 * Apply paste offset to a layer's position properties
	 *
	 * @private
	 * @param {Object} layer - Layer to offset
	 */
	ClipboardController.prototype.applyPasteOffset = function ( layer ) {
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

		// Offset polygon/path points
		if ( layer.points && Array.isArray( layer.points ) ) {
			layer.points = layer.points.map( ( p ) => {
				return { x: p.x + PASTE_OFFSET, y: p.y + PASTE_OFFSET };
			} );
		}
	};

	/**
	 * Generate a unique layer ID
	 *
	 * @private
	 * @param {Object} editor - Editor instance
	 * @return {string} Unique layer ID
	 */
	ClipboardController.prototype.generateLayerId = function ( editor ) {
		if ( editor && typeof editor.generateLayerId === 'function' ) {
			return editor.generateLayerId();
		}
		// Fallback ID generation
		return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	};

	/**
	 * Clean up resources
	 */
	ClipboardController.prototype.destroy = function () {
		this.clipboard = [];
		this.canvasManager = null;
	};

	// Export for MediaWiki ResourceLoader
	window.ClipboardController = ClipboardController;

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ClipboardController;
	}
}() );
