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
	 * Check if an element is an input element (input, textarea, or contentEditable)
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
	 */
	handleUndo() {
		if ( this.editor && typeof this.editor.undo === 'function' ) {
			if ( this.editor.undo() ) {
				// Trigger re-render
				if ( typeof this.editor.renderLayers === 'function' ) {
					this.editor.renderLayers();
				}
				// Mark as dirty
				if ( typeof this.editor.markDirty === 'function' ) {
					this.editor.markDirty();
				}
			}
		}
	}

	/**
	 * Handle redo keyboard shortcut (Ctrl+Y or Ctrl+Shift+Z)
	 */
	handleRedo() {
		if ( this.editor && typeof this.editor.redo === 'function' ) {
			if ( this.editor.redo() ) {
				// Trigger re-render
				if ( typeof this.editor.renderLayers === 'function' ) {
					this.editor.renderLayers();
				}
				// Mark as dirty
				if ( typeof this.editor.markDirty === 'function' ) {
					this.editor.markDirty();
				}
			}
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