/**
 * TextInputController - Handles modal text input for creating text layers
 * Extracted from CanvasManager.js as part of P1.1 modularization
 *
 * @module ext.layers.editor.canvas.TextInputController
 */
( function () {
	'use strict';

	/**
	 * Get a translated message with fallback
	 *
	 * @param {string} key - Message key (without layers- prefix)
	 * @param {string} fallback - Fallback text if i18n unavailable
	 * @return {string} Translated message or fallback
	 */
	function msg( key, fallback ) {
		if ( typeof mw !== 'undefined' && mw.message ) {
			const message = mw.message( 'layers-' + key );
			if ( message.exists() ) {
				return message.text();
			}
		}
		return fallback;
	}

	/**
	 * TextInputController class
	 * Manages modal text input UI for creating text layers
	 */
class TextInputController {
	/**
	 * Creates a new TextInputController instance
	 *
	 * @param {CanvasManager} canvasManager - Reference to the parent canvas manager
	 */
	constructor( canvasManager ) {
		this.canvasManager = canvasManager;
		this.textInputModal = null;
	}

	/**
	 * Create and show a modal text input dialog
	 *
	 * @param {Object} point - Position for the new text layer {x, y}
	 * @param {Object} style - Style options for the text
	 * @param {number} [style.fontSize=16] - Font size in pixels
	 * @param {string} [style.fontFamily='Arial'] - Font family
	 * @param {string} [style.color='#000000'] - Text color
	 * @return {HTMLElement} The modal element
	 */
	createTextInputModal( point, style ) {
		// Remove any existing text editor
		this.hideTextInputModal();

		// Create modal container
		const modal = document.createElement( 'div' );
		modal.className = 'layers-text-modal';
		const zIndex = window.Layers.Constants.Z_INDEX.TEXT_INPUT_MODAL;
		modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
			'background:rgba(0,0,0,0.3);z-index:' + zIndex + ';display:flex;' +
			'align-items:center;justify-content:center;';

		// Create input container
		const container = document.createElement( 'div' );
		container.style.cssText = 'background:white;padding:20px;border-radius:8px;' +
			'box-shadow:0 4px 20px rgba(0,0,0,0.3);min-width:300px;';

		// Create label
		const label = document.createElement( 'label' );
		label.textContent = 'Enter text:';
		label.style.cssText = 'display:block;margin-bottom:8px;font-weight:bold;';

		// Create text input
		const input = document.createElement( 'input' );
		input.type = 'text';
		input.className = 'text-input';
		input.style.cssText = 'width:100%;padding:8px;font-size:' +
			( style.fontSize || 16 ) + 'px;font-family:' +
			( style.fontFamily || 'Arial' ) + ';border:1px solid #ccc;' +
			'border-radius:4px;box-sizing:border-box;';
		input.placeholder = msg( 'text-input-placeholder', 'Type your text here...' );

		// Create button container
		const buttons = document.createElement( 'div' );
		buttons.style.cssText = 'margin-top:12px;text-align:right;';

		// Cancel button
		const cancelBtn = document.createElement( 'button' );
		cancelBtn.textContent = msg( 'editor-cancel', 'Cancel' );
		cancelBtn.style.cssText = 'padding:8px 16px;margin-right:8px;cursor:pointer;';
		cancelBtn.addEventListener( 'click', () => {
			this.hideTextInputModal();
		} );

		// OK button
		const okBtn = document.createElement( 'button' );
		okBtn.textContent = msg( 'btn-ok', 'OK' );
		okBtn.style.cssText = 'padding:8px 16px;cursor:pointer;background:#4CAF50;' +
			'color:white;border:none;border-radius:4px;';
		okBtn.addEventListener( 'click', () => {
			this.finishTextInput( input, point, style );
		} );

		// Handle Enter key
		input.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' ) {
				e.preventDefault();
				this.finishTextInput( input, point, style );
			} else if ( e.key === 'Escape' ) {
				e.preventDefault();
				this.hideTextInputModal();
			}
		} );

		// Handle click outside to cancel
		modal.addEventListener( 'click', ( e ) => {
			if ( e.target === modal ) {
				this.hideTextInputModal();
			}
		} );

		// Assemble the modal
		buttons.appendChild( cancelBtn );
		buttons.appendChild( okBtn );
		container.appendChild( label );
		container.appendChild( input );
		container.appendChild( buttons );
		modal.appendChild( container );

		// Store reference for cleanup
		this.textInputModal = modal;

		return modal;
	}

	/**
	 * Finish text input and create text layer
	 *
	 * @param {HTMLInputElement} input - The text input element
	 * @param {Object} point - Position for the text layer
	 * @param {Object} style - Style options
	 */
	finishTextInput ( input, point, style ) {
		const text = input.value.trim();
		const editor = this.canvasManager.editor;

		if ( text && editor ) {
			const layer = {
				type: 'text',
				x: point.x,
				y: point.y,
				text: text,
				fontSize: style.fontSize || 16,
				fontFamily: style.fontFamily || 'Arial',
				color: style.color || '#000000'
			};
			editor.addLayer( layer );

			// Switch back to pointer tool
			if ( typeof editor.setCurrentTool === 'function' ) {
				editor.setCurrentTool( 'pointer' );
			}

			this.canvasManager.renderLayers( editor.layers );
		}
		this.hideTextInputModal();
	}

	/**
	 * Hide and remove text input modal
	 */
	hideTextInputModal () {
		if ( this.textInputModal ) {
			this.textInputModal.remove();
			this.textInputModal = null;
		}
		// Also clear reference on canvasManager for backward compat
		if ( this.canvasManager ) {
			this.canvasManager.textInputModal = null;
		}
	}

	/**
	 * Check if text input modal is currently visible
	 * @return {boolean} True if modal is visible
	 */
	isModalVisible () {
		return this.textInputModal !== null;
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		this.hideTextInputModal();
		this.canvasManager = null;
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.TextInputController = TextInputController;
	}

	// Node.js export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = TextInputController;
	}
}() );
