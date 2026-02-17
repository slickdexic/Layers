/**
 * Event Manager for Layers Editor
 * Centralized event handling and management
 *
 * @class EventManager
 */
class EventManager {
	/**
	 * Create an EventManager instance
	 *
	 * @param {Object} editor - Reference to the LayersEditor instance
	 */
	constructor( editor ) {
		this.editor = editor;
		this.listeners = [];
		this._handlersSetup = false;
		// Note: setupGlobalHandlers is called by LayersEditor.init() to support stub fallback
	}

	/**
	 * Register an event listener and track it for cleanup
	 *
	 * @param {EventTarget} target - The event target (window, document, or element)
	 * @param {string} type - The event type (e.g., 'click', 'keydown')
	 * @param {Function} handler - The event handler function
	 * @param {Object} [options] - Event listener options
	 */
	registerListener( target, type, handler, options ) {
		target.addEventListener( type, handler, options );
		this.listeners.push( { target, type, handler, options } );
	}

	/**
	 * Set up global event handlers for window and document
	 * Guarded against double-registration
	 */
	setupGlobalHandlers() {
		// Prevent double-registration (could be called from constructor and LayersEditor.init)
		if ( this._handlersSetup ) {
			return;
		}
		this._handlersSetup = true;

		this.registerListener( window, 'resize', this.handleResize.bind( this ) );
		this.registerListener( window, 'beforeunload', this.handleBeforeUnload.bind( this ) );
		this.registerListener( document, 'keydown', this.handleKeyDown.bind( this ) );
	}

	/**
	 * Handle window resize events
	 */
	handleResize() {
		// Handle window resize
		if ( this.editor.canvasManager && typeof this.editor.canvasManager.resizeCanvas === 'function' ) {
			this.editor.canvasManager.resizeCanvas();
		}
	}

	/**
	 * Handle beforeunload event to warn about unsaved changes
	 *
	 * @param {BeforeUnloadEvent} e - The beforeunload event
	 */
	handleBeforeUnload( e ) {
		// Check isDirty using the method, not property
		if ( this.editor && typeof this.editor.isDirty === 'function' && this.editor.isDirty() ) {
			e.preventDefault();
			e.returnValue = '';
		}
	}

	/**
	 * Handle global keyboard shortcuts
	 *
	 * @param {KeyboardEvent} e - The keydown event
	 */
	handleKeyDown( e ) {
		// Ignore if user is typing in an input field
		if ( this.isInputElement( e.target ) ) {
			return;
		}

		const ctrlOrCmd = e.ctrlKey || e.metaKey;
		const key = e.key.toLowerCase();

		// Handle arrow keys for nudging selected layers
		if ( this.handleArrowKeyNudge( e ) ) {
			return;
		}

		switch ( true ) {
			case ctrlOrCmd && key === 'z' && !e.shiftKey:
				e.preventDefault();
				this.handleUndo();
				break;
			case ctrlOrCmd && ( key === 'y' || ( key === 'z' && e.shiftKey ) ):
				e.preventDefault();
				this.handleRedo();
				break;
			case ctrlOrCmd && key === 's':
				e.preventDefault();
				this.editor.save();
				break;
			case e.key === 'Delete' || e.key === 'Backspace':
				e.preventDefault();
				this.editor.deleteSelected();
				break;
			case ctrlOrCmd && key === 'd':
				e.preventDefault();
				this.editor.duplicateSelected();
				break;
			case e.key === 'Escape':
				e.preventDefault();
				this.editor.cancel( true );
				break;
		}
	}

