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
				if ( this.editor.stateManager && this.editor.stateManager.get( 'currentTool' ) !== 'pointer' ) {
					this.editor.setCurrentTool( 'pointer' );
				} else {
					this.editor.cancel( true );
				}
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

		// Resize, rotation and z-order were reachable only by dragging handles with
		// a mouse, so keyboard-only users could position a layer but never size or
		// turn it.
		if ( e.ctrlKey || e.metaKey ) {
			e.preventDefault();
			this.resizeSelectedLayers( e.key, e.shiftKey ? 10 : 1 );
			return true;
		}
		if ( e.altKey ) {
			e.preventDefault();
			if ( e.key === 'ArrowLeft' || e.key === 'ArrowRight' ) {
				this.rotateSelectedLayers(
					( e.key === 'ArrowRight' ? 1 : -1 ) * ( e.shiftKey ? 15 : 1 )
				);
			} else {
				this.restackSelectedLayers( e.key === 'ArrowUp' );
			}
			return true;
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

		// Batch the position updates through StateManager so listeners are notified
		selectedLayers.forEach( layer => {
			if ( layer && !layer.locked ) {
				// dimension, line and arrow layers store position as x1/y1/x2/y2 instead of x/y
				let updates;
				if ( [ 'dimension', 'line', 'arrow' ].includes( layer.type ) ) {
					updates = {
						x1: ( layer.x1 || 0 ) + dx,
						y1: ( layer.y1 || 0 ) + dy,
						x2: ( layer.x2 || 0 ) + dx,
						y2: ( layer.y2 || 0 ) + dy
					};
				} else {
					updates = {
						x: ( layer.x || 0 ) + dx,
						y: ( layer.y || 0 ) + dy
					};
				}
				if ( typeof stateManager.updateLayer === 'function' ) {
					stateManager.updateLayer( layer.id, updates );
				} else {
					// Fallback for environments where StateManager lacks updateLayer
					Object.assign( layer, updates );
				}
			}
		} );

		// Record history for undo/redo
		if ( this.editor.historyManager && typeof this.editor.historyManager.saveState === 'function' ) {
			this.editor.historyManager.saveState( 'nudge' );
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
	 * Apply an update to every unlocked selected layer, then commit once.
	 *
	 * @param {Function} buildUpdates Receives a layer, returns an updates object
	 *   or null to skip that layer
	 * @param {string} historyLabel Label recorded in the undo stack
	 * @return {number} Number of layers changed
	 * @private
	 */
	applyToSelection( buildUpdates, historyLabel ) {
		const selectionManager = this.editor.canvasManager?.selectionManager;
		const stateManager = this.editor.stateManager;
		if ( !selectionManager || !stateManager ) {
			return 0;
		}

		const selectedLayers = selectionManager.getSelectedLayers?.() || [];
		let changed = 0;

		selectedLayers.forEach( ( layer ) => {
			if ( !layer || layer.locked ) {
				return;
			}
			const updates = buildUpdates( layer );
			if ( !updates ) {
				return;
			}
			changed++;
			if ( typeof stateManager.updateLayer === 'function' ) {
				stateManager.updateLayer( layer.id, updates );
			} else {
				Object.assign( layer, updates );
			}
		} );

		if ( changed === 0 ) {
			return 0;
		}

		if ( this.editor.historyManager && typeof this.editor.historyManager.saveState === 'function' ) {
			this.editor.historyManager.saveState( historyLabel );
		}
		if ( typeof this.editor.markDirty === 'function' ) {
			this.editor.markDirty();
		}
		if ( typeof this.editor.renderLayers === 'function' ) {
			this.editor.renderLayers();
		}
		if ( this.editor.updateStatusBar ) {
			this.editor.updateStatusBar();
		}
		return changed;
	}

	/**
	 * Grow or shrink the selection with the keyboard.
	 *
	 * @param {string} key Arrow key name
	 * @param {number} step Pixels per press
	 */
	resizeSelectedLayers( key, step ) {
		const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
		const delta = ( key === 'ArrowRight' || key === 'ArrowDown' ) ? step : -step;
		const MIN = 1;

		const changed = this.applyToSelection( ( layer ) => {
			// Layer types keep their size in three different shapes.
			if ( [ 'dimension', 'line', 'arrow' ].includes( layer.type ) ) {
				return horizontal ?
					{ x2: ( layer.x2 || 0 ) + delta } :
					{ y2: ( layer.y2 || 0 ) + delta };
			}
			if ( layer.radiusX !== undefined || layer.radiusY !== undefined ) {
				return horizontal ?
					{ radiusX: Math.max( MIN, ( layer.radiusX || 0 ) + delta ) } :
					{ radiusY: Math.max( MIN, ( layer.radiusY || 0 ) + delta ) };
			}
			if ( layer.radius !== undefined ) {
				return { radius: Math.max( MIN, ( layer.radius || 0 ) + delta ) };
			}
			if ( layer.width !== undefined || layer.height !== undefined ) {
				return horizontal ?
					{ width: Math.max( MIN, ( layer.width || 0 ) + delta ) } :
					{ height: Math.max( MIN, ( layer.height || 0 ) + delta ) };
			}
			// Text has no box; its size is the font size.
			if ( layer.type === 'text' ) {
				return { fontSize: Math.max( MIN, ( layer.fontSize || 16 ) + delta ) };
			}
			return null;
		}, 'resize' );

		this.announceTransform( changed, 'layers-aria-resized', 'Resized' );
	}

	/**
	 * Rotate the selection with the keyboard.
	 *
	 * @param {number} degrees Signed degrees per press
	 */
	rotateSelectedLayers( degrees ) {
		const changed = this.applyToSelection( ( layer ) => {
			const next = ( ( ( layer.rotation || 0 ) + degrees ) % 360 + 360 ) % 360;
			return { rotation: next };
		}, 'rotate' );

		this.announceTransform( changed, 'layers-aria-rotated', 'Rotated' );
	}

	/**
	 * Move the selection up or down the layer stack.
	 *
	 * @param {boolean} up True to raise, false to lower
	 */
	restackSelectedLayers( up ) {
		const selectionManager = this.editor.canvasManager?.selectionManager;
		const stateManager = this.editor.stateManager;
		if ( !selectionManager || !stateManager ) {
			return;
		}
		const move = up ? stateManager.moveLayerUp : stateManager.moveLayerDown;
		if ( typeof move !== 'function' ) {
			return;
		}

		const selectedLayers = selectionManager.getSelectedLayers?.() || [];
		let changed = 0;
		selectedLayers.forEach( ( layer ) => {
			if ( layer && !layer.locked ) {
				move.call( stateManager, layer.id );
				changed++;
			}
		} );
		if ( changed === 0 ) {
			return;
		}

		if ( this.editor.historyManager && typeof this.editor.historyManager.saveState === 'function' ) {
			this.editor.historyManager.saveState( 'restack' );
		}
		if ( typeof this.editor.markDirty === 'function' ) {
			this.editor.markDirty();
		}
		if ( typeof this.editor.renderLayers === 'function' ) {
			this.editor.renderLayers();
		}
		this.announceTransform(
			changed,
			up ? 'layers-aria-moved-up' : 'layers-aria-moved-down',
			up ? 'Moved up' : 'Moved down'
		);
	}

	/**
	 * Announce a keyboard transform, which produces no visible focus change.
	 *
	 * @param {number} changed Number of layers affected
	 * @param {string} key Message key
	 * @param {string} fallback English fallback
	 * @private
	 */
	announceTransform( changed, key, fallback ) {
		if ( !changed || !window.layersAnnouncer ) {
			return;
		}
		let text = fallback;
		if ( typeof mw !== 'undefined' && mw.message ) {
			const msg = mw.message( key );
			if ( msg.exists() ) {
				text = msg.text();
			}
		}
		window.layersAnnouncer.announce( text );
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
			tagName === 'SELECT' ||
			element.contentEditable === 'true' ||
			element.contentEditable === 'plaintext-only' ||
			element.getAttribute( 'role' ) === 'textbox' ||
			!!element.closest( '.oo-ui-textInputWidget' );
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