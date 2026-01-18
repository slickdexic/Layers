/**
 * InlineTextEditor - Canvas-based inline text editing
 *
 * Enables direct text editing on the canvas by overlaying an HTML textarea
 * that matches the text layer's position, size, and styling. This provides
 * a Figma/Canva-like editing experience where users can:
 * - Double-click a text layer to edit in place
 * - See real-time preview while typing
 * - Use standard text selection and cursor positioning
 *
 * @module ext.layers.editor.canvas.InlineTextEditor
 * @since 1.5.13
 */
( function () {
	'use strict';

	/**
	 * InlineTextEditor class
	 * Manages inline text editing overlay for text and textbox layers
	 */
	class InlineTextEditor {
		/**
		 * Creates a new InlineTextEditor instance
		 *
		 * @param {Object} canvasManager - Reference to the parent CanvasManager
		 */
		constructor( canvasManager ) {
			this.canvasManager = canvasManager;

			// Editing state
			this.isEditing = false;
			this.editingLayer = null;
			this.originalText = '';

			// DOM elements
			this.editorElement = null;
			this.containerElement = null;

			// Bound handlers for cleanup
			this._boundKeyHandler = null;
			this._boundBlurHandler = null;
			this._boundInputHandler = null;
			this._boundResizeHandler = null;

			// Debounce timer for input
			this._inputDebounceTimer = null;
		}

		/**
		 * Check if a layer type supports inline editing
		 *
		 * @param {Object} layer - Layer to check
		 * @return {boolean} True if layer supports inline editing
		 */
		canEdit( layer ) {
			if ( !layer ) {
				return false;
			}

			// Check if layer is locked
			if ( layer.locked ) {
				return false;
			}

			return layer.type === 'text' || layer.type === 'textbox';
		}

		/**
		 * Start inline editing for a text layer
		 *
		 * @param {Object} layer - The text layer to edit
		 * @return {boolean} True if editing started successfully
		 */
		startEditing( layer ) {
			if ( !this.canEdit( layer ) ) {
				return false;
			}

			// Don't start if already editing
			if ( this.isEditing ) {
				return false;
			}

			// Check for valid canvas manager state
			if ( !this.canvasManager || this.canvasManager.isDestroyed ) {
				return false;
			}

			// Check for required DOM elements
			if ( !this.canvasManager.container || !this.canvasManager.canvas ) {
				return false;
			}

			this.editingLayer = layer;
			this.originalText = layer.text || '';
			this.isEditing = true;

			// Create and position the editor
			this._createEditor();
			this._positionEditor();
			this._setupEventHandlers();

			// Focus the editor
			if ( this.editorElement ) {
				this.editorElement.focus();
				// Select all text for easy replacement
				this.editorElement.select();
			}

			// Notify canvas to hide selection handles during edit
			if ( this.canvasManager && typeof this.canvasManager.setTextEditingMode === 'function' ) {
				this.canvasManager.setTextEditingMode( true );
			}

			return true;
		}

		/**
		 * Finish editing and apply or discard changes
		 *
		 * @param {boolean} [apply=true] - Whether to apply changes (true) or discard (false)
		 * @return {boolean} True if changes were applied
		 */
		finishEditing( apply ) {
			if ( !this.isEditing ) {
				return false;
			}

			const shouldApply = apply !== false;
			let changesApplied = false;

			if ( shouldApply && this.editorElement && this.editingLayer ) {
				const newText = this.editorElement.value;

				// Only update if text actually changed
				if ( newText !== this.originalText ) {
					// Save state for undo before making changes
					if ( this.canvasManager && typeof this.canvasManager.saveState === 'function' ) {
						this.canvasManager.saveState( 'Edit text' );
					}

					// Update the layer
					this.editingLayer.text = newText;

					// For textbox, recalculate dimensions if needed
					if ( this.editingLayer.type === 'textbox' ) {
						this._updateTextBoxDimensions();
					}

					changesApplied = true;
				}
			}

			// Cleanup
			this._removeEditor();
			this._removeEventHandlers();

			// Clear state
			this.isEditing = false;
			this.editingLayer = null;
			this.originalText = '';

			// Notify canvas to restore normal mode
			if ( this.canvasManager ) {
				if ( typeof this.canvasManager.setTextEditingMode === 'function' ) {
					this.canvasManager.setTextEditingMode( false );
				}

				// Re-render to show updated text
				if ( changesApplied && this.canvasManager.editor ) {
					if ( typeof this.canvasManager.renderLayers === 'function' ) {
						this.canvasManager.renderLayers( this.canvasManager.editor.layers );
					} else if ( typeof this.canvasManager.redraw === 'function' ) {
						this.canvasManager.redraw( this.canvasManager.editor.layers );
					}
				}
			}

			return changesApplied;
		}

		/**
		 * Cancel editing and discard changes
		 */
		cancelEditing() {
			this.finishEditing( false );
		}

		/**
		 * Check if currently editing
		 *
		 * @return {boolean} True if in editing mode
		 */
		isActive() {
			return this.isEditing;
		}

		/**
		 * Get the layer being edited
		 *
		 * @return {Object|null} The layer being edited, or null
		 */
		getEditingLayer() {
			return this.editingLayer;
		}

		/**
		 * Create the editor element
		 *
		 * @private
		 */
		_createEditor() {
			const layer = this.editingLayer;
			if ( !layer ) {
				return;
			}

			// Determine if we need a textarea (multiline) or input (single line)
			const isMultiline = layer.type === 'textbox';

			// Create the appropriate element
			if ( isMultiline ) {
				this.editorElement = document.createElement( 'textarea' );
				this.editorElement.style.resize = 'none';
				this.editorElement.style.overflow = 'hidden';
			} else {
				this.editorElement = document.createElement( 'input' );
				this.editorElement.type = 'text';
			}

			// Set common attributes
			this.editorElement.className = 'layers-inline-text-editor';
			if ( isMultiline ) {
				this.editorElement.classList.add( 'textbox' );
			}
			this.editorElement.value = layer.text || '';

			// Apply text styling to match the layer
			this._applyLayerStyle();

			// Base styles for positioning
			const baseStyles = {
				position: 'absolute',
				boxSizing: 'border-box',
				border: '2px solid #0066cc',
				borderRadius: '2px',
				outline: 'none',
				background: 'rgba(255, 255, 255, 0.95)',
				zIndex: '10001',
				minWidth: '50px',
				minHeight: isMultiline ? '40px' : '20px'
			};

			Object.assign( this.editorElement.style, baseStyles );

			// Mobile keyboard optimization
			this.editorElement.setAttribute( 'inputmode', 'text' );
			this.editorElement.setAttribute( 'enterkeyhint', isMultiline ? 'enter' : 'done' );
			this.editorElement.setAttribute( 'autocomplete', 'off' );
			this.editorElement.setAttribute( 'autocorrect', 'off' );
			this.editorElement.setAttribute( 'spellcheck', 'true' );

			// Find the container to append to
			this.containerElement = this._getContainer();
			if ( this.containerElement ) {
				this.containerElement.appendChild( this.editorElement );
			}
		}

		/**
		 * Apply layer styling to the editor element
		 *
		 * @private
		 */
		_applyLayerStyle() {
			if ( !this.editorElement || !this.editingLayer ) {
				return;
			}

			const layer = this.editingLayer;
			const style = this.editorElement.style;

			// Font properties
			style.fontSize = ( layer.fontSize || 16 ) + 'px';
			style.fontFamily = layer.fontFamily || 'Arial, sans-serif';
			style.fontWeight = layer.fontWeight || 'normal';
			style.fontStyle = layer.fontStyle || 'normal';
			style.color = layer.color || layer.fill || '#000000';

			// Text alignment for textbox
			if ( layer.type === 'textbox' ) {
				style.textAlign = layer.textAlign || 'left';
				style.lineHeight = ( layer.lineHeight || 1.2 ).toString();
				style.padding = ( layer.padding || 8 ) + 'px';
			} else {
				style.textAlign = 'left';
				style.padding = '4px';
			}
		}

		/**
		 * Position the editor element to match the layer on canvas
		 *
		 * @private
		 */
		_positionEditor() {
			if ( !this.editorElement || !this.editingLayer || !this.canvasManager ) {
				return;
			}

			const layer = this.editingLayer;
			const canvas = this.canvasManager.canvas;
			if ( !canvas ) {
				return;
			}

			// Get canvas bounding rect for coordinate conversion
			const canvasRect = canvas.getBoundingClientRect();

			// Calculate scale from logical canvas to displayed size
			const scaleX = canvasRect.width / canvas.width;
			const scaleY = canvasRect.height / canvas.height;

			// Get layer position in canvas coordinates
			const x = layer.x || 0;
			let y = layer.y || 0;
			let width, height;

			if ( layer.type === 'textbox' ) {
				width = layer.width || 200;
				height = layer.height || 100;
			} else {
				// For simple text, measure the text to determine width
				width = this._measureTextWidth( layer ) + 20; // Add padding
				height = ( layer.fontSize || 16 ) + 16; // Font size + padding
				// Text baseline is at y, so adjust for top-left positioning
				y = y - ( layer.fontSize || 16 );
			}

			// Convert to screen coordinates
			const screenX = canvasRect.left + ( x * scaleX );
			const screenY = canvasRect.top + ( y * scaleY );
			const screenWidth = width * scaleX;
			const screenHeight = height * scaleY;

			// Apply position
			this.editorElement.style.left = screenX + 'px';
			this.editorElement.style.top = screenY + 'px';
			this.editorElement.style.width = Math.max( 50, screenWidth ) + 'px';

			if ( layer.type === 'textbox' ) {
				this.editorElement.style.height = Math.max( 40, screenHeight ) + 'px';
			}

			// Scale font to match displayed size
			const fontSize = ( layer.fontSize || 16 ) * scaleY;
			this.editorElement.style.fontSize = fontSize + 'px';
		}

		/**
		 * Measure text width for a text layer
		 *
		 * @private
		 * @param {Object} layer - Text layer
		 * @return {number} Width in canvas pixels
		 */
		_measureTextWidth( layer ) {
			if ( !this.canvasManager || !this.canvasManager.ctx ) {
				return 100;
			}

			const ctx = this.canvasManager.ctx;
			ctx.save();
			ctx.font = ( layer.fontSize || 16 ) + 'px ' + ( layer.fontFamily || 'Arial' );
			const metrics = ctx.measureText( layer.text || '' );
			ctx.restore();

			return metrics.width || 100;
		}

		/**
		 * Get the container element for the editor
		 *
		 * @private
		 * @return {HTMLElement} Container element
		 */
		_getContainer() {
			// Try to find the editor's main container for proper stacking
			if ( this.canvasManager &&
				this.canvasManager.editor &&
				this.canvasManager.editor.ui &&
				this.canvasManager.editor.ui.mainContainer ) {
				return this.canvasManager.editor.ui.mainContainer;
			}
			if ( this.canvasManager && this.canvasManager.container ) {
				return this.canvasManager.container;
			}
			return document.body;
		}

		/**
		 * Setup event handlers for the editor
		 *
		 * @private
		 */
		_setupEventHandlers() {
			if ( !this.editorElement ) {
				return;
			}

			// Keyboard handler
			this._boundKeyHandler = ( e ) => this._handleKeyDown( e );
			this.editorElement.addEventListener( 'keydown', this._boundKeyHandler );

			// Blur handler
			this._boundBlurHandler = ( e ) => this._handleBlur( e );
			this.editorElement.addEventListener( 'blur', this._boundBlurHandler );

			// Input handler for real-time preview
			this._boundInputHandler = ( e ) => this._handleInput( e );
			this.editorElement.addEventListener( 'input', this._boundInputHandler );

			// Resize handler to reposition on window resize
			this._boundResizeHandler = () => this._positionEditor();
			window.addEventListener( 'resize', this._boundResizeHandler );
		}

		/**
		 * Remove event handlers
		 *
		 * @private
		 */
		_removeEventHandlers() {
			if ( this.editorElement ) {
				if ( this._boundKeyHandler ) {
					this.editorElement.removeEventListener( 'keydown', this._boundKeyHandler );
				}
				if ( this._boundBlurHandler ) {
					this.editorElement.removeEventListener( 'blur', this._boundBlurHandler );
				}
				if ( this._boundInputHandler ) {
					this.editorElement.removeEventListener( 'input', this._boundInputHandler );
				}
			}

			if ( this._boundResizeHandler ) {
				window.removeEventListener( 'resize', this._boundResizeHandler );
			}

			// Clear debounce timer
			if ( this._inputDebounceTimer ) {
				clearTimeout( this._inputDebounceTimer );
				this._inputDebounceTimer = null;
			}

			this._boundKeyHandler = null;
			this._boundBlurHandler = null;
			this._boundInputHandler = null;
			this._boundResizeHandler = null;
		}

		/**
		 * Handle keyboard events
		 *
		 * @private
		 * @param {KeyboardEvent} e - Keyboard event
		 */
		_handleKeyDown( e ) {
			// Escape cancels editing
			if ( e.key === 'Escape' ) {
				e.preventDefault();
				e.stopPropagation();
				this.cancelEditing();
				return;
			}

			// Enter finishes editing for single-line text
			// Ctrl+Enter or Cmd+Enter finishes for multiline
			if ( e.key === 'Enter' ) {
				if ( this.editingLayer && this.editingLayer.type !== 'textbox' ) {
					// Single-line: Enter confirms
					e.preventDefault();
					e.stopPropagation();
					this.finishEditing( true );
				} else if ( e.ctrlKey || e.metaKey ) {
					// Multiline: Ctrl+Enter confirms
					e.preventDefault();
					e.stopPropagation();
					this.finishEditing( true );
				}
				// Otherwise, allow Enter for new line in textbox
			}

			// Prevent event from bubbling to canvas handlers
			e.stopPropagation();
		}

		/**
		 * Handle blur event (clicking outside)
		 *
		 * @private
		 * @param {FocusEvent} _e - Blur event (unused)
		 */
		_handleBlur( _e ) {
			// Use a small delay to allow for internal focus changes
			setTimeout( () => {
				// Check if we're still supposed to be editing
				if ( this.isEditing ) {
					this.finishEditing( true );
				}
			}, 100 );
		}

		/**
		 * Handle input event for real-time preview
		 *
		 * @private
		 * @param {InputEvent} _e - Input event (unused)
		 */
		_handleInput( _e ) {
			if ( !this.editorElement || !this.editingLayer ) {
				return;
			}

			// Debounce preview updates to avoid excessive rendering
			if ( this._inputDebounceTimer ) {
				clearTimeout( this._inputDebounceTimer );
			}

			this._inputDebounceTimer = setTimeout( () => {
				this._updatePreview();
			}, 50 );
		}

		/**
		 * Update canvas preview with current editor text
		 *
		 * @private
		 */
		_updatePreview() {
			if ( !this.editorElement || !this.editingLayer || !this.canvasManager ) {
				return;
			}

			// Temporarily update layer text for preview
			const previewText = this.editorElement.value;
			this.editingLayer.text = previewText;

			// Re-render canvas to show preview
			if ( this.canvasManager.editor && this.canvasManager.editor.layers ) {
				this.canvasManager.renderLayers( this.canvasManager.editor.layers );
			}
		}

		/**
		 * Update textbox dimensions after editing
		 *
		 * @private
		 */
		_updateTextBoxDimensions() {
			// For textbox, we could optionally auto-resize based on content
			// For now, keep existing dimensions
		}

		/**
		 * Remove the editor element from DOM
		 *
		 * @private
		 */
		_removeEditor() {
			if ( this.editorElement && this.editorElement.parentNode ) {
				this.editorElement.parentNode.removeChild( this.editorElement );
			}
			this.editorElement = null;
			this.containerElement = null;
		}

		/**
		 * Clean up all resources
		 */
		destroy() {
			this.finishEditing( false );
			this._removeEventHandlers();
			this._removeEditor();

			this.canvasManager = null;
			this.editingLayer = null;
		}
	}

	// =========================================================================
	// Export
	// =========================================================================

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.InlineTextEditor = InlineTextEditor;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = InlineTextEditor;
	}

}() );