	/**
	 * Handle arrow key nudging of selected layers
	 *
	 * When layers are selected, arrow keys nudge them by 1px (10px with Shift).
	 * This follows standard UX conventions from Figma, Photoshop, etc.
	 *
	 * @param {KeyboardEvent} e - The keydown event
	 * @return {boolean} True if event was handled (layers were nudged)
	 */
	handleArrowKeyNudge( e ) {
		// Only handle arrow keys
		const arrowKeys = [ 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown' ];
		if ( !arrowKeys.includes( e.key ) ) {
			return false;
		}

		// Check if we have selected layers to nudge
		const selectionManager = this.editor.canvasManager?.selectionManager;
		if ( !selectionManager ) {
			return false;
		}

		const selectedLayers = selectionManager.getSelectedLayers?.() || [];
		if ( selectedLayers.length === 0 ) {
			// No selection - don't handle, let default panning behavior occur
			return false;
		}

		// Determine nudge amount: 10px with Shift, 1px otherwise
		const step = e.shiftKey ? 10 : 1;

		// Determine direction
		let dx = 0;
		let dy = 0;
		switch ( e.key ) {
			case 'ArrowLeft':
				dx = -step;
				break;
			case 'ArrowRight':
				dx = step;
				break;
			case 'ArrowUp':
				dy = -step;
				break;
			case 'ArrowDown':
				dy = step;
				break;
		}

		// Nudge the selected layers
		e.preventDefault();
		this.nudgeSelectedLayers( dx, dy );
		return true;
	}

	/**
	 * Nudge selected layers by the given offset
	 *
	 * @param {number} dx - Horizontal offset in pixels
	 * @param {number} dy - Vertical offset in pixels
	 */
	nudgeSelectedLayers( dx, dy ) {
		const selectionManager = this.editor.canvasManager?.selectionManager;
		const stateManager = this.editor.stateManager;
		if ( !selectionManager || !stateManager ) {
			return;
		}

		const selectedLayers = selectionManager.getSelectedLayers?.() || [];
		if ( selectedLayers.length === 0 ) {
			return;
		}

		// Batch the position updates
		selectedLayers.forEach( layer => {
			if ( layer && !layer.locked ) {
				// Update position
				layer.x = ( layer.x || 0 ) + dx;
				layer.y = ( layer.y || 0 ) + dy;
			}
		} );

		// Record history for undo/redo
		if ( this.editor.historyManager && typeof this.editor.historyManager.snapshot === 'function' ) {
			this.editor.historyManager.snapshot( 'nudge' );
		}

		// Mark as dirty and re-render
		if ( typeof this.editor.markDirty === 'function' ) {
			this.editor.markDirty();
		}
		if ( typeof this.editor.renderLayers === 'function' ) {
			this.editor.renderLayers();
		}

		// Update status bar with new position (if single layer)
		if ( selectedLayers.length === 1 && this.editor.updateStatusBar ) {
			this.editor.updateStatusBar();
		}
	}

	/**
	 * Check if an element is an input element (input, textarea, select,
	 * contentEditable, or OOUI text input widget)
	 *
	 * @param {Element} element - The DOM element to check
	 * @return {boolean} True if the element is an input element
	 */
	isInputElement( element ) {
		const tagName = element.tagName;
		return tagName === 'INPUT' ||
			tagName === 'TEXTAREA' ||
			element.contentEditable === 'true';
	}

	/**
	 * Handle undo keyboard shortcut (Ctrl+Z)
	 *
	 * Note: editor.undo() calls HistoryManager.undo() which calls restoreState(),
	 * and restoreState() already calls renderLayers() and markDirty().
	 * We intentionally don't call them again to avoid redundant re-renders.
	 */
	handleUndo() {
		if ( this.editor && typeof this.editor.undo === 'function' ) {
			this.editor.undo();
			// Note: renderLayers() and markDirty() are called by restoreState()
		}
	}

	/**
	 * Handle redo keyboard shortcut (Ctrl+Y or Ctrl+Shift+Z)
	 *
	 * Note: editor.redo() calls HistoryManager.redo() which calls restoreState(),
	 * and restoreState() already calls renderLayers() and markDirty().
	 * We intentionally don't call them again to avoid redundant re-renders.
	 */
	handleRedo() {
		if ( this.editor && typeof this.editor.redo === 'function' ) {
			this.editor.redo();
			// Note: renderLayers() and markDirty() are called by restoreState()
		}
	}

	/**
	 * Clean up all registered event listeners
	 * Called when the editor is destroyed to prevent memory leaks
	 */
	destroy() {
		this.listeners.forEach( listener => {
			listener.target.removeEventListener( listener.type, listener.handler, listener.options );
		} );
		this.listeners = [];
	}
}

// Export to window.Layers namespace (preferred)
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.Core = window.Layers.Core || {};
	window.Layers.Core.EventManager = EventManager;
}

// CommonJS export for Jest testing
if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = EventManager;
}