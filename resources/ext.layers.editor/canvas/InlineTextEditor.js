/**
 * InlineTextEditor - Canvas-based inline text editing
 *
 * Enables direct text editing on the canvas by overlaying a transparent HTML
 * textarea that matches the text layer's exact position, size, and styling.
 * This provides a true in-place editing experience where:
 * - Double-click a text layer to edit directly in place
 * - The editor is nearly invisible - you edit the text as it appears on canvas
 * - Use standard text selection and cursor positioning
 * - Move/resize the layer using selection handles (not the editor)
 * - Press Escape to cancel, Enter (or Ctrl+Enter for textbox) to save
 *
 * @module ext.layers.editor.canvas.InlineTextEditor
 * @since 1.5.13
 * @version 1.5.27-fix1 - Fix text duplication during toolbar formatting
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
			this._resizeDebounceTimer = null;

			// Toolbar elements
			this.toolbarElement = null;
			this._isDraggingToolbar = false;
			this._toolbarDragOffset = { x: 0, y: 0 };
			this._boundToolbarMouseMove = null;
			this._boundToolbarMouseUp = null;
			this._isToolbarInteraction = false;
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

			return layer.type === 'text' || layer.type === 'textbox' || layer.type === 'callout';
		}

		/**
		 * Check if a layer is a multiline type (textbox or callout)
		 * These layer types have a visible background and support multiline text.
		 *
		 * @private
		 * @param {Object} layer - Layer to check
		 * @return {boolean} True if layer is a multiline type
		 */
		_isMultilineType( layer ) {
			return layer && ( layer.type === 'textbox' || layer.type === 'callout' );
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

			// Create and position the editor FIRST (before modifying layer)
			this._createEditor();
			this._positionEditor();
			this._setupEventHandlers();

			// For textbox/callout layers, keep the background visible by clearing the text
			// For simple text layers, hide the layer entirely
			// Do this AFTER creating the editor so it gets the original text
			if ( this._isMultilineType( layer ) ) {
				// Clear layer text so only background renders on canvas
				this._originalVisible = true;
				layer.text = '';
			} else {
				// Hide simple text layers entirely
				this._originalVisible = layer.visible !== false;
				layer.visible = false;
			}

			// Re-render to show changes (hidden text or hidden layer)
			if ( this.canvasManager && typeof this.canvasManager.renderLayers === 'function' &&
				this.canvasManager.editor && this.canvasManager.editor.layers ) {
				this.canvasManager.renderLayers( this.canvasManager.editor.layers );
			}

			// Create floating toolbar
			this._createToolbar();

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
			const wasTextbox = this._isMultilineType( this.editingLayer );

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

					changesApplied = true;
				} else if ( wasTextbox ) {
					// Restore original text for textbox (we cleared it for editing)
					this.editingLayer.text = this.originalText;
				}
			} else if ( !shouldApply && wasTextbox && this.editingLayer ) {
				// Canceled - restore original text for textbox
				this.editingLayer.text = this.originalText;
			}

			// Cleanup
			this._removeEditor();
			this._removeToolbar();
			this._removeEventHandlers();

			// Restore layer visibility (for simple text layers)
			if ( this.editingLayer && !wasTextbox && this._originalVisible !== undefined ) {
				this.editingLayer.visible = this._originalVisible;
			}
			this._originalVisible = undefined;

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
		 * Create the editor element - a transparent overlay matching the layer
		 *
		 * @private
		 */
		_createEditor() {
			const layer = this.editingLayer;
			if ( !layer ) {
				return;
			}

			// Determine if we need a textarea (multiline) or input (single line)
			const isMultiline = this._isMultilineType( layer );

			// Create the appropriate text element
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

			// Apply text styling to match the layer exactly
			this._applyLayerStyle();

			// Base styles - transparent background, minimal border for visibility
			const baseStyles = {
				position: 'absolute',
				boxSizing: 'border-box',
				border: '2px solid #0066cc',
				borderRadius: '2px',
				outline: 'none',
				// Transparent background so canvas shows through
				background: 'transparent',
				// Ensure text is visible with a subtle text shadow
				textShadow: '0 0 2px rgba(255, 255, 255, 0.8)',
				zIndex: '10001',
				margin: '0'
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

			// Font properties - will be scaled in _positionEditor
			style.fontFamily = layer.fontFamily || 'Arial, sans-serif';
			style.fontWeight = layer.fontWeight || 'normal';
			style.fontStyle = layer.fontStyle || 'normal';
			style.color = layer.color || layer.fill || '#000000';

			// Text alignment for textbox/callout
			if ( this._isMultilineType( layer ) ) {
				style.textAlign = layer.textAlign || 'left';
				style.lineHeight = ( layer.lineHeight || 1.2 ).toString();
			} else {
				style.textAlign = 'left';
				style.lineHeight = '1.2';
			}
		}

		/**
		 * Position the editor element to match the layer on canvas exactly
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

			// Get container rect to calculate relative position
			const containerRect = ( this.containerElement &&
				typeof this.containerElement.getBoundingClientRect === 'function' ) ?
				this.containerElement.getBoundingClientRect() :
				{ left: 0, top: 0 };

			// Calculate scale from logical canvas to displayed size
			const scaleX = canvasRect.width / canvas.width;
			const scaleY = canvasRect.height / canvas.height;

			// Get layer position and dimensions in canvas coordinates
			const x = layer.x || 0;
			let y = layer.y || 0;
			let width, height;
			let padding = 0;

			if ( this._isMultilineType( layer ) ) {
				width = layer.width || 200;
				height = layer.height || 100;
				padding = layer.padding || 8;
			} else {
				// For simple text, measure the text to determine width
				width = this._measureTextWidth( layer ) + 20;
				height = ( layer.fontSize || 16 ) * 1.5;
				// Text baseline is at y, so adjust for top-left positioning
				y = y - ( layer.fontSize || 16 );
			}

			// Convert to screen coordinates, relative to container
			const screenX = canvasRect.left + ( x * scaleX ) - containerRect.left;
			const screenY = canvasRect.top + ( y * scaleY ) - containerRect.top;
			const screenWidth = width * scaleX;
			const screenHeight = height * scaleY;

			// Scale font to match displayed size
			const scaledFontSize = ( layer.fontSize || 16 ) * Math.min( scaleX, scaleY );
			const scaledPadding = padding * Math.min( scaleX, scaleY );

			// Calculate rotation - need to rotate around the center of the element
			const rotation = layer.rotation || 0;

			// For rotated layers, position at the center and use transform
			// This matches how the canvas renders rotated text boxes
			let positionStyles;
			if ( rotation !== 0 ) {
				// Position at center of the text box
				const centerX = screenX + screenWidth / 2;
				const centerY = screenY + screenHeight / 2;
				positionStyles = {
					left: centerX + 'px',
					top: centerY + 'px',
					width: Math.max( 50, screenWidth ) + 'px',
					height: this._isMultilineType( layer ) ? Math.max( 30, screenHeight ) + 'px' : 'auto',
					fontSize: scaledFontSize + 'px',
					padding: scaledPadding + 'px',
					transform: `translate(-50%, -50%) rotate(${ rotation }deg)`,
					transformOrigin: 'center center'
				};
			} else {
				// No rotation - use simple positioning
				positionStyles = {
					left: screenX + 'px',
					top: screenY + 'px',
					width: Math.max( 50, screenWidth ) + 'px',
					height: this._isMultilineType( layer ) ? Math.max( 30, screenHeight ) + 'px' : 'auto',
					fontSize: scaledFontSize + 'px',
					padding: scaledPadding + 'px',
					transform: 'none',
					transformOrigin: 'center center'
				};
			}

			// Apply position and size
			Object.assign( this.editorElement.style, positionStyles );
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
			ctx.font = ( layer.fontWeight || 'normal' ) + ' ' +
				( layer.fontStyle || 'normal' ) + ' ' +
				( layer.fontSize || 16 ) + 'px ' +
				( layer.fontFamily || 'Arial' );
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
			this._boundBlurHandler = () => this._handleBlur();
			this.editorElement.addEventListener( 'blur', this._boundBlurHandler );

			// Input handler for real-time preview
			this._boundInputHandler = () => this._handleInput();
			this.editorElement.addEventListener( 'input', this._boundInputHandler );

			// Resize handler to reposition on window resize (debounced to avoid thrashing)
			this._boundResizeHandler = () => {
				if ( this._resizeDebounceTimer ) {
					clearTimeout( this._resizeDebounceTimer );
				}
				this._resizeDebounceTimer = setTimeout( () => {
					this._positionEditor();
					this._resizeDebounceTimer = null;
				}, 100 );
			};
			window.addEventListener( 'resize', this._boundResizeHandler );
		}

		/**
		 * Handle keydown events
		 *
		 * @private
		 * @param {KeyboardEvent} e - Keyboard event
		 */
		_handleKeyDown( e ) {
			if ( e.key === 'Escape' ) {
				e.preventDefault();
				e.stopPropagation();
				this.cancelEditing();
				return;
			}

			// Ctrl+Enter or Cmd+Enter to finish for textbox
			if ( e.key === 'Enter' && ( e.ctrlKey || e.metaKey ) ) {
				e.preventDefault();
				this.finishEditing( true );
				return;
			}

			// Enter to finish for simple text (not textbox/callout which support multiline)
			if ( e.key === 'Enter' && this.editingLayer && !this._isMultilineType( this.editingLayer ) ) {
				e.preventDefault();
				this.finishEditing( true );
			}
		}

		/**
		 * Handle blur events
		 *
		 * @private
		 */
		_handleBlur() {
			// Use setTimeout to allow click events to process first
			setTimeout( () => {
				// Don't finish editing if we're interacting with the toolbar or a dialog
				if ( this._isToolbarInteraction ) {
					// Don't reset the flag here - let the control that set it reset it
					return;
				}
				// Check if focus moved to toolbar
				if ( this.toolbarElement && this.toolbarElement.contains( document.activeElement ) ) {
					return;
				}
				// Check if a color picker dialog is open
				if ( document.querySelector( '.color-picker-dialog' ) ) {
					return;
				}
				if ( this.isEditing ) {
					this.finishEditing( true );
				}
			}, 150 );
		}

		/**
		 * Handle input events - just update the layer text for when editing finishes
		 *
		 * @private
		 */
		_handleInput() {
			// Update layer text as user types (layer is hidden, so no visual update needed)
			if ( this.editingLayer && this.editorElement ) {
				this.editingLayer.text = this.editorElement.value;
			}
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
			if ( this._resizeDebounceTimer ) {
				clearTimeout( this._resizeDebounceTimer );
				this._resizeDebounceTimer = null;
			}

			this._boundKeyHandler = null;
			this._boundBlurHandler = null;
			this._boundInputHandler = null;
			this._boundResizeHandler = null;
		}

		/**
		 * Get a translated message with fallback for test environments
		 *
		 * @private
		 * @param {string} key - Message key
		 * @param {string} [fallback] - Fallback text if mw.message unavailable
		 * @return {string} Translated message or fallback
		 */
		_msg( key, fallback ) {
			if ( typeof mw !== 'undefined' && mw.message ) {
				return mw.message( key ).text();
			}
			return fallback || key;
		}

		/**
		 * Create the floating formatting toolbar
		 *
		 * @private
		 */
		_createToolbar() {
			if ( !this.editingLayer || !this.editorElement ) {
				return;
			}

			this.toolbarElement = document.createElement( 'div' );
			this.toolbarElement.className = 'layers-text-toolbar';

			// Create toolbar content
			const layer = this.editingLayer;

			// Drag handle
			const dragHandle = document.createElement( 'div' );
			dragHandle.className = 'layers-text-toolbar-handle';
			dragHandle.innerHTML = '⋮⋮';
			dragHandle.title = this._msg( 'layers-text-toolbar-drag', 'Drag to move' );
			this.toolbarElement.appendChild( dragHandle );

			// Font family select
			const fontSelect = this._createFontSelect( layer );
			this.toolbarElement.appendChild( fontSelect );

			// Separator
			this.toolbarElement.appendChild( this._createSeparator() );

			// Font size input
			const sizeGroup = this._createFontSizeInput( layer );
			this.toolbarElement.appendChild( sizeGroup );

			// Separator
			this.toolbarElement.appendChild( this._createSeparator() );

			// Bold button
			const boldBtn = this._createFormatButton( 'B', 'bold',
				layer.fontWeight === 'bold', this._msg( 'layers-text-toolbar-bold', 'Bold' ) );
			this.toolbarElement.appendChild( boldBtn );

			// Italic button
			const italicBtn = this._createFormatButton( 'I', 'italic',
				layer.fontStyle === 'italic', this._msg( 'layers-text-toolbar-italic', 'Italic' ) );
			italicBtn.style.fontStyle = 'italic';
			this.toolbarElement.appendChild( italicBtn );

			// Separator
			this.toolbarElement.appendChild( this._createSeparator() );

			// Alignment buttons
			const alignLeft = this._createAlignButton( 'left', layer.textAlign );
			const alignCenter = this._createAlignButton( 'center', layer.textAlign );
			const alignRight = this._createAlignButton( 'right', layer.textAlign );
			this.toolbarElement.appendChild( alignLeft );
			this.toolbarElement.appendChild( alignCenter );
			this.toolbarElement.appendChild( alignRight );

			// Separator
			this.toolbarElement.appendChild( this._createSeparator() );

			// Color picker
			const colorPicker = this._createColorPicker( layer );
			this.toolbarElement.appendChild( colorPicker );

			// Setup drag handlers
			this._setupToolbarDrag( dragHandle );

			// Prevent clicks on toolbar from closing the editor
			this.toolbarElement.addEventListener( 'mousedown', ( e ) => {
				// Mark that we're interacting with the toolbar
				this._isToolbarInteraction = true;
				// Don't prevent default for inputs/selects that need focus
				const tagName = e.target.tagName.toLowerCase();
				if ( tagName !== 'input' && tagName !== 'select' ) {
					e.preventDefault();
				}
			} );

			// Position toolbar above the editor
			this._positionToolbar();

			// Append to container
			if ( this.containerElement ) {
				this.containerElement.appendChild( this.toolbarElement );
			}
		}

		/**
		 * Create font family dropdown
		 *
		 * @private
		 * @param {Object} layer - Current layer
		 * @return {HTMLElement} Select element
		 */
		_createFontSelect( layer ) {
			const select = document.createElement( 'select' );
			select.className = 'layers-text-toolbar-font';
			select.title = this._msg( 'layers-text-toolbar-font', 'Font family' );

			// Get fonts from centralized FontConfig
			const FontConfig = window.Layers && window.Layers.FontConfig;
			const fonts = FontConfig ? FontConfig.getFonts() : [
				'Arial', 'Roboto', 'Noto Sans', 'Times New Roman', 'Georgia',
				'Verdana', 'Courier New', 'Helvetica'
			];

			// Find the matching font for the current layer
			const currentFont = FontConfig ?
				FontConfig.findMatchingFont( layer.fontFamily || 'Arial' ) :
				( layer.fontFamily || 'Arial' );

			fonts.forEach( ( font ) => {
				const option = document.createElement( 'option' );
				option.value = font;
				option.textContent = font;
				option.style.fontFamily = font;
				if ( font === currentFont ) {
					option.selected = true;
				}
				select.appendChild( option );
			} );

			select.addEventListener( 'change', () => {
				this._applyFormat( 'fontFamily', select.value );
				// Reset flag and re-focus editor after selection
				this._isToolbarInteraction = false;
				if ( this.editorElement ) {
					this.editorElement.focus();
				}
			} );

			// Mark as interacting when dropdown opens
			select.addEventListener( 'mousedown', () => {
				this._isToolbarInteraction = true;
			} );

			// Also mark on focus for keyboard navigation
			select.addEventListener( 'focus', () => {
				this._isToolbarInteraction = true;
			} );

			// Reset flag if user clicks away without selecting
			select.addEventListener( 'blur', () => {
				// Small delay to allow change event to fire first
				setTimeout( () => {
					if ( this._isToolbarInteraction && document.activeElement !== select ) {
						this._isToolbarInteraction = false;
						if ( this.editorElement ) {
							this.editorElement.focus();
						}
					}
				}, 100 );
			} );

			return select;
		}

		/**
		 * Create font size input
		 *
		 * @private
		 * @param {Object} layer - Current layer
		 * @return {HTMLElement} Size input group
		 */
		_createFontSizeInput( layer ) {
			const group = document.createElement( 'div' );
			group.className = 'layers-text-toolbar-size-group';

			const input = document.createElement( 'input' );
			input.type = 'number';
			input.className = 'layers-text-toolbar-size';
			input.value = layer.fontSize || 16;
			input.min = 8;
			input.max = 200;
			input.title = this._msg( 'layers-text-toolbar-size', 'Font size' );

			input.addEventListener( 'change', () => {
				const size = Math.max( 8, Math.min( 200, parseInt( input.value, 10 ) || 16 ) );
				input.value = size;
				this._applyFormat( 'fontSize', size );
				// Re-focus editor after change
				if ( this.editorElement ) {
					this.editorElement.focus();
				}
			} );

			// Mark interaction and refocus on blur
			input.addEventListener( 'focus', () => {
				this._isToolbarInteraction = true;
			} );
			input.addEventListener( 'blur', () => {
				if ( this.editorElement ) {
					this.editorElement.focus();
				}
			} );

			const label = document.createElement( 'span' );
			label.className = 'layers-text-toolbar-size-label';
			label.textContent = 'px';

			group.appendChild( input );
			group.appendChild( label );

			return group;
		}

		/**
		 * Create a format toggle button (bold/italic)
		 *
		 * @private
		 * @param {string} label - Button label
		 * @param {string} format - Format type ('bold' or 'italic')
		 * @param {boolean} active - Whether currently active
		 * @param {string} title - Button title/tooltip
		 * @return {HTMLElement} Button element
		 */
		_createFormatButton( label, format, active, title ) {
			const btn = document.createElement( 'button' );
			btn.className = 'layers-text-toolbar-btn';
			btn.textContent = label;
			btn.title = title;
			btn.setAttribute( 'data-format', format );

			if ( active ) {
				btn.classList.add( 'active' );
			}

			btn.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				btn.classList.toggle( 'active' );

				if ( format === 'bold' ) {
					this._applyFormat( 'fontWeight', btn.classList.contains( 'active' ) ? 'bold' : 'normal' );
				} else if ( format === 'italic' ) {
					this._applyFormat( 'fontStyle', btn.classList.contains( 'active' ) ? 'italic' : 'normal' );
				}
			} );

			// Prevent blur
			btn.addEventListener( 'mousedown', ( e ) => e.preventDefault() );

			return btn;
		}

		/**
		 * Create alignment button
		 *
		 * @private
		 * @param {string} align - Alignment value (left/center/right)
		 * @param {string} currentAlign - Current alignment
		 * @return {HTMLElement} Button element
		 */
		_createAlignButton( align, currentAlign ) {
			const btn = document.createElement( 'button' );
			btn.className = 'layers-text-toolbar-btn layers-text-toolbar-align';
			btn.setAttribute( 'data-align', align );
			btn.title = this._msg( 'layers-text-toolbar-align-' + align, 'Align ' + align );

			// SVG icons for alignment
			const icons = {
				left: '<svg width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="M2 3h12v2H2zm0 4h8v2H2zm0 4h10v2H2z"/></svg>',
				center: '<svg width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="M2 3h12v2H2zm2 4h8v2H4zm1 4h6v2H5z"/></svg>',
				right: '<svg width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="M2 3h12v2H2zm4 4h8v2H6zm2 4h6v2H8z"/></svg>'
			};
			btn.innerHTML = icons[ align ];

			if ( ( currentAlign || 'left' ) === align ) {
				btn.classList.add( 'active' );
			}

			btn.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				// Deactivate siblings
				const siblings = this.toolbarElement.querySelectorAll( '.layers-text-toolbar-align' );
				siblings.forEach( ( s ) => s.classList.remove( 'active' ) );
				btn.classList.add( 'active' );
				this._applyFormat( 'textAlign', align );
			} );

			// Prevent blur
			btn.addEventListener( 'mousedown', ( e ) => e.preventDefault() );

			return btn;
		}

		/**
		 * Create color picker
		 *
		 * @private
		 * @param {Object} layer - Current layer
		 * @return {HTMLElement} Color picker element
		 */
		_createColorPicker( layer ) {
			const wrapper = document.createElement( 'div' );
			wrapper.className = 'layers-text-toolbar-color-wrapper';

			const currentColor = layer.color || layer.fill || '#000000';
			const ColorPickerDialog = window.Layers && window.Layers.UI && window.Layers.UI.ColorPickerDialog;

			// Get i18n strings for color picker
			const colorPickerStrings = {
				title: this._msg( 'layers-color-picker-title', 'Choose color' ),
				standard: this._msg( 'layers-color-picker-standard', 'Standard colors' ),
				saved: this._msg( 'layers-color-picker-saved', 'Saved colors' ),
				customSection: this._msg( 'layers-color-picker-custom-section', 'Custom color' ),
				none: this._msg( 'layers-color-picker-none', 'No fill (transparent)' ),
				emptySlot: this._msg( 'layers-color-picker-empty-slot', 'Empty slot' ),
				cancel: this._msg( 'layers-color-picker-cancel', 'Cancel' ),
				apply: this._msg( 'layers-color-picker-apply', 'Apply' ),
				transparent: this._msg( 'layers-color-picker-transparent', 'Transparent' ),
				swatchTemplate: this._msg( 'layers-color-picker-color-swatch', 'Set color to $1' ),
				previewTemplate: this._msg( 'layers-color-picker-color-preview', 'Current color: $1' )
			};

			let colorButton;
			let storedColor = currentColor;
			const self = this;

			if ( ColorPickerDialog && typeof ColorPickerDialog.createColorButton === 'function' ) {
				// Use full color picker dialog with swatches
				colorButton = ColorPickerDialog.createColorButton( {
					color: currentColor,
					strings: colorPickerStrings,
					onClick: () => {
						const originalColor = storedColor;
						self._isToolbarInteraction = true;

						const dialog = new ColorPickerDialog( {
							currentColor: storedColor,
							strings: colorPickerStrings,
							anchorElement: colorButton,
							onApply: ( newColor ) => {
								storedColor = newColor;
								self._applyFormat( 'color', newColor );
								ColorPickerDialog.updateColorButton( colorButton, newColor, colorPickerStrings );
								// Reset flag and refocus editor after dialog closes
								self._isToolbarInteraction = false;
								if ( self.editorElement ) {
									self.editorElement.focus();
								}
							},
							onPreview: ( previewColor ) => {
								self._applyFormat( 'color', previewColor );
							},
							onCancel: () => {
								self._applyFormat( 'color', originalColor );
								// Reset flag and refocus editor after dialog closes
								self._isToolbarInteraction = false;
								if ( self.editorElement ) {
									self.editorElement.focus();
								}
							}
						} );
						dialog.open();
					}
				} );
				colorButton.className += ' layers-text-toolbar-color-button';
			} else {
				// Fallback: basic color input
				const input = document.createElement( 'input' );
				input.type = 'color';
				input.className = 'layers-text-toolbar-color';
				input.value = currentColor;
				input.title = this._msg( 'layers-text-toolbar-color', 'Text color' );

				input.addEventListener( 'input', () => {
					this._applyFormat( 'color', input.value );
				} );

				// Mark interaction and delay refocus
				input.addEventListener( 'focus', () => {
					this._isToolbarInteraction = true;
				} );
				input.addEventListener( 'blur', () => {
					setTimeout( () => {
						this._isToolbarInteraction = false;
						if ( this.editorElement ) {
							this.editorElement.focus();
						}
					}, 100 );
				} );

				colorButton = input;
			}

			wrapper.appendChild( colorButton );
			return wrapper;
		}

		/**
		 * Create a separator element
		 *
		 * @private
		 * @return {HTMLElement} Separator element
		 */
		_createSeparator() {
			const sep = document.createElement( 'div' );
			sep.className = 'layers-text-toolbar-separator';
			return sep;
		}

		/**
		 * Apply a format change to the layer and editor
		 *
		 * Uses editor.updateLayer() to ensure changes are properly persisted
		 * through StateManager and saved when the document is saved.
		 *
		 * @private
		 * @param {string} property - Property name
		 * @param {*} value - New value
		 */
		_applyFormat( property, value ) {
			if ( !this.editingLayer ) {
				return;
			}

			const layerId = this.editingLayer.id;
			const isTextbox = this._isMultilineType( this.editingLayer );

			// Build changes object including the format change
			// Also preserve the editing state (hidden text for textbox, hidden layer for text)
			// to prevent the layer from rendering with original text while editing
			const changes = { [ property ]: value };

			if ( isTextbox ) {
				// Keep text cleared during inline editing
				changes.text = '';
			} else {
				// Keep simple text layers hidden during inline editing
				changes.visible = false;
			}

			// Use editor.updateLayer() to properly persist the change through StateManager
			// This ensures the change is saved when the document is saved
			const editor = this.canvasManager && this.canvasManager.editor;
			if ( editor && typeof editor.updateLayer === 'function' ) {
				editor.updateLayer( layerId, changes );

				// Refresh our reference to the layer since updateLayer creates a new object
				const updatedLayer = editor.getLayerById ? editor.getLayerById( layerId ) : null;
				if ( updatedLayer ) {
					this.editingLayer = updatedLayer;
				}
			} else {
				// Fallback: direct update (won't persist properly but at least shows on canvas)
				this.editingLayer[ property ] = value;
			}

			// Update editor element style if applicable
			if ( this.editorElement ) {
				const styleMap = {
					fontFamily: 'fontFamily',
					fontSize: null, // Handled specially due to scaling
					fontWeight: 'fontWeight',
					fontStyle: 'fontStyle',
					textAlign: 'textAlign',
					color: 'color'
				};

				if ( property === 'fontSize' ) {
					// Recalculate scaled size
					this._positionEditor();
				} else if ( styleMap[ property ] ) {
					this.editorElement.style[ styleMap[ property ] ] = value;
				}
			}

			// Sync with properties panel so both UI elements show the same values
			this._syncPropertiesPanel();
		}

		/**
		 * Synchronize the properties panel with current layer state
		 *
		 * When the floating toolbar changes a property, this ensures the
		 * properties panel (LayerPanel) is updated to reflect the change.
		 *
		 * @private
		 */
		_syncPropertiesPanel() {
			if ( !this.editingLayer || !this.canvasManager ) {
				return;
			}

			const editor = this.canvasManager.editor;
			if ( editor && editor.layerPanel &&
				typeof editor.layerPanel.updatePropertiesPanel === 'function' ) {
				editor.layerPanel.updatePropertiesPanel( this.editingLayer.id );
			}
		}

		/**
		 * Setup toolbar drag functionality
		 *
		 * @private
		 * @param {HTMLElement} handle - Drag handle element
		 */
		_setupToolbarDrag( handle ) {
			handle.addEventListener( 'mousedown', ( e ) => {
				e.preventDefault();
				this._isDraggingToolbar = true;

				const rect = this.toolbarElement.getBoundingClientRect();
				this._toolbarDragOffset = {
					x: e.clientX - rect.left,
					y: e.clientY - rect.top
				};

				this._boundToolbarMouseMove = ( me ) => this._handleToolbarDrag( me );
				this._boundToolbarMouseUp = () => this._stopToolbarDrag();

				document.addEventListener( 'mousemove', this._boundToolbarMouseMove );
				document.addEventListener( 'mouseup', this._boundToolbarMouseUp );
			} );
		}

		/**
		 * Handle toolbar drag movement
		 *
		 * @private
		 * @param {MouseEvent} e - Mouse event
		 */
		_handleToolbarDrag( e ) {
			if ( !this._isDraggingToolbar || !this.toolbarElement ) {
				return;
			}

			const containerRect = this.containerElement ?
				this.containerElement.getBoundingClientRect() :
				{ left: 0, top: 0 };

			const newX = e.clientX - this._toolbarDragOffset.x - containerRect.left;
			const newY = e.clientY - this._toolbarDragOffset.y - containerRect.top;

			this.toolbarElement.style.left = newX + 'px';
			this.toolbarElement.style.top = newY + 'px';
		}

		/**
		 * Stop toolbar drag
		 *
		 * @private
		 */
		_stopToolbarDrag() {
			this._isDraggingToolbar = false;

			if ( this._boundToolbarMouseMove ) {
				document.removeEventListener( 'mousemove', this._boundToolbarMouseMove );
			}
			if ( this._boundToolbarMouseUp ) {
				document.removeEventListener( 'mouseup', this._boundToolbarMouseUp );
			}

			this._boundToolbarMouseMove = null;
			this._boundToolbarMouseUp = null;
		}

		/**
		 * Position the toolbar above the editor
		 *
		 * @private
		 */
		_positionToolbar() {
			if ( !this.toolbarElement || !this.editorElement ) {
				return;
			}

			// Safety check for test environments where getBoundingClientRect may not exist
			if ( typeof this.editorElement.getBoundingClientRect !== 'function' ) {
				return;
			}

			const containerRect = ( this.containerElement &&
				typeof this.containerElement.getBoundingClientRect === 'function' ) ?
				this.containerElement.getBoundingClientRect() :
				{ left: 0, top: 0, width: window.innerWidth };

			const editorRect = this.editorElement.getBoundingClientRect();

			// Position above the editor, left-aligned
			let left = editorRect.left - containerRect.left;
			let top = editorRect.top - containerRect.top - 44; // 36px toolbar + 8px gap

			// Keep within container bounds
			const toolbarWidth = 420; // Approximate toolbar width
			if ( left + toolbarWidth > containerRect.width ) {
				left = Math.max( 0, containerRect.width - toolbarWidth );
			}
			if ( top < 0 ) {
				// Show below editor if not enough room above
				top = editorRect.bottom - containerRect.top + 8;
			}

			this.toolbarElement.style.left = left + 'px';
			this.toolbarElement.style.top = top + 'px';
		}

		/**
		 * Remove the toolbar from DOM
		 *
		 * @private
		 */
		_removeToolbar() {
			this._stopToolbarDrag();

			if ( this.toolbarElement && this.toolbarElement.parentNode ) {
				this.toolbarElement.parentNode.removeChild( this.toolbarElement );
			}
			this.toolbarElement = null;
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
			this._removeToolbar();
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
