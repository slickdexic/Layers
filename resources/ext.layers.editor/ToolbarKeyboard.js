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
	 * @param {Object} toolbar - Reference to the parent Toolbar instance
	 */
	function ToolbarKeyboard( toolbar ) {
		this.toolbar = toolbar;
		this.editor = toolbar.editor;
	}

	/**
	 * Handle keyboard shortcuts
	 * @param {KeyboardEvent} e - The keyboard event
	 */
	ToolbarKeyboard.prototype.handleKeyboardShortcuts = function ( e ) {
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
	};

	/**
	 * Handle Ctrl/Cmd shortcuts
	 * @param {KeyboardEvent} e - The keyboard event
	 * @param {string} key - The lowercase key
	 */
	ToolbarKeyboard.prototype.handleCtrlShortcuts = function ( e, key ) {
		switch ( key ) {
			case 'z':
				e.preventDefault();
				if ( e.shiftKey ) {
					this.editor.redo();
				} else {
					this.editor.undo();
				}
				break;
			case 'y':
				e.preventDefault();
				this.editor.redo();
				break;
			case 's':
				e.preventDefault();
				this.editor.save();
				break;
			case 'd':
				e.preventDefault();
				this.editor.duplicateSelected();
				break;
		}
	};

	/**
	 * Handle tool selection shortcuts (no modifier)
	 * @param {KeyboardEvent} e - The keyboard event
	 * @param {string} key - The lowercase key
	 */
	ToolbarKeyboard.prototype.handleToolShortcuts = function ( e, key ) {
		switch ( key ) {
			case 'v':
				this.toolbar.selectTool( 'pointer' );
				break;
			case 't':
				this.toolbar.selectTool( 'text' );
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
			case 's':
				this.toolbar.selectTool( 'star' );
				break;
			case 'b':
				this.toolbar.selectTool( 'blur' );
				break;
			case 'a':
				this.toolbar.selectTool( 'arrow' );
				break;
			case 'l':
				this.toolbar.selectTool( 'line' );
				break;
			case 'g':
				this.toolbar.toggleGrid();
				break;
			case 'delete':
			case 'backspace':
				this.editor.deleteSelected();
				break;
			case 'escape':
				this.editor.cancel();
				break;
		}
	};

	/**
	 * Get keyboard shortcuts configuration for documentation/help
	 * @return {Array<Object>} Array of shortcut definitions
	 */
	ToolbarKeyboard.prototype.getShortcutsConfig = function () {
		return [
			// Tool shortcuts
			{ key: 'V', description: 'Select Tool', category: 'tools' },
			{ key: 'T', description: 'Text Tool', category: 'tools' },
			{ key: 'P', description: 'Pen Tool', category: 'tools' },
			{ key: 'R', description: 'Rectangle Tool', category: 'tools' },
			{ key: 'C', description: 'Circle Tool', category: 'tools' },
			{ key: 'E', description: 'Ellipse Tool', category: 'tools' },
			{ key: 'S', description: 'Star Tool', category: 'tools' },
			{ key: 'A', description: 'Arrow Tool', category: 'tools' },
			{ key: 'L', description: 'Line Tool', category: 'tools' },
			{ key: 'B', description: 'Blur/Redact Tool', category: 'tools' },
			{ key: 'G', description: 'Toggle Grid', category: 'view' },
			// Ctrl shortcuts
			{ key: 'Ctrl+Z', description: 'Undo', category: 'edit' },
			{ key: 'Ctrl+Shift+Z', description: 'Redo', category: 'edit' },
			{ key: 'Ctrl+Y', description: 'Redo', category: 'edit' },
			{ key: 'Ctrl+S', description: 'Save', category: 'file' },
			{ key: 'Ctrl+D', description: 'Duplicate', category: 'edit' },
			// Other
			{ key: 'Delete/Backspace', description: 'Delete Selected', category: 'edit' },
			{ key: 'Escape', description: 'Cancel Operation', category: 'general' }
		];
	};

	// Export to window namespace
	if ( typeof window !== 'undefined' ) {
		window.ToolbarKeyboard = ToolbarKeyboard;
	}

	// Export via CommonJS for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { ToolbarKeyboard };
	}

} )();
