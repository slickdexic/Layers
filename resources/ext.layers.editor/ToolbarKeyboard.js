/**
 * Toolbar Keyboard Shortcuts Module
 * Handles keyboard shortcut processing for the Layers Editor toolbar.
 * Extracted from Toolbar.js for better separation of concerns.
 */
( function () {
	'use strict';

	/**
	 * ToolbarKeyboard - Manages keyboard shortcuts for the toolbar
	 *
	 * @class
	 */
	class ToolbarKeyboard {
		/**
		 * Create a new ToolbarKeyboard instance
		 *
		 * @param {Object} toolbar - Reference to the parent Toolbar instance
		 */
		constructor( toolbar ) {
			this.toolbar = toolbar;
			this.editor = toolbar.editor;
		}

		/**
		 * Handle keyboard shortcuts
		 *
		 * @param {KeyboardEvent} e - The keyboard event
		 */
		handleKeyboardShortcuts( e ) {
		// Don't handle shortcuts when typing in input fields
		if ( e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true' ) {
			return;
		}

		const key = e.key.toLowerCase();
		const ctrl = e.ctrlKey || e.metaKey;

		if ( ctrl ) {
			this.handleCtrlShortcuts( e, key );
		} else {
			this.handleToolShortcuts( e, key );
		}
	}

	/**
	 * Handle Ctrl/Cmd shortcuts
	 *
	 * @param {KeyboardEvent} e - The keyboard event
	 * @param {string} key - The lowercase key
	 */
	handleCtrlShortcuts( e, key ) {
		switch ( key ) {
			// Note: Ctrl+Z/Y undo/redo, Ctrl+S save, and Ctrl+D duplicate are handled
			// by EventManager to avoid duplicate handlers. Only toolbar-specific shortcuts here.
			case 'g':
				e.preventDefault();
				if ( e.shiftKey ) {
					this.ungroupSelected();
				} else {
					this.groupSelected();
				}
				break;
		}
	}

	/**
	 * Group currently selected layers
	 * Delegates to GroupManager if available
	 */
	groupSelected() {
		if ( !this.editor.groupManager ) {
			return;
		}

		const result = this.editor.groupManager.groupSelected();
		if ( result ) {
			// Show success message
			const msg = typeof mw !== 'undefined' && mw.message ?
				mw.message( 'layers-group-success' ).text() : 'Layers grouped';
			if ( this.editor.showStatus ) {
				this.editor.showStatus( msg, 1500 );
			}
			// Redraw canvas
			if ( this.editor.canvasManager ) {
				this.editor.canvasManager.redraw();
			}
			// Update layer panel
			if ( this.editor.layerPanel ) {
				this.editor.layerPanel.renderLayerList();
			}
		}
	}

	/**
	 * Ungroup currently selected group
	 * Delegates to GroupManager if available
	 */
	ungroupSelected() {
		if ( !this.editor.groupManager ) {
			return;
		}

		const result = this.editor.groupManager.ungroupSelected();
		if ( result ) {
			// Show success message
			const msg = typeof mw !== 'undefined' && mw.message ?
				mw.message( 'layers-ungroup-success' ).text() : 'Group dissolved';
			if ( this.editor.showStatus ) {
				this.editor.showStatus( msg, 1500 );
			}
			// Redraw canvas
			if ( this.editor.canvasManager ) {
				this.editor.canvasManager.redraw();
			}
			// Update layer panel
			if ( this.editor.layerPanel ) {
				this.editor.layerPanel.renderLayerList();
			}
		}
	}

	/**
	 * Handle tool selection shortcuts (no modifier)
	 *
	 * @param {KeyboardEvent} e - The keyboard event
	 * @param {string} key - The lowercase key
	 */
	handleToolShortcuts( e, key ) {
		// Handle Shift+? for keyboard shortcuts help
		if ( e.shiftKey && key === '?' ) {
			e.preventDefault();
			this.showKeyboardShortcutsHelp();
			return;
		}

		// Handle Shift+B for background visibility toggle
		if ( e.shiftKey && key === 'b' ) {
			e.preventDefault();
			this.toggleBackgroundVisibility();
			return;
		}

		// Handle Shift+D for angle dimension tool
		if ( e.shiftKey && key === 'd' ) {
			e.preventDefault();
			this.toolbar.selectTool( 'angleDimension' );
			return;
		}

		switch ( key ) {
			case ';':
				e.preventDefault();
				this.toggleSmartGuides();
				break;
			case '\'':
				e.preventDefault();
				this.toggleCanvasSnap();
				break;
			case 'v':
				this.toolbar.selectTool( 'pointer' );
				break;
			case 't':
				this.toolbar.selectTool( 'text' );
				break;
			case 'x':
				this.toolbar.selectTool( 'textbox' );
				break;
			case 'p':
				this.toolbar.selectTool( 'pen' );
				break;
			case 'r':
				this.toolbar.selectTool( 'rectangle' );
				break;
			case 'c':
				this.toolbar.selectTool( 'circle' );
				break;
			case 'e':
				this.toolbar.selectTool( 'ellipse' );
				break;
			case 'y':
				this.toolbar.selectTool( 'polygon' );
				break;
			case 's':
				this.toolbar.selectTool( 'star' );
				break;
			case 'b':
				this.toolbar.selectTool( 'callout' );
				break;
			case 'a':
				this.toolbar.selectTool( 'arrow' );
				break;
			case 'l':
				this.toolbar.selectTool( 'line' );
				break;
			case 'd':
				this.toolbar.selectTool( 'dimension' );
				break;
			case '+':
			case '=':
				e.preventDefault();
				this.handleZoom( 'in' );
				break;
			case '-':
				e.preventDefault();
				this.handleZoom( 'out' );
				break;
			case '0':
				e.preventDefault();
				this.handleZoom( 'fit' );
				break;
			case 'delete':
			case 'backspace':
				this.editor.deleteSelected();
				break;
			case 'escape':
				// Cancel multi-phase angle dimension if in progress
				if ( this.editor.canvasManager && this.editor.canvasManager.drawingController &&
					this.editor.canvasManager.drawingController.isAngleDimensionInProgress() ) {
					this.editor.canvasManager.drawingController.cancelAngleDimension();
					this.editor.canvasManager.tempLayer = null;
					this.editor.canvasManager.renderLayers( this.editor.layers );
					this.toolbar.selectTool( 'pointer' );
				} else {
					this.editor.cancel();
				}
				break;
		}
	}

	/**
	 * Toggle smart guides on/off
	 * Uses CanvasManager's SmartGuidesController
	 */
	toggleSmartGuides() {
		if ( !this.editor.canvasManager || !this.editor.canvasManager.smartGuidesController ) {
			return;
		}

		const controller = this.editor.canvasManager.smartGuidesController;
		const newState = !controller.enabled;
		controller.setEnabled( newState );

		// Update toolbar button state if it exists
		if ( this.toolbar.updateSmartGuidesButton ) {
			this.toolbar.updateSmartGuidesButton( newState );
		}

		// Show brief status message
		let msg;
		if ( typeof mw !== 'undefined' && mw.message ) {
			msg = newState ?
				mw.message( 'layers-smart-guides-on' ).text() :
				mw.message( 'layers-smart-guides-off' ).text();
		} else {
			msg = newState ? 'Smart Guides: On' : 'Smart Guides: Off';
		}
		if ( this.editor.showStatus ) {
			this.editor.showStatus( msg, 1500 );
		}
	}

	/**
	 * Toggle canvas snap on/off
	 * Uses CanvasManager's SmartGuidesController
	 */
	toggleCanvasSnap() {
		if ( !this.editor.canvasManager || !this.editor.canvasManager.smartGuidesController ) {
			return;
		}

		const controller = this.editor.canvasManager.smartGuidesController;
		const newState = !controller.canvasSnapEnabled;
		controller.setCanvasSnapEnabled( newState );

		// Update toolbar button state if it exists
		if ( this.toolbar.updateCanvasSnapButton ) {
			this.toolbar.updateCanvasSnapButton( newState );
		}

		// Show brief status message
		const msg = newState ? 'Canvas Snap: On' : 'Canvas Snap: Off';
		if ( this.editor.showStatus ) {
			this.editor.showStatus( msg, 1500 );
		}
	}

	/**
	 * Toggle background visibility
	 * Uses LayerPanel if available, otherwise directly updates StateManager
	 */
	toggleBackgroundVisibility() {
		// Try LayerPanel first (preferred - handles UI update)
		if ( this.editor.layerPanel && typeof this.editor.layerPanel.toggleBackgroundVisibility === 'function' ) {
			this.editor.layerPanel.toggleBackgroundVisibility();
			return;
		}

		// Fallback to direct state manipulation
		if ( this.editor.stateManager ) {
			const current = this.editor.stateManager.get( 'backgroundVisible' );
			this.editor.stateManager.set( 'backgroundVisible', !current );
			// Trigger redraw
			if ( this.editor.canvasManager ) {
				this.editor.canvasManager.redraw();
			}
		}
	}

	/**
	 * Handle zoom keyboard shortcuts
	 *
	 * @param {string} action - 'in', 'out', or 'fit'
	 */
	handleZoom( action ) {
		if ( !this.editor.canvasManager ) {
			return;
		}

		const cm = this.editor.canvasManager;
		switch ( action ) {
			case 'in':
				if ( typeof cm.zoomIn === 'function' ) {
					cm.zoomIn();
				} else if ( cm.zoomPanController && typeof cm.zoomPanController.zoomIn === 'function' ) {
					cm.zoomPanController.zoomIn();
				}
				break;
			case 'out':
				if ( typeof cm.zoomOut === 'function' ) {
					cm.zoomOut();
				} else if ( cm.zoomPanController && typeof cm.zoomPanController.zoomOut === 'function' ) {
					cm.zoomPanController.zoomOut();
				}
				break;
			case 'fit':
				if ( typeof cm.fitToWindow === 'function' ) {
					cm.fitToWindow();
				} else if ( cm.zoomPanController && typeof cm.zoomPanController.fitToWindow === 'function' ) {
					cm.zoomPanController.fitToWindow();
				}
				break;
		}
	}

	/**
	 * Get keyboard shortcuts configuration for documentation/help
	 *
	 * @return {Array<Object>} Array of shortcut definitions
	 */
	getShortcutsConfig() {
		return [
			// Tool shortcuts
			{ key: 'V', description: mw.message( 'layers-tool-select' ).text(), category: 'tools' },
			{ key: 'T', description: mw.message( 'layers-tool-text' ).text(), category: 'tools' },
			{ key: 'X', description: mw.message( 'layers-tool-textbox' ).text(), category: 'tools' },
			{ key: 'P', description: mw.message( 'layers-tool-pen' ).text(), category: 'tools' },
			{ key: 'R', description: mw.message( 'layers-tool-rectangle' ).text(), category: 'tools' },
			{ key: 'C', description: mw.message( 'layers-tool-circle' ).text(), category: 'tools' },
			{ key: 'E', description: mw.message( 'layers-tool-ellipse' ).text(), category: 'tools' },
			{ key: 'Y', description: mw.message( 'layers-tool-polygon' ).text(), category: 'tools' },
			{ key: 'S', description: mw.message( 'layers-tool-star' ).text(), category: 'tools' },
			{ key: 'A', description: mw.message( 'layers-tool-arrow' ).text(), category: 'tools' },
			{ key: 'L', description: mw.message( 'layers-tool-line' ).text(), category: 'tools' },
			{ key: 'B', description: mw.message( 'layers-tool-callout' ).text(), category: 'tools' },

			// View shortcuts
			{ key: '+/=', description: mw.message( 'layers-zoom-in' ).text(), category: 'view' },
			{ key: '-', description: mw.message( 'layers-zoom-out' ).text(), category: 'view' },
			{ key: '0', description: mw.message( 'layers-zoom-fit' ).text(), category: 'view' },
			{ key: ';', description: mw.message( 'layers-shortcut-smart-guides' ).text(), category: 'view' },
			{ key: "'", description: mw.message( 'layers-shortcut-toggle-snap' ).text(), category: 'view' },
			{ key: 'Shift+B', description: mw.message( 'layers-shortcut-toggle-background' ).text(), category: 'view' },
			// Ctrl shortcuts
			{ key: 'Ctrl+Z', description: mw.message( 'layers-undo' ).text(), category: 'edit' },
			{ key: 'Ctrl+Shift+Z', description: mw.message( 'layers-redo' ).text(), category: 'edit' },
			{ key: 'Ctrl+Y', description: mw.message( 'layers-redo' ).text(), category: 'edit' },
			{ key: 'Ctrl+S', description: mw.message( 'layers-shortcut-save' ).text(), category: 'file' },
			{ key: 'Ctrl+D', description: mw.message( 'layers-duplicate-selected' ).text(), category: 'edit' },
			{ key: 'Ctrl+G', description: mw.message( 'layers-shortcut-group' ).text(), category: 'layers' },
			{ key: 'Ctrl+Shift+G', description: mw.message( 'layers-shortcut-ungroup' ).text(), category: 'layers' },
			// Other
			{ key: 'Delete/Backspace', description: mw.message( 'layers-delete-selected' ).text(), category: 'edit' },
			{ key: 'Escape', description: mw.message( 'layers-shortcut-cancel' ).text(), category: 'general' },
			{ key: 'Shift+?', description: mw.message( 'layers-shortcut-show-help' ).text(), category: 'general' }
		];
	}

	/**
	 * Show the keyboard shortcuts help dialog
	 * Delegates to DialogManager if available, falls back to editor method
	 */
	showKeyboardShortcutsHelp() {
		if ( this.editor.dialogManager && typeof this.editor.dialogManager.showKeyboardShortcutsDialog === 'function' ) {
			this.editor.dialogManager.showKeyboardShortcutsDialog();
		} else if ( typeof this.editor.showKeyboardShortcutsDialog === 'function' ) {
			this.editor.showKeyboardShortcutsDialog();
		}
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.ToolbarKeyboard = ToolbarKeyboard;
	}

	// Export via CommonJS for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { ToolbarKeyboard };
	}

} )();
