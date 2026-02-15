/**
 * RichTextToolbar - Floating formatting toolbar for inline text editing
 *
 * This class creates and manages the floating toolbar that appears during
 * inline text editing. It provides formatting controls (font, size, bold,
 * italic, alignment, color) and supports drag-to-reposition.
 *
 * Extracted from InlineTextEditor as part of the God Class Reduction Initiative
 * Phase 1. This separation allows for:
 * - Independent testing of toolbar functionality
 * - Reuse in other editing contexts
 * - Cleaner separation of concerns (UI vs editing logic)
 *
 * @class RichTextToolbar
 * @memberof window.Layers.Canvas
 */
( function () {
	'use strict';

	/**
	 * Create a new RichTextToolbar instance
	 *
	 * @constructor
	 * @param {Object} options - Configuration options
	 * @param {Object} options.layer - The layer being edited (for initial values)
	 * @param {boolean} options.isRichTextMode - Whether rich text formatting is supported
	 * @param {HTMLElement} options.editorElement - The editor DOM element (for positioning)
	 * @param {HTMLElement} options.containerElement - Container to append toolbar to
	 * @param {string} [options.highlightColor] - Initial highlight color (defaults to yellow)
	 * @param {Function} options.onFormat - Callback for format changes: (property, value) => void
	 * @param {Function} options.onSaveSelection - Callback to save current selection
	 * @param {Function} options.onFocusEditor - Callback to refocus the editor
	 * @param {Function} options.msg - i18n message function: (key, fallback) => string
	 */
	class RichTextToolbar {
		constructor( options ) {
			this.layer = options.layer;
			this.isRichTextMode = options.isRichTextMode || false;
			this.editorElement = options.editorElement || null;
			this.containerElement = options.containerElement || null;

			// Debug: Track fontSize when toolbar is created
			const debug = typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' );
			if ( debug && this.layer ) {
				// eslint-disable-next-line no-console
				console.log( '[RichTextToolbar] constructor - fontSize tracking', {
					layerId: this.layer.id,
					layerFontSize: this.layer.fontSize,
					hasRichText: !!this.layer.richText
				} );
			}

			// Callbacks
			this.onFormat = options.onFormat || ( () => {} );
			this.onSaveSelection = options.onSaveSelection || ( () => {} );
			this.onFocusEditor = options.onFocusEditor || ( () => {} );
			this.msg = options.msg || ( ( key, fallback ) => fallback );

			// DOM elements
			this.toolbarElement = null;

			// Drag state
			this._isDragging = false;
			this._dragOffset = { x: 0, y: 0 };
			this._boundMouseMove = null;
			this._boundMouseUp = null;

			// Interaction tracking
			this._isInteracting = false;

			// Remember initial highlight color for persistence across sessions
			this._initialHighlightColor = options.highlightColor || '#ffff00';
		}

		/**
		 * Check if toolbar interaction is in progress
		 *
		 * @return {boolean} True if user is interacting with toolbar
		 */
		isInteracting() {
			return this._isInteracting;
		}

		/**
		 * Create and return the toolbar element
		 *
		 * @return {HTMLElement} The toolbar DOM element
		 */
		create() {
			if ( !this.layer ) {
				return null;
			}

			this.toolbarElement = document.createElement( 'div' );
			this.toolbarElement.className = 'layers-text-toolbar';

			// Drag handle
			const dragHandle = document.createElement( 'div' );
			dragHandle.className = 'layers-text-toolbar-handle';
			dragHandle.innerHTML = '⋮⋮';
			dragHandle.title = this.msg( 'layers-text-toolbar-drag', 'Drag to move' );
			this.toolbarElement.appendChild( dragHandle );

			// Font family select
			this.toolbarElement.appendChild( this._createFontSelect() );
			this.toolbarElement.appendChild( this._createSeparator() );

			// Font size input
			this.toolbarElement.appendChild( this._createFontSizeInput() );
			this.toolbarElement.appendChild( this._createSeparator() );

			// Bold button
			const boldBtn = this._createFormatButton( 'B', 'bold',
				this.layer.fontWeight === 'bold',
				this.msg( 'layers-text-toolbar-bold', 'Bold' ) );
			this.toolbarElement.appendChild( boldBtn );

			// Italic button
			const italicBtn = this._createFormatButton( 'I', 'italic',
				this.layer.fontStyle === 'italic',
				this.msg( 'layers-text-toolbar-italic', 'Italic' ) );
			italicBtn.style.fontStyle = 'italic';
			this.toolbarElement.appendChild( italicBtn );

			// Rich text format buttons (only for textbox/callout)
			if ( this.isRichTextMode ) {
				// Underline button
				const underlineBtn = this._createFormatButton( 'U', 'underline',
					false, this.msg( 'layers-text-toolbar-underline', 'Underline' ) );
				underlineBtn.style.textDecoration = 'underline';
				this.toolbarElement.appendChild( underlineBtn );

				// Strikethrough button
				const strikeBtn = this._createFormatButton( 'S', 'strikethrough',
					false, this.msg( 'layers-text-toolbar-strikethrough', 'Strikethrough' ) );
				strikeBtn.style.textDecoration = 'line-through';
				this.toolbarElement.appendChild( strikeBtn );

				// Highlight button
				this.toolbarElement.appendChild( this._createHighlightButton() );
			}

			this.toolbarElement.appendChild( this._createSeparator() );

			// Alignment buttons
			this.toolbarElement.appendChild( this._createAlignButton( 'left' ) );
			this.toolbarElement.appendChild( this._createAlignButton( 'center' ) );
			this.toolbarElement.appendChild( this._createAlignButton( 'right' ) );

			// Vertical alignment buttons (only for textbox/callout)
			if ( this.isRichTextMode ) {
				this.toolbarElement.appendChild( this._createSeparator() );
				this.toolbarElement.appendChild( this._createVerticalAlignButton( 'top' ) );
				this.toolbarElement.appendChild( this._createVerticalAlignButton( 'middle' ) );
				this.toolbarElement.appendChild( this._createVerticalAlignButton( 'bottom' ) );
			}

			this.toolbarElement.appendChild( this._createSeparator() );

			// Color picker
			this.toolbarElement.appendChild( this._createColorPicker() );

			// Setup drag handlers
			this._setupDrag( dragHandle );

			// Prevent clicks on toolbar from closing the editor
			this.toolbarElement.addEventListener( 'mousedown', ( e ) => {
				this._isInteracting = true;
				const tagName = e.target.tagName.toLowerCase();
				if ( tagName !== 'input' && tagName !== 'select' ) {
					e.preventDefault();
				}
			} );

			// Append to container
			if ( this.containerElement ) {
				this.containerElement.appendChild( this.toolbarElement );
			}

			// Position toolbar
			this.position();

			return this.toolbarElement;
		}

		/**
		 * Position the toolbar above the editor element
		 */
		position() {
			if ( !this.toolbarElement || !this.editorElement ) {
				return;
			}

			if ( typeof this.editorElement.getBoundingClientRect !== 'function' ) {
				return;
			}

			const containerRect = ( this.containerElement &&
				typeof this.containerElement.getBoundingClientRect === 'function' ) ?
				this.containerElement.getBoundingClientRect() :
				{ left: 0, top: 0, width: window.innerWidth };

			const editorRect = this.editorElement.getBoundingClientRect();

			let left = editorRect.left - containerRect.left;
			let top = editorRect.top - containerRect.top - 44; // 36px toolbar + 8px gap

			// Keep within container bounds
			const toolbarWidth = 420;
			if ( left + toolbarWidth > containerRect.width ) {
				left = Math.max( 0, containerRect.width - toolbarWidth );
			}
			if ( top < 0 ) {
				top = editorRect.bottom - containerRect.top + 8;
			}

			this.toolbarElement.style.left = left + 'px';
			this.toolbarElement.style.top = top + 'px';
		}

		/**
		 * Update toolbar controls to reflect the current selection's formatting
		 *
		 * Called when selection changes to show the font/size of selected text.
		 * Only updates font size if it was explicitly found in the DOM (via data-font-size
		 * attribute), to avoid overwriting the toolbar's initial value with a fallback.
		 *
		 * @param {Object} selectionInfo - Information about current selection's formatting
		 * @param {number} [selectionInfo.fontSize] - Font size at selection (unscaled)
		 * @param {boolean} [selectionInfo.fontSizeFromDOM] - Whether fontSize came from DOM attribute
		 * @param {string} [selectionInfo.fontFamily] - Font family at selection
		 */
		updateFromSelection( selectionInfo ) {
			if ( !this.toolbarElement || !selectionInfo ) {
				return;
			}

			// Only update font size if it was explicitly found in the DOM
			// This prevents the toolbar from being updated with fallback values
			// that may differ from the layer's actual fontSize
			if ( selectionInfo.fontSizeFromDOM && selectionInfo.fontSize !== undefined ) {
				const sizeInput = this.toolbarElement.querySelector( '.layers-text-toolbar-size' );
				if ( sizeInput ) {
					sizeInput.value = selectionInfo.fontSize;
				}
			}

			// Update font family select
			if ( selectionInfo.fontFamily ) {
				const fontSelect = this.toolbarElement.querySelector( '.layers-text-toolbar-font' );
				if ( fontSelect ) {
					// Find matching option (try exact match first, then case-insensitive)
					const FontConfig = window.Layers && window.Layers.FontConfig;
					const matchingFont = FontConfig ?
						FontConfig.findMatchingFont( selectionInfo.fontFamily ) :
						selectionInfo.fontFamily;

					for ( const option of fontSelect.options ) {
						if ( option.value === matchingFont ) {
							fontSelect.value = matchingFont;
							break;
						}
					}
				}
			}
		}

		/**
		 * Remove the toolbar from DOM and clean up
		 */
		destroy() {
			this._stopDrag();

			if ( this.toolbarElement && this.toolbarElement.parentNode ) {
				this.toolbarElement.parentNode.removeChild( this.toolbarElement );
			}
			this.toolbarElement = null;
		}

		/**
		 * Create font family dropdown
		 *
		 * @private
		 * @return {HTMLElement} Select element
		 */
		_createFontSelect() {
			const select = document.createElement( 'select' );
			select.className = 'layers-text-toolbar-font';
			select.title = this.msg( 'layers-text-toolbar-font', 'Font family' );

			const FontConfig = window.Layers && window.Layers.FontConfig;
			const fonts = FontConfig ? FontConfig.getFonts() : [
				'Arial', 'Roboto', 'Noto Sans', 'Times New Roman', 'Georgia',
				'Verdana', 'Courier New', 'Helvetica'
			];

			const currentFont = FontConfig ?
				FontConfig.findMatchingFont( this.layer.fontFamily || 'Arial' ) :
				( this.layer.fontFamily || 'Arial' );

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
				this.onFormat( 'fontFamily', select.value );
				this._isInteracting = false;
				this.onFocusEditor();
			} );

			select.addEventListener( 'mousedown', () => {
				this.onSaveSelection();
				this._isInteracting = true;
			} );

			select.addEventListener( 'focus', () => {
				this._isInteracting = true;
			} );

			select.addEventListener( 'blur', () => {
				setTimeout( () => {
					if ( this._isInteracting && document.activeElement !== select ) {
						this._isInteracting = false;
						this.onFocusEditor();
					}
				}, 100 );
			} );

			return select;
		}

		/**
		 * Create font size input
		 *
		 * @private
		 * @return {HTMLElement} Size input group
		 */
		_createFontSizeInput() {
			const group = document.createElement( 'div' );
			group.className = 'layers-text-toolbar-size-group';

			const input = document.createElement( 'input' );
			input.type = 'number';
			input.className = 'layers-text-toolbar-size';
			input.value = this.layer.fontSize || 16;
			input.min = 8;
			input.max = 200;
			input.title = this.msg( 'layers-text-toolbar-size', 'Font size' );

			input.addEventListener( 'mousedown', () => {
				this._isInteracting = true;
				this.onSaveSelection();
			} );

			// Handle input event (fires when using +/- buttons or typing)
			input.addEventListener( 'input', () => {
				this._isInteracting = true;
			} );

			input.addEventListener( 'change', () => {
				const size = Math.max( 8, Math.min( 200, parseInt( input.value, 10 ) || 16 ) );
				input.value = size;
				this._isInteracting = true; // Keep interacting during format apply
				this.onFormat( 'fontSize', size );
				// Delay clearing isInteracting to allow DOM update
				setTimeout( () => {
					this._isInteracting = false;
					this.onFocusEditor();
				}, 50 );
			} );

			input.addEventListener( 'focus', () => {
				this._isInteracting = true;
			} );

			input.addEventListener( 'blur', () => {
				// Delay clearing isInteracting to allow change event to process
				setTimeout( () => {
					this._isInteracting = false;
				}, 100 );
			} );

			const label = document.createElement( 'span' );
			label.className = 'layers-text-toolbar-size-label';
			label.textContent = 'px';

			group.appendChild( input );
			group.appendChild( label );

			return group;
		}

		/**
		 * Create a format toggle button (bold/italic/underline/strikethrough)
		 *
		 * @private
		 * @param {string} label - Button label
		 * @param {string} format - Format type
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
					this.onFormat( 'fontWeight', btn.classList.contains( 'active' ) ? 'bold' : 'normal' );
				} else if ( format === 'italic' ) {
					this.onFormat( 'fontStyle', btn.classList.contains( 'active' ) ? 'italic' : 'normal' );
				} else if ( format === 'underline' ) {
					this.onFormat( 'underline', btn.classList.contains( 'active' ) );
				} else if ( format === 'strikethrough' ) {
					this.onFormat( 'strikethrough', btn.classList.contains( 'active' ) );
				}
			} );

			btn.addEventListener( 'mousedown', ( e ) => e.preventDefault() );

			return btn;
		}

		/**
		 * Create highlight button with color picker
		 *
		 * @private
		 * @return {HTMLElement} Button element with color picker
		 */
		_createHighlightButton() {
			const wrapper = document.createElement( 'div' );
			wrapper.className = 'layers-text-toolbar-highlight-wrapper';
			wrapper.style.position = 'relative';
			wrapper.style.display = 'inline-flex';
			wrapper.style.alignItems = 'stretch';

			let currentColor = this._initialHighlightColor;

			// Main highlight button
			const btn = document.createElement( 'button' );
			btn.className = 'layers-text-toolbar-btn layers-text-toolbar-highlight-main';
			btn.innerHTML = `<span style="background:${currentColor};padding:0 2px;">H</span>`;
			btn.title = this.msg( 'layers-text-toolbar-highlight', 'Highlight' );
			btn.setAttribute( 'data-format', 'highlight' );

			btn.addEventListener( 'mousedown', ( e ) => {
				e.preventDefault();
				this.onSaveSelection();
				this._isInteracting = true;
			} );

			btn.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				this.onFormat( 'highlight', currentColor );
				this._isInteracting = false;
				this.onFocusEditor();
			} );

			// Dropdown arrow
			const dropdownBtn = document.createElement( 'button' );
			dropdownBtn.className = 'layers-text-toolbar-btn layers-text-toolbar-highlight-dropdown';
			dropdownBtn.innerHTML = '▼';
			dropdownBtn.title = this.msg( 'layers-text-toolbar-highlight-color', 'Highlight color' );
			dropdownBtn.style.fontSize = '8px';
			dropdownBtn.style.padding = '0 2px';
			dropdownBtn.style.minWidth = '12px';

			const colorPickerStrings = this._getColorPickerStrings();
			const ColorPickerDialog = window.Layers && window.Layers.UI && window.Layers.UI.ColorPickerDialog;

			dropdownBtn.addEventListener( 'mousedown', ( e ) => {
				e.preventDefault();
				this.onSaveSelection();
				this._isInteracting = true;
			} );

			dropdownBtn.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				e.stopPropagation();

				if ( ColorPickerDialog ) {
					const dialog = new ColorPickerDialog( {
						currentColor: currentColor,
						strings: colorPickerStrings,
						anchorElement: dropdownBtn,
						onApply: ( newColor ) => {
							currentColor = newColor;
							btn.querySelector( 'span' ).style.backgroundColor = newColor;
							this.onFormat( 'highlight', newColor );
							this._isInteracting = false;
							this.onFocusEditor();
						},
						onPreview: ( previewColor ) => {
							btn.querySelector( 'span' ).style.backgroundColor = previewColor;
						},
						onCancel: () => {
							btn.querySelector( 'span' ).style.backgroundColor = currentColor;
							this._isInteracting = false;
							this.onFocusEditor();
						}
					} );
					dialog.open();
				} else {
					// Fallback: native color input
					const colorInput = document.createElement( 'input' );
					colorInput.type = 'color';
					colorInput.value = currentColor;
					colorInput.style.position = 'absolute';
					colorInput.style.visibility = 'hidden';
					document.body.appendChild( colorInput );

					colorInput.addEventListener( 'change', () => {
						currentColor = colorInput.value;
						btn.querySelector( 'span' ).style.backgroundColor = currentColor;
						this.onFormat( 'highlight', currentColor );
						this._isInteracting = false;
						this.onFocusEditor();
						document.body.removeChild( colorInput );
					} );

					colorInput.click();
				}
			} );

			wrapper.appendChild( btn );
			wrapper.appendChild( dropdownBtn );

			return wrapper;
		}

		/**
		 * Create alignment button
		 *
		 * @private
		 * @param {string} align - Alignment value (left/center/right)
		 * @return {HTMLElement} Button element
		 */
		_createAlignButton( align ) {
			const btn = document.createElement( 'button' );
			btn.className = 'layers-text-toolbar-btn layers-text-toolbar-align';
			btn.setAttribute( 'data-align', align );
			btn.title = this.msg( 'layers-text-toolbar-align-' + align, 'Align ' + align );

			const icons = {
				left: '<svg width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="M2 3h12v2H2zm0 4h8v2H2zm0 4h10v2H2z"/></svg>',
				center: '<svg width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="M2 3h12v2H2zm2 4h8v2H4zm1 4h6v2H5z"/></svg>',
				right: '<svg width="16" height="16" viewBox="0 0 16 16"><path fill="currentColor" d="M2 3h12v2H2zm4 4h8v2H6zm2 4h6v2H8z"/></svg>'
			};
			btn.innerHTML = icons[ align ];

			const currentAlign = this.layer.textAlign || 'left';
			if ( currentAlign === align ) {
				btn.classList.add( 'active' );
			}

			btn.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				// Deactivate siblings
				if ( this.toolbarElement ) {
					const siblings = this.toolbarElement.querySelectorAll( '.layers-text-toolbar-align' );
					siblings.forEach( ( s ) => s.classList.remove( 'active' ) );
				}
				btn.classList.add( 'active' );
				this.onFormat( 'textAlign', align );
			} );

			btn.addEventListener( 'mousedown', ( e ) => e.preventDefault() );

			return btn;
		}

		/**
		 * Create vertical alignment button
		 *
		 * @private
		 * @param {string} align - 'top', 'middle', or 'bottom'
		 * @return {HTMLElement} Button element
		 */
		_createVerticalAlignButton( align ) {
			const btn = document.createElement( 'button' );
			btn.className = 'layers-text-toolbar-btn layers-text-toolbar-valign';
			btn.setAttribute( 'data-valign', align );
			btn.title = this.msg( 'layers-text-toolbar-valign-' + align, 'Align ' + align );

			// Icons show vertical positioning of content in a box
			const icons = {
				top: '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="currentColor" d="M4 4h8v2H4z"/></svg>',
				middle: '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="currentColor" d="M4 7h8v2H4z"/></svg>',
				bottom: '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="currentColor" d="M4 10h8v2H4z"/></svg>'
			};
			btn.innerHTML = icons[ align ];

			const currentAlign = this.layer.verticalAlign || 'top';
			if ( currentAlign === align ) {
				btn.classList.add( 'active' );
			}

			btn.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				// Deactivate siblings
				if ( this.toolbarElement ) {
					const siblings = this.toolbarElement.querySelectorAll( '.layers-text-toolbar-valign' );
					siblings.forEach( ( s ) => s.classList.remove( 'active' ) );
				}
				btn.classList.add( 'active' );
				this.onFormat( 'verticalAlign', align );
			} );

			btn.addEventListener( 'mousedown', ( e ) => e.preventDefault() );

			return btn;
		}

		/**
		 * Create color picker
		 *
		 * @private
		 * @return {HTMLElement} Color picker element
		 */
		_createColorPicker() {
			const wrapper = document.createElement( 'div' );
			wrapper.className = 'layers-text-toolbar-color-wrapper';

			const currentColor = this.layer.color || this.layer.fill || '#000000';
			const ColorPickerDialog = window.Layers && window.Layers.UI && window.Layers.UI.ColorPickerDialog;
			const colorPickerStrings = this._getColorPickerStrings();

			let colorButton;
			let storedColor = currentColor;

			if ( ColorPickerDialog && typeof ColorPickerDialog.createColorButton === 'function' ) {
				colorButton = ColorPickerDialog.createColorButton( {
					color: currentColor,
					strings: colorPickerStrings,
					onClick: () => {
						this.onSaveSelection();
						const originalColor = storedColor;
						this._isInteracting = true;

						const dialog = new ColorPickerDialog( {
							currentColor: storedColor,
							strings: colorPickerStrings,
							anchorElement: colorButton,
							onApply: ( newColor ) => {
								storedColor = newColor;
								this.onFormat( 'color', newColor );
								ColorPickerDialog.updateColorButton( colorButton, newColor, colorPickerStrings );
								this._isInteracting = false;
								this.onFocusEditor();
							},
							onPreview: ( previewColor ) => {
								this.onFormat( 'color', previewColor );
							},
							onCancel: () => {
								this.onFormat( 'color', originalColor );
								this._isInteracting = false;
								this.onFocusEditor();
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
				input.title = this.msg( 'layers-text-toolbar-color', 'Text color' );

				input.addEventListener( 'mousedown', () => {
					this.onSaveSelection();
				} );

				input.addEventListener( 'change', () => {
					this.onFormat( 'color', input.value );
					this._isInteracting = false;
					this.onFocusEditor();
				} );

				input.addEventListener( 'focus', () => {
					this._isInteracting = true;
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
		 * Get i18n strings for color picker dialogs
		 *
		 * @private
		 * @return {Object} Color picker strings
		 */
		_getColorPickerStrings() {
			return {
				title: this.msg( 'layers-color-picker-title', 'Choose color' ),
				standard: this.msg( 'layers-color-picker-standard', 'Standard colors' ),
				saved: this.msg( 'layers-color-picker-saved', 'Saved colors' ),
				customSection: this.msg( 'layers-color-picker-custom-section', 'Custom color' ),
				none: this.msg( 'layers-color-picker-none', 'No fill (transparent)' ),
				emptySlot: this.msg( 'layers-color-picker-empty-slot', 'Empty slot' ),
				cancel: this.msg( 'layers-color-picker-cancel', 'Cancel' ),
				apply: this.msg( 'layers-color-picker-apply', 'Apply' ),
				transparent: this.msg( 'layers-color-picker-transparent', 'Transparent' ),
				swatchTemplate: this.msg( 'layers-color-picker-color-swatch', 'Set color to $1' ),
				previewTemplate: this.msg( 'layers-color-picker-color-preview', 'Current color: $1' )
			};
		}

		/**
		 * Setup toolbar drag functionality
		 *
		 * @private
		 * @param {HTMLElement} handle - Drag handle element
		 */
		_setupDrag( handle ) {
			handle.addEventListener( 'mousedown', ( e ) => {
				e.preventDefault();
				this._isDragging = true;

				const rect = this.toolbarElement.getBoundingClientRect();
				this._dragOffset = {
					x: e.clientX - rect.left,
					y: e.clientY - rect.top
				};

				this._boundMouseMove = ( me ) => this._handleDrag( me );
				this._boundMouseUp = () => this._stopDrag();

				document.addEventListener( 'mousemove', this._boundMouseMove );
				document.addEventListener( 'mouseup', this._boundMouseUp );
			} );
		}

		/**
		 * Handle toolbar drag movement
		 *
		 * @private
		 * @param {MouseEvent} e - Mouse event
		 */
		_handleDrag( e ) {
			if ( !this._isDragging || !this.toolbarElement ) {
				return;
			}

			const containerRect = this.containerElement ?
				this.containerElement.getBoundingClientRect() :
				{ left: 0, top: 0 };

			const newX = e.clientX - this._dragOffset.x - containerRect.left;
			const newY = e.clientY - this._dragOffset.y - containerRect.top;

			this.toolbarElement.style.left = newX + 'px';
			this.toolbarElement.style.top = newY + 'px';
		}

		/**
		 * Stop toolbar drag
		 *
		 * @private
		 */
		_stopDrag() {
			this._isDragging = false;

			if ( this._boundMouseMove ) {
				document.removeEventListener( 'mousemove', this._boundMouseMove );
			}
			if ( this._boundMouseUp ) {
				document.removeEventListener( 'mouseup', this._boundMouseUp );
			}

			this._boundMouseMove = null;
			this._boundMouseUp = null;
		}
	}

	// Export to namespace
	window.Layers = window.Layers || {};
	window.Layers.Canvas = window.Layers.Canvas || {};
	window.Layers.Canvas.RichTextToolbar = RichTextToolbar;

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = RichTextToolbar;
	}
}() );
