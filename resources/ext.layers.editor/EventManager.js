/**
 * Event Manager for Layers Editor
 * Centralized event handling and management
 */
class EventManager {
	constructor( editor ) {
		this.editor = editor;
		this.handlers = {};
		this.setupGlobalHandlers();
	}

	setupGlobalHandlers() {
		this.handlers.resize = this.handleResize.bind( this );
		this.handlers.beforeUnload = this.handleBeforeUnload.bind( this );
		this.handlers.keyDown = this.handleKeyDown.bind( this );

		window.addEventListener( 'resize', this.handlers.resize );
		window.addEventListener( 'beforeunload', this.handlers.beforeUnload );
		document.addEventListener( 'keydown', this.handlers.keyDown );
	}

	handleResize() {
		// Handle window resize
		if ( this.editor.canvasManager && typeof this.editor.canvasManager.resizeCanvas === 'function' ) {
			this.editor.canvasManager.resizeCanvas();
		}
	}

	handleBeforeUnload( e ) {
		// Check isDirty using the method, not property
		if ( this.editor && typeof this.editor.isDirty === 'function' && this.editor.isDirty() ) {
			e.preventDefault();
			e.returnValue = '';
		}
	}

	handleKeyDown( e ) {
		// Ignore if user is typing in an input field
		if ( this.isInputElement( e.target ) ) {
			return;
		}

		const ctrlOrCmd = e.ctrlKey || e.metaKey;

		switch ( true ) {
			case ctrlOrCmd && e.key === 'z' && !e.shiftKey:
				e.preventDefault();
				this.handleUndo();
				break;
			case ctrlOrCmd && ( e.key === 'y' || ( e.key === 'z' && e.shiftKey ) ):
				e.preventDefault();
				this.handleRedo();
				break;
			case ctrlOrCmd && e.key === 's':
				e.preventDefault();
				this.editor.save();
				break;
			case e.key === 'Delete' || e.key === 'Backspace':
				e.preventDefault();
				this.editor.deleteSelected();
				break;
			case ctrlOrCmd && e.key === 'd':
				e.preventDefault();
				this.editor.duplicateSelected();
				break;
			case e.key === 'Escape':
				e.preventDefault();
				this.editor.cancel( true );
				break;
		}
	}

	isInputElement( element ) {
		const tagName = element.tagName;
		return tagName === 'INPUT' ||
			tagName === 'TEXTAREA' ||
			element.contentEditable === 'true';
	}

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

	destroy() {
		Object.values( this.handlers ).forEach( handler => {
			if ( typeof handler === 'function' ) {
				// Remove event listeners - we'd need to track which elements they were added to
				// For now, this is a placeholder for cleanup
			}
		} );
		this.handlers = {};
	}
}

// Export EventManager to global scope
window.EventManager = EventManager;