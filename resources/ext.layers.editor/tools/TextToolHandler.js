/**
 * Text Tool Handler for Layers Editor
 * Handles text layer creation via inline text input
 *
 * Extracted from ToolManager.js to reduce god class size.
 *
 * @module tools/TextToolHandler
 */
( function () {
	'use strict';

	/**
	 * TextToolHandler class
	 * Manages the inline text editor for creating text layers
	 *
	 * @class
	 */
	class TextToolHandler {
		/**
		 * Create a TextToolHandler instance
		 *
		 * @param {Object} config Configuration object
		 * @param {Object} config.canvasManager Reference to canvas manager
		 * @param {Object} config.styleManager Reference to style manager for current styles
		 * @param {Function} config.addLayerCallback Callback to add created layer
		 */
		constructor( config ) {
			this.config = config || {};
			this.canvasManager = config.canvasManager || null;
			this.styleManager = config.styleManager || null;
			this.addLayerCallback = config.addLayerCallback || null;

			// Text editing state
			this.textEditor = null;
			this.editingTextLayer = null;
		}

		/**
		 * Get current style, falling back to defaults
		 *
		 * @private
		 * @return {Object} Current style object
		 */
		_getCurrentStyle() {
			if ( this.styleManager && typeof this.styleManager.get === 'function' ) {
				return this.styleManager.get();
			}
			if ( this.styleManager && this.styleManager.currentStyle ) {
				return this.styleManager.currentStyle;
			}
			// Fallback defaults
			return {
				fontSize: 16,
				fontFamily: 'Arial, sans-serif',
				color: '#000000'
			};
		}

		/**
		 * Start text tool - show the inline text editor
		 *
		 * @param {Object} point Click point { x, y }
		 */
		start( point ) {
			this.showTextEditor( point );
		}

		/**
		 * Show the inline text editor at the specified point
		 *
		 * @param {Object} point Position to show editor { x, y }
		 */
		showTextEditor( point ) {
			// Hide any existing editor first
			this.hideTextEditor();

			const style = this._getCurrentStyle();

			const input = document.createElement( 'input' );
			input.type = 'text';
			input.className = 'layers-text-editor';
			input.style.position = 'absolute';
			input.style.left = point.x + 'px';
			input.style.top = point.y + 'px';
			input.style.fontSize = ( style.fontSize || 16 ) + 'px';
			input.style.fontFamily = style.fontFamily || 'Arial, sans-serif';
			input.style.color = style.color || '#000000';
			input.style.border = '1px solid #ccc';
			input.style.background = 'white';
			input.style.zIndex = '1001';

			// Handle keyboard events
			input.addEventListener( 'keydown', ( e ) => {
				if ( e.key === 'Enter' ) {
					this.finishTextEditing( input, point );
				} else if ( e.key === 'Escape' ) {
					this.hideTextEditor();
				}
			} );

			// Handle blur (clicking away)
			input.addEventListener( 'blur', () => {
				this.finishTextEditing( input, point );
			} );

			// Append to the appropriate container
			const container = this._getEditorContainer();
			container.appendChild( input );

			this.textEditor = input;
			input.focus();
		}

		/**
		 * Get the container element for the text editor
		 *
		 * @private
		 * @return {HTMLElement} Container element
		 */
		_getEditorContainer() {
			// Prefer the main editor container for correct stacking context
			if ( this.canvasManager &&
				this.canvasManager.editor &&
				this.canvasManager.editor.ui &&
				this.canvasManager.editor.ui.mainContainer ) {
				return this.canvasManager.editor.ui.mainContainer;
			}
			if ( this.canvasManager && this.canvasManager.container ) {
				return this.canvasManager.container;
			}
			// Fallback to body
			return document.body;
		}

		/**
		 * Hide and remove the text editor
		 */
		hideTextEditor() {
			if ( this.textEditor ) {
				if ( this.textEditor.parentNode ) {
					this.textEditor.parentNode.removeChild( this.textEditor );
				}
				this.textEditor = null;
			}
		}

		/**
		 * Finish text editing and create the text layer
		 *
		 * @param {HTMLInputElement} input The input element
		 * @param {Object} point Position point { x, y }
		 */
		finishTextEditing( input, point ) {
			const text = input.value.trim();

			if ( text && this.addLayerCallback ) {
				const style = this._getCurrentStyle();
				const layer = {
					type: 'text',
					x: point.x,
					y: point.y,
					text: text,
					fontSize: style.fontSize || 16,
					fontFamily: style.fontFamily || 'Arial, sans-serif',
					color: style.color || '#000000'
				};
				this.addLayerCallback( layer );
			}

			this.hideTextEditor();
		}

		/**
		 * Check if currently editing text
		 *
		 * @return {boolean} True if text editor is active
		 */
		isEditing() {
			return this.textEditor !== null;
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.hideTextEditor();
			this.textEditor = null;
			this.editingTextLayer = null;
			this.canvasManager = null;
			this.styleManager = null;
			this.addLayerCallback = null;
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Tools = window.Layers.Tools || {};
		window.Layers.Tools.TextToolHandler = TextToolHandler;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = TextToolHandler;
	}

}() );
