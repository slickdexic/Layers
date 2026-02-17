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
 * Rich text support (v1.5.37+):
 * - For textbox/callout layers, uses ContentEditable for mixed formatting
 * - Select text and use toolbar to apply bold, italic, underline, colors
 * - Formatting is preserved per-text-run in richText property
 *
 * @module ext.layers.editor.canvas.InlineTextEditor
 * @since 1.5.13
 * @version 1.5.37 - Add rich text formatting support
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
			this.originalRichText = null;

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

			// Rich text mode flag
			this._isRichTextMode = false;

			// Saved selection for preserving across toolbar interactions
			this._savedSelection = null;

			// Display scale factor for coordinate/font conversions
			// Updated in _positionEditor, used for font size scaling
			this._displayScale = 1;

			// Remember last highlight color for persistence across editing sessions
			this._lastHighlightColor = '#ffff00';
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
		 * Get the element that holds contentEditable
		 * For multiline types, this is the inner wrapper; for single-line, it's editorElement
		 *
		 * @private
		 * @return {HTMLElement|null} The editable element or null
		 */
		_getEditableElement() {
			if ( !this.editorElement ) {
				return null;
			}
			// For multiline, contentEditable is on the wrapper
			if ( this._isMultilineType( this.editingLayer ) ) {
				return this.editorElement.querySelector( '.layers-inline-content-wrapper' );
			}
			// For single line (input), the editorElement itself is the editable
			return this.editorElement;
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
			this.originalRichText = layer.richText ? JSON.parse( JSON.stringify( layer.richText ) ) : null;
			this.isEditing = true;
			this._isRichTextMode = this._isMultilineType( layer );

			// Calculate display scale FIRST so richTextToHtml uses correct scaling
			this._calculateDisplayScale();

			// Debug: Track fontSize at edit start
			const debug = typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' );
			if ( debug ) {
				// eslint-disable-next-line no-console
				console.log( '[InlineTextEditor] startEditing - fontSize tracking', {
					layerId: layer.id,
					layerFontSize: layer.fontSize,
					hasRichText: !!layer.richText,
					richTextFontSizes: layer.richText ? layer.richText.map( ( r ) =>
						r.style && r.style.fontSize ).filter( Boolean ) : [],
					displayScale: this._displayScale
				} );
			}

			// Create and position the editor FIRST (before modifying layer)
			this._createEditor();
			this._positionEditor();
			this._setupEventHandlers();

			// For textbox/callout layers, keep the background visible by clearing the text
			// For simple text layers, hide the layer entirely
			// Do this AFTER creating the editor so it gets the original text
			if ( this._isMultilineType( layer ) ) {
				// Clear layer text AND richText so only background renders on canvas
				// (we saved originalText and originalRichText for restoration)
				// Use delete (not null) to avoid sending null to server if saved mid-edit
				this._originalVisible = true;
				layer.text = '';
				delete layer.richText;
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

			// Create floating toolbar using RichTextToolbar
			this._createToolbar();

			// Focus the editable element (wrapper for multiline, editorElement for input)
			const editableEl = this._getEditableElement();
			if ( editableEl ) {
				editableEl.focus();
				// Select all text for easy replacement
				if ( typeof editableEl.select === 'function' ) {
					// Input/textarea elements
					editableEl.select();
				} else if ( editableEl.contentEditable === 'true' ) {
					// ContentEditable elements - select all content
					const selection = window.getSelection();
					const range = document.createRange();
					range.selectNodeContents( editableEl );
					selection.removeAllRanges();
					selection.addRange( range );
				}
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

			// Flush any pending debounced input before finishing
			if ( this._inputDebounceTimer ) {
				clearTimeout( this._inputDebounceTimer );
				this._inputDebounceTimer = null;
				this._handleInput();
			}

			const shouldApply = apply !== false;
			let changesApplied = false;
			const wasTextbox = this._isMultilineType( this.editingLayer );

			// Debug logging (controlled by extension config)
			const debug = typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' );
			if ( debug && typeof mw.log !== 'undefined' ) {
				mw.log( '[InlineTextEditor] finishEditing called', {
					apply: apply,
					wasTextbox: wasTextbox,
					hasEditorElement: !!this.editorElement,
					hasEditingLayer: !!this.editingLayer,
					isRichTextMode: this._isRichTextMode
				} );
			}

			if ( shouldApply && this.editorElement && this.editingLayer ) {
				let newText, newRichText = null;

				// Extract content based on editor type
				// For multiline types, contentEditable is on the wrapper, not editorElement
				if ( this._isRichTextMode && this._isMultilineType( this.editingLayer ) ) {
					// ContentEditable mode - extract richText and plain text
					const RichTextConverter = window.Layers.Canvas.RichTextConverter;
					const contentEl = this._getContentElement();
					const html = contentEl ? contentEl.innerHTML : '';
					newRichText = RichTextConverter.htmlToRichText( html, this._displayScale );
					newText = this._getPlainTextFromEditor();

					// Extract dominant fontSize from richText to update layer.fontSize
					// This ensures the toolbar shows the correct value when re-editing
					// Pass current layer.fontSize so runs without explicit fontSize
					// are counted as using the base size (prevents overwrite bug)
					const baseFontSize = this.editingLayer.fontSize || 16;
					const dominantFontSize = this._extractDominantFontSize( newRichText, baseFontSize );
					if ( dominantFontSize !== null ) {
						this.editingLayer.fontSize = dominantFontSize;
					}

					if ( debug ) {
						// Enhanced logging to trace fontSize bug
						const richTextFontSizes = newRichText ?
							newRichText.map( ( r ) => ( {
								text: r.text ? r.text.substring( 0, 20 ) : '',
								fontSize: r.style ? r.style.fontSize : undefined
							} ) ) : [];
						// eslint-disable-next-line no-console
						console.log( '[InlineTextEditor] finishEditing - fontSize tracking', {
							html: html.substring( 0, 500 ),
							displayScale: this._displayScale,
							richTextFontSizes: richTextFontSizes,
							dominantFontSize: dominantFontSize,
							layerFontSizeAfter: this.editingLayer.fontSize,
							layerId: this.editingLayer.id
						} );
					}
				} else {
					// Input/textarea mode - just get value
					newText = this.editorElement.value;
				}

				// Check if text or richText changed
				const textChanged = newText !== this.originalText;
				const richTextChanged = this._isRichTextMode &&
					JSON.stringify( newRichText ) !== JSON.stringify( this.originalRichText );

				if ( debug && typeof mw.log !== 'undefined' ) {
					mw.log( '[InlineTextEditor] Change detection', {
						textChanged: textChanged,
						richTextChanged: richTextChanged,
						originalText: this.originalText,
						newText: newText
					} );
				}

				if ( textChanged || richTextChanged ) {
					// Save state for undo before making changes
					if ( this.canvasManager && typeof this.canvasManager.saveState === 'function' ) {
						this.canvasManager.saveState( 'Edit text' );
					}

					// Update the layer
					this.editingLayer.text = newText;

					// Update richText for textbox/callout
					if ( this._isRichTextMode ) {
						if ( newRichText && newRichText.length > 0 ) {
							this.editingLayer.richText = newRichText;
						} else {
							// No rich text - remove property
							delete this.editingLayer.richText;
						}
					}

					changesApplied = true;

					if ( debug && typeof mw.log !== 'undefined' ) {
						mw.log( '[InlineTextEditor] Layer updated', {
							layerId: this.editingLayer.id,
							text: this.editingLayer.text,
							hasRichText: !!this.editingLayer.richText,
							richTextLength: this.editingLayer.richText ? this.editingLayer.richText.length : 0
						} );
					}
				} else if ( wasTextbox ) {
					// Restore original text and richText for textbox (we cleared them for editing)
					this.editingLayer.text = this.originalText;
					if ( this.originalRichText ) {
						this.editingLayer.richText = this.originalRichText;
					} else {
						delete this.editingLayer.richText;
					}
				}
			} else if ( !shouldApply && wasTextbox && this.editingLayer ) {
				// Canceled - restore original text for textbox
				this.editingLayer.text = this.originalText;
				if ( this.originalRichText ) {
					this.editingLayer.richText = this.originalRichText;
				} else {
					delete this.editingLayer.richText;
				}
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
			this.originalRichText = null;
			this._isRichTextMode = false;

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
		 * Get the content element - the wrapper div for multiline or the editor element itself.
		 * This is where the actual text content lives.
		 *
		 * Note: When the user types in a contentEditable div, the browser may place text
		 * either inside the wrapper div or directly in the parent editorElement.
		 * We need to check both locations and return the one with actual content.
		 *
		 * @private
		 * @return {HTMLElement|null} The content element
		 */
		_getContentElement() {
			if ( !this.editorElement ) {
				return null;
			}
			// For multiline (contentEditable), check for wrapper div
			const wrapper = this.editorElement.querySelector( '.layers-inline-content-wrapper' );
			if ( wrapper ) {
				// Check if wrapper has content, or if content is actually in parent
				const wrapperText = wrapper.textContent || '';
				const fullText = this.editorElement.textContent || '';
				// If wrapper is empty but parent has text, browser placed content outside wrapper
				if ( wrapperText.trim() === '' && fullText.trim() !== '' ) {
					return this.editorElement;
				}
				return wrapper;
			}
			return this.editorElement;
		}

		/**
		 * Get the current pending text content from the editor without closing it.
		 * This allows other property changes to preserve text during inline editing.
		 *
		 * @return {Object|null} Object with { text, richText } or null if not editing
		 */
		getPendingTextContent() {
			if ( !this.isEditing || !this.editorElement || !this.editingLayer ) {
				return null;
			}

			let newText, newRichText = null;

			// For multiline types, contentEditable is on the wrapper, not editorElement
			if ( this._isRichTextMode && this._isMultilineType( this.editingLayer ) ) {
				const RichTextConverter = window.Layers.Canvas.RichTextConverter;
				const contentEl = this._getContentElement();
				const html = contentEl ? contentEl.innerHTML : '';
				newRichText = RichTextConverter.htmlToRichText( html, this._displayScale );
				newText = this._getPlainTextFromEditor();
			} else {
				newText = this.editorElement.value || '';
			}

			return {
				text: newText,
				richText: newRichText
			};
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
				// Create outer container div for positioning and flexbox
				this.editorElement = document.createElement( 'div' );
				this.editorElement.style.resize = 'none';
				this.editorElement.style.overflow = 'auto';

				// Create inner content wrapper - this holds contentEditable for proper cursor positioning
				// The outer element uses flexbox for vertical alignment, wrapper handles horizontal
				const RichTextConverter = window.Layers.Canvas.RichTextConverter;
				const contentWrapper = document.createElement( 'div' );
				contentWrapper.className = 'layers-inline-content-wrapper';
				// Make wrapper contentEditable so cursor appears at correct position with textAlign
				contentWrapper.contentEditable = 'true';
				contentWrapper.style.width = '100%';
				contentWrapper.style.whiteSpace = 'pre-wrap';
				contentWrapper.style.wordWrap = 'break-word';
				contentWrapper.style.minHeight = '1em';
				contentWrapper.style.outline = 'none';
				// Apply text alignment to wrapper so cursor appears at correct position
				contentWrapper.style.textAlign = layer.textAlign || 'left';

				// Set content in wrapper - prefer richText if available
				if ( layer.richText && Array.isArray( layer.richText ) && layer.richText.length > 0 ) {
					contentWrapper.innerHTML = RichTextConverter.richTextToHtml( layer.richText, this._displayScale );
				} else {
					// Plain text - escape HTML and convert newlines
					const escapedText = RichTextConverter.escapeHtml( layer.text || '' );
					contentWrapper.innerHTML = escapedText.replace( /\n/g, '<br>' );
				}

				this.editorElement.appendChild( contentWrapper );
			} else {
				this.editorElement = document.createElement( 'input' );
				this.editorElement.type = 'text';
				this.editorElement.value = layer.text || '';
			}

			// Set common class name
			this.editorElement.className = 'layers-inline-text-editor';
			if ( isMultiline ) {
				this.editorElement.classList.add( 'textbox' );
				this.editorElement.classList.add( 'rich-text-enabled' );
			}

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

			// For multiline (textbox), use flexbox for vertical alignment
			if ( isMultiline ) {
				baseStyles.display = 'flex';
				baseStyles.flexDirection = 'column';
				// Map vertical alignment to flexbox justify-content
				const alignMap = {
					top: 'flex-start',
					middle: 'center',
					bottom: 'flex-end'
				};
				baseStyles.justifyContent = alignMap[ layer.verticalAlign ] || 'flex-start';
			}

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
				const textAlign = layer.textAlign || 'left';
				style.textAlign = textAlign;
				style.lineHeight = ( layer.lineHeight || 1.2 ).toString();
				// Also apply to content wrapper so cursor appears at correct position
				const wrapper = this.editorElement.querySelector( '.layers-inline-content-wrapper' );
				if ( wrapper ) {
					wrapper.style.textAlign = textAlign;
				}
			} else {
				style.textAlign = 'left';
				style.lineHeight = '1.2';
			}
		}

		/**
		 * Calculate and store the display scale factor
		 *
		 * This must be called before _richTextToHtml() to ensure inline font
		 * sizes are correctly scaled relative to the canvas display.
		 *
		 * @private
		 */
		_calculateDisplayScale() {
			if ( !this.canvasManager ) {
				this._displayScale = 1;
				return;
			}

			const canvas = this.canvasManager.canvas;
			if ( !canvas ) {
				this._displayScale = 1;
				return;
			}

			// Get canvas bounding rect for coordinate conversion
			const canvasRect = canvas.getBoundingClientRect();

			// Calculate scale from logical canvas to displayed size
			const scaleX = canvasRect.width / canvas.width;
			const scaleY = canvasRect.height / canvas.height;

			this._displayScale = Math.min( scaleX, scaleY );
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
			const scale = Math.min( scaleX, scaleY );
			this._displayScale = scale; // Store for use in font size conversions
			const scaledFontSize = ( layer.fontSize || 16 ) * scale;
			const scaledPadding = padding * scale;

			// Calculate rotation - need to rotate around the center of the element
			const rotation = layer.rotation || 0;

			// Determine vertical alignment CSS for textbox/callout
			let verticalAlignCSS = 'flex-start';
			if ( this._isMultilineType( layer ) ) {
				const vAlign = layer.verticalAlign || 'top';
				if ( vAlign === 'middle' ) {
					verticalAlignCSS = 'center';
				} else if ( vAlign === 'bottom' ) {
					verticalAlignCSS = 'flex-end';
				}
			}

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
					transformOrigin: 'center center',
					display: this._isMultilineType( layer ) ? 'flex' : 'block',
					flexDirection: 'column',
					justifyContent: verticalAlignCSS
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
					transformOrigin: 'center center',
					display: this._isMultilineType( layer ) ? 'flex' : 'block',
					flexDirection: 'column',
					justifyContent: verticalAlignCSS
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
			// CSS font shorthand order: font-style font-variant font-weight font-size font-family
			ctx.font = ( layer.fontStyle || 'normal' ) + ' ' +
				( layer.fontWeight || 'normal' ) + ' ' +
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

			// Input handler for real-time preview (debounced to avoid DOM thrashing)
			this._boundInputHandler = () => {
				if ( this._inputDebounceTimer ) {
					clearTimeout( this._inputDebounceTimer );
				}
				this._inputDebounceTimer = setTimeout( () => {
					this._handleInput();
					this._inputDebounceTimer = null;
				}, 16 );
			};
			this.editorElement.addEventListener( 'input', this._boundInputHandler );

			// Selection change handler to update toolbar button states
			this._boundSelectionChangeHandler = () => this._updateToolbarButtonStates();
			document.addEventListener( 'selectionchange', this._boundSelectionChangeHandler );

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
			// Use setTimeout to allow click events and toolbar interactions to process first.
			// 250ms gives dropdowns/color pickers enough time to set their interaction flags
			// before this handler checks them (was 150ms, causing race with 100ms toolbar opens).
			this._blurTimeout = setTimeout( () => {
				// Don't finish editing if we're interacting with the toolbar or a dialog
				// Check both the local flag and the toolbar instance
				const toolbarInteracting = this._isToolbarInteraction ||
					( this._toolbar && this._toolbar.isInteracting() );
				if ( toolbarInteracting ) {
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
			}, 250 );
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

			// Clean up debounce timer
			if ( this._inputDebounceTimer ) {
				clearTimeout( this._inputDebounceTimer );
				this._inputDebounceTimer = null;
			}

			// Clean up blur timeout
			if ( this._blurTimeout ) {
				clearTimeout( this._blurTimeout );
				this._blurTimeout = null;
			}

			if ( this._boundSelectionChangeHandler ) {
				document.removeEventListener( 'selectionchange', this._boundSelectionChangeHandler );
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
			this._boundSelectionChangeHandler = null;
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
		 * Update toolbar button states based on current selection's formatting
		 *
		 * Uses document.queryCommandState to detect active formatting at cursor position.
		 * This ensures buttons accurately reflect the current selection's state.
		 *
		 * @private
		 */
		_updateToolbarButtonStates() {
			if ( !this.toolbarElement || !this.isEditing || !this._isRichTextMode ) {
				return;
			}

			// Don't update toolbar while user is interacting with it
			// This prevents the font size from jumping back while changing it
			if ( this._toolbar && typeof this._toolbar.isInteracting === 'function' &&
				this._toolbar.isInteracting() ) {
				return;
			}

			// Check if selection is within our editor
			const selection = window.getSelection();
			if ( !selection.rangeCount || !this.editorElement ) {
				return;
			}
			const range = selection.getRangeAt( 0 );
			if ( !this.editorElement.contains( range.commonAncestorContainer ) ) {
				return;
			}

			// Update bold button state
			const boldBtn = this.toolbarElement.querySelector( '[data-format="bold"]' );
			if ( boldBtn ) {
				const isBold = document.queryCommandState( 'bold' );
				boldBtn.classList.toggle( 'active', isBold );
			}

			// Update italic button state
			const italicBtn = this.toolbarElement.querySelector( '[data-format="italic"]' );
			if ( italicBtn ) {
				const isItalic = document.queryCommandState( 'italic' );
				italicBtn.classList.toggle( 'active', isItalic );
			}

			// Update underline button state
			const underlineBtn = this.toolbarElement.querySelector( '[data-format="underline"]' );
			if ( underlineBtn ) {
				const isUnderline = document.queryCommandState( 'underline' );
				underlineBtn.classList.toggle( 'active', isUnderline );
			}

			// Update strikethrough button state
			const strikeBtn = this.toolbarElement.querySelector( '[data-format="strikethrough"]' );
			if ( strikeBtn ) {
				const isStrike = document.queryCommandState( 'strikeThrough' );
				strikeBtn.classList.toggle( 'active', isStrike );
			}

			// Update font family and size from selection
			const selectionInfo = this._getSelectionFormatInfo();
			if ( this._toolbar && typeof this._toolbar.updateFromSelection === 'function' ) {
				this._toolbar.updateFromSelection( selectionInfo );
			}
		}

		/**
		 * Get formatting information from the current selection
		 *
		 * Traverses up from the selection anchor to find font size and family
		 * from data attributes or computed styles.
		 *
		 * @private
		 * @return {Object} Format info { fontSize, fontFamily, fontSizeFromDOM }
		 *   fontSizeFromDOM indicates if fontSize was found in DOM (data-font-size attribute)
		 */
		_getSelectionFormatInfo() {
			const info = {
				fontSize: ( this.editingLayer && this.editingLayer.fontSize ) || 16,
				fontFamily: ( this.editingLayer && this.editingLayer.fontFamily ) || 'Arial',
				backgroundColor: null,
				fontSizeFromDOM: false
			};

			const selection = window.getSelection();
			if ( !selection.rangeCount ) {
				return info;
			}

			// Get the node at the selection anchor
			let node = selection.anchorNode;
			if ( !node ) {
				return info;
			}

			// If text node, get parent element
			if ( node.nodeType === Node.TEXT_NODE ) {
				node = node.parentElement;
			}

			// Traverse up to find formatting spans
			// For fontSize, we want the INNERMOST (most specific) value, so stop at first found
			// For fontFamily, we also want the innermost value
			let foundFontSize = false;
			let foundFontFamily = false;
			while ( node && node !== this.editorElement ) {
				if ( node.nodeType === Node.ELEMENT_NODE ) {
					// Check for data-font-size attribute (our custom unscaled value)
					// Only take the first (innermost) one - it's the most recently applied
					if ( !foundFontSize && node.dataset && node.dataset.fontSize ) {
						info.fontSize = parseFloat( node.dataset.fontSize );
						info.fontSizeFromDOM = true;
						foundFontSize = true;
					}

					// Check for font-family in inline style
					// Only take the first (innermost) one
					if ( !foundFontFamily && node.style && node.style.fontFamily ) {
						// Clean up quotes from font family
						info.fontFamily = node.style.fontFamily.replace( /["']/g, '' ).split( ',' )[ 0 ].trim();
						foundFontFamily = true;
					}

					// Check for background-color (highlight)
					if ( node.style && node.style.backgroundColor && !info.backgroundColor ) {
						const bgColor = node.style.backgroundColor;
						// Only set if it's a real color, not 'transparent' or empty
						if ( bgColor && bgColor !== 'transparent' && bgColor !== 'inherit' ) {
							info.backgroundColor = bgColor;
						}
					}
				}
				node = node.parentElement;
			}

			return info;
		}

		/**
		 * Create the floating formatting toolbar
		 *
		 * Delegates to RichTextToolbar for toolbar creation and management.
		 * This method was refactored as part of the God Class Reduction Initiative.
		 *
		 * @private
		 */
		_createToolbar() {
			if ( !this.editingLayer || !this.editorElement ) {
				return;
			}

			const RichTextToolbar = window.Layers && window.Layers.Canvas &&
				window.Layers.Canvas.RichTextToolbar;

			if ( !RichTextToolbar ) {
				// Fallback if RichTextToolbar not loaded - create minimal toolbar
				this.toolbarElement = null;
				this._toolbar = null;
				return;
			}

			// Create toolbar instance with callbacks
			this._toolbar = new RichTextToolbar( {
				layer: this.editingLayer,
				isRichTextMode: this._isRichTextMode,
				editorElement: this.editorElement,
				containerElement: this.containerElement,
				highlightColor: this._lastHighlightColor,
				onFormat: ( property, value ) => {
					// Track highlight color changes for persistence
					if ( property === 'highlight' && value && value !== 'transparent' ) {
						this._lastHighlightColor = value;
					}
					this._applyFormat( property, value );
				},
				onSaveSelection: () => this._saveSelection(),
				onFocusEditor: () => {
					const editableEl = this._getEditableElement();
					if ( editableEl ) {
						editableEl.focus();
					}
				},
				msg: ( key, fallback ) => this._msg( key, fallback )
			} );

			// Create and store reference to the toolbar element
			this.toolbarElement = this._toolbar.create();
		}

		// =========================================================================
		// Toolbar Creation Methods - EXTRACTED
		// =========================================================================
		// NOTE: The following methods have been extracted to RichTextToolbar.js:
		//   - _createFontSelect() -> RichTextToolbar._createFontSelect()
		//   - _createFontSizeInput() -> RichTextToolbar._createFontSizeInput()
		//   - _createFormatButton() -> RichTextToolbar._createFormatButton()
		//   - _createHighlightButton() -> RichTextToolbar._createHighlightButton()
		//   - _createAlignButton() -> RichTextToolbar._createAlignButton()
		//   - _createColorPicker() -> RichTextToolbar._createColorPicker()
		//   - _createSeparator() -> RichTextToolbar._createSeparator()
		// =========================================================================

		/**
		 * Save the current selection in the editor
		 *
		 * This is called when toolbar controls receive focus, so we can
		 * restore the selection before applying formatting to it.
		 *
		 * @private
		 */
		_saveSelection() {
			if ( !this.editorElement || !this._isRichTextMode ) {
				return;
			}

			const editableEl = this._getEditableElement();
			const selection = window.getSelection();
			if ( selection && selection.rangeCount > 0 && editableEl &&
				editableEl.contains( selection.anchorNode ) ) {
				// Only save if there's actually a selection (not collapsed)
				if ( !selection.isCollapsed ) {
					this._savedSelection = selection.getRangeAt( 0 ).cloneRange();
				}
			}
		}

		/**
		 * Restore the saved selection
		 *
		 * @private
		 * @return {boolean} True if selection was restored
		 */
		_restoreSelection() {
			if ( !this._savedSelection || !this.editorElement ) {
				return false;
			}

			try {
				const editableEl = this._getEditableElement();
				if ( editableEl ) {
					editableEl.focus();
				}
				const selection = window.getSelection();
				selection.removeAllRanges();
				selection.addRange( this._savedSelection );
				return true;
			} catch {
				// Selection restoration can fail if DOM has changed
				return false;
			}
		}

		/**
		 * Clear the saved selection
		 *
		 * @private
		 */
		_clearSavedSelection() {
			this._savedSelection = null;
		}

		/**
		 * Apply a format change to the layer and editor
		 *
		 * Uses editor.updateLayer() to ensure changes are properly persisted
		 * through StateManager and saved when the document is saved.
		 *
		 * For rich text mode (textbox/callout), if there's a text selection,
		 * the format is applied only to the selected text using execCommand.
		 * Otherwise, the format is applied to the entire layer.
		 *
		 * @private
		 * @param {string} property - Property name
		 * @param {*} value - New value
		 */
		_applyFormat( property, value ) {
			if ( !this.editingLayer ) {
				return;
			}

			// In rich text mode, check for selection first
			// For multiline types, contentEditable is on the wrapper, not editorElement
			if ( this._isRichTextMode && this._isMultilineType( this.editingLayer ) ) {

				// Format properties that can be applied to selection
				const selectionFormats = [ 'fontWeight', 'fontStyle', 'color', 'underline',
					'strikethrough', 'highlight', 'fontSize', 'fontFamily' ];

				// Toggle formats use execCommand which works with cursor (no selection)
				// These will set the typing state for future characters
				const toggleFormats = [ 'fontWeight', 'fontStyle', 'underline', 'strikethrough',
					'color', 'highlight' ];

				if ( selectionFormats.includes( property ) ) {
					// Try to restore saved selection first (for toolbar interactions)
					let hasSelection = false;
					if ( this._savedSelection ) {
						hasSelection = this._restoreSelection();
					}

					// If no saved selection, check current selection
					if ( !hasSelection ) {
						const selection = window.getSelection();
						hasSelection = selection && !selection.isCollapsed &&
							this.editorElement.contains( selection.anchorNode );
					}

					if ( hasSelection ) {
						this._applyFormatToSelection( property, value );
						// Clear saved selection after use
						this._clearSavedSelection();
						return;
					}

					// No selection (cursor only) - for toggle formats, still call
					// _applyFormatToSelection. execCommand will set the typing state
					// for future characters. For fontSize/fontFamily, do nothing
					// since we can't wrap non-existent text.
					if ( toggleFormats.includes( property ) ) {
						this._applyFormatToSelection( property, value );
						this._clearSavedSelection();
						return;
					}

					// fontSize/fontFamily with no selection - just return, don't apply to layer
					return;
				}
			}

			// No selection or not rich text mode - apply to entire layer
			const layerId = this.editingLayer.id;
			const isTextbox = this._isMultilineType( this.editingLayer );

			// Build changes object including the format change
			// Also preserve the editing state (hidden text for textbox, hidden layer for text)
			// to prevent the layer from rendering with original text while editing
			const changes = { [ property ]: value };

			if ( isTextbox ) {
				// Keep text AND richText cleared during inline editing
				// This prevents double rendering (canvas + HTML overlay)
				changes.text = '';
				changes.richText = null;
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
				} else if ( property === 'verticalAlign' ) {
					// Update flexbox alignment for immediate visual feedback
					const alignMap = {
						top: 'flex-start',
						middle: 'center',
						bottom: 'flex-end'
					};
					this.editorElement.style.justifyContent = alignMap[ value ] || 'flex-start';
					// Move cursor to end of content so it appears at the new position
					this._moveCursorToEnd();
				} else if ( property === 'textAlign' ) {
					this.editorElement.style.textAlign = value;
					// Also update the content wrapper so cursor appears at correct position
					const wrapper = this.editorElement.querySelector( '.layers-inline-content-wrapper' );
					if ( wrapper ) {
						wrapper.style.textAlign = value;
					}
					// Move cursor to end of content so it appears at the new position
					this._moveCursorToEnd();
				} else if ( styleMap[ property ] ) {
					this.editorElement.style[ styleMap[ property ] ] = value;
				}
			}

			// Sync with properties panel so both UI elements show the same values
			this._syncPropertiesPanel();
		}

		/**
		 * Apply formatting to selected text in contentEditable
		 *
		 * Uses document.execCommand for browser-native rich text editing.
		 * This applies formatting only to the selected text, preserving
		 * the rest of the content unchanged.
		 *
		 * @private
		 * @param {string} property - Format property name
		 * @param {*} value - Format value
		 */
		_applyFormatToSelection( property, value ) {
			if ( !this.editorElement ) {
				return;
			}

			// Focus the editable element to ensure selection is valid
			const editableEl = this._getEditableElement();
			if ( editableEl ) {
				editableEl.focus();
			}

			// Map properties to execCommand commands
			switch ( property ) {
				case 'fontWeight':
					document.execCommand( 'bold', false, null );
					break;
				case 'fontStyle':
					document.execCommand( 'italic', false, null );
					break;
				case 'underline':
					document.execCommand( 'underline', false, null );
					break;
				case 'strikethrough':
					document.execCommand( 'strikeThrough', false, null );
					break;
				case 'color':
					document.execCommand( 'foreColor', false, value );
					break;
				case 'highlight': {
					// Check if selection already has highlight - if so, toggle off
					const formatInfo = this._getSelectionFormatInfo();
					if ( formatInfo.backgroundColor ) {
						// Remove highlight by setting to transparent
						document.execCommand( 'hiliteColor', false, 'transparent' );
					} else {
						// Apply highlight
						document.execCommand( 'hiliteColor', false, value );
					}
					break;
				}
				case 'fontSize': {
					// Apply SCALED font size for display, store UNSCALED value in data attr
					const selection = window.getSelection();
					if ( selection.rangeCount > 0 && !selection.isCollapsed ) {
						const range = selection.getRangeAt( 0 );
						const span = document.createElement( 'span' );
						// Scale the font size for display, but store original value
						// Ensure _displayScale is valid (default to 1 if not)
						const scale = ( this._displayScale && this._displayScale > 0 ) ? this._displayScale : 1;
						const scaledValue = value * scale;

						// Debug logging for fontSize application
						const debug = typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' );
						if ( debug ) {
							// eslint-disable-next-line no-console
							console.log( '[InlineTextEditor] _applyFormatToSelection fontSize:', {
								unscaledValue: value,
								displayScale: this._displayScale,
								usedScale: scale,
								scaledValue: scaledValue
							} );
						}

						// Use setProperty with important to override inherited styles
						span.style.setProperty( 'font-size', scaledValue + 'px', 'important' );
						span.dataset.fontSize = value; // Store unscaled value for parsing

						// Extract contents first so we can clean up nested font-size styling
						const fragment = range.extractContents();

						// Remove font-size styling from any spans within to prevent nesting issues
						// This ensures the new fontSize takes precedence over old ones
						this._removeFontSizeFromFragment( fragment );

						span.appendChild( fragment );
						range.insertNode( span );

						// Update selection to be inside the new span
						selection.removeAllRanges();
						const newRange = document.createRange();
						newRange.selectNodeContents( span );
						selection.addRange( newRange );
					}
					break;
				}
				case 'fontFamily': {
					const selection = window.getSelection();
					if ( selection.rangeCount > 0 && !selection.isCollapsed ) {
						const range = selection.getRangeAt( 0 );
						const span = document.createElement( 'span' );
						// Use setProperty with important to override inherited styles
						span.style.setProperty( 'font-family', value, 'important' );
						try {
							range.surroundContents( span );
						} catch {
							// If selection crosses element boundaries, extract and wrap
							const fragment = range.extractContents();
							span.appendChild( fragment );
							range.insertNode( span );
						}
						// Update selection to be inside the new span
						selection.removeAllRanges();
						const newRange = document.createRange();
						newRange.selectNodeContents( span );
						selection.addRange( newRange );
					}
					break;
				}
			}
		}

		/**
		 * Remove font-size styling from all spans within a document fragment
		 *
		 * This prevents nested font-size issues when applying new font size
		 * to text that already has font-size styling. Without this, the parser
		 * would use the innermost (old) font-size value instead of the new one.
		 *
		 * @private
		 * @param {DocumentFragment} fragment - Fragment containing content to clean
		 */
		_removeFontSizeFromFragment( fragment ) {
			if ( !fragment ) {
				return;
			}

			// Find all spans with font-size styling within the fragment
			const spans = fragment.querySelectorAll( 'span' );
			for ( const span of spans ) {
				// Remove font-size from inline style
				if ( span.style.fontSize ) {
					span.style.removeProperty( 'font-size' );
				}

				// Remove data-font-size attribute
				if ( span.dataset.fontSize ) {
					delete span.dataset.fontSize;
				}

				// If span now has no style or data attributes, unwrap it
				// (only if it's just a font-size wrapper with no other styles)
				if ( span.style.length === 0 && span.attributes.length === 0 ) {
					// Move all children out of span
					while ( span.firstChild ) {
						span.parentNode.insertBefore( span.firstChild, span );
					}
					span.remove();
				}
			}
		}

		/**
		 * Move the cursor to the end of the content
		 *
		 * Used after alignment changes to ensure the cursor appears
		 * at the new visual position. Without this, the cursor would
		 * appear stuck at the original position until the user types.
		 *
		 * @private
		 */
		_moveCursorToEnd() {
			if ( !this.editorElement ) {
				return;
			}

			// Get the editable element (wrapper for multiline, editorElement for input)
			const editableEl = this._getEditableElement();
			if ( !editableEl ) {
				return;
			}

			// Focus first to ensure selection works
			editableEl.focus();

			if ( editableEl.contentEditable === 'true' ) {
				// ContentEditable - place cursor at end
				const selection = window.getSelection();
				const range = document.createRange();

				// Move to end of content in the editable element
				range.selectNodeContents( editableEl );
				range.collapse( false ); // false = collapse to end
				selection.removeAllRanges();
				selection.addRange( range );
			} else if ( typeof this.editorElement.setSelectionRange === 'function' ) {
				// Input/textarea - place cursor at end
				const len = this.editorElement.value.length;
				this.editorElement.setSelectionRange( len, len );
			}
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

		// =========================================================================
		// Toolbar Drag/Position Methods - EXTRACTED
		// =========================================================================
		// NOTE: The following methods have been extracted to RichTextToolbar.js:
		//   - _setupToolbarDrag() -> RichTextToolbar._setupDrag()
		//   - _handleToolbarDrag() -> RichTextToolbar._handleDrag()
		//   - _stopToolbarDrag() -> RichTextToolbar._stopDrag()
		//   - _positionToolbar() -> RichTextToolbar.position()
		// =========================================================================

		/**
		 * Remove the toolbar from DOM
		 *
		 * Delegates to RichTextToolbar.destroy() for cleanup.
		 *
		 * @private
		 */
		_removeToolbar() {
			// Use RichTextToolbar's destroy method if available
			if ( this._toolbar && typeof this._toolbar.destroy === 'function' ) {
				this._toolbar.destroy();
				this._toolbar = null;
			}

			// Also clean up the element reference
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

		// =========================================================================
		// Rich Text HTML Conversion Methods
		// =========================================================================
		// NOTE: These methods have been extracted to RichTextConverter.js
		// Use window.Layers.Canvas.RichTextConverter for:
		//   - escapeHtml() -> RichTextConverter.escapeHtml()
		//   - richTextToHtml() -> RichTextConverter.richTextToHtml(richText, displayScale)
		//   - htmlToRichText() -> RichTextConverter.htmlToRichText(html, displayScale)
		//   - mergeAdjacentRuns() -> RichTextConverter.mergeAdjacentRuns()
		// =========================================================================

		/**
		 * Extract the dominant font size from richText runs
		 *
		 * When all runs have the same fontSize, or only one fontSize is used,
		 * returns that value. This allows updating layer.fontSize so the toolbar
		 * shows the correct value when re-editing.
		 *
		 * @private
		 * @param {Array|null} richText - Array of {text, style} objects
		 * @param {number} [baseFontSize] - Layer's current base fontSize; runs without
		 *   explicit style.fontSize are counted as using this value
		 * @return {number|null} Dominant font size or null if mixed/none
		 */
		_extractDominantFontSize( richText, baseFontSize ) {
			if ( !Array.isArray( richText ) || richText.length === 0 ) {
				return null;
			}

			// Collect all font sizes from runs (ignoring newline-only runs)
			const fontSizes = [];
			for ( const run of richText ) {
				// Skip empty or newline-only runs
				if ( !run.text || run.text.trim() === '' ) {
					continue;
				}
				if ( run.style && typeof run.style.fontSize === 'number' ) {
					fontSizes.push( run.style.fontSize );
				} else if ( typeof baseFontSize === 'number' ) {
					// Runs without explicit fontSize use the layer's base fontSize.
					// We must count them so the dominant calculation is accurate;
					// otherwise changing some text to a new size would make that
					// size appear "dominant" and overwrite the base for all unstyled runs.
					fontSizes.push( baseFontSize );
				}
			}

			// If no font sizes found in styles, return null
			if ( fontSizes.length === 0 ) {
				return null;
			}

			// Check if all font sizes are the same
			const uniqueSizes = [ ...new Set( fontSizes ) ];
			if ( uniqueSizes.length === 1 ) {
				return uniqueSizes[ 0 ];
			}

			// Mixed font sizes - find the most common one (weighted by text length could
			// be an improvement, but for simplicity we use frequency)
			const sizeCount = {};
			for ( const size of fontSizes ) {
				sizeCount[ size ] = ( sizeCount[ size ] || 0 ) + 1;
			}

			let dominantSize = fontSizes[ 0 ];
			let maxCount = 0;
			for ( const size of Object.keys( sizeCount ) ) {
				if ( sizeCount[ size ] > maxCount ) {
					maxCount = sizeCount[ size ];
					dominantSize = parseFloat( size );
				}
			}

			return dominantSize;
		}

		/**
		 * Get plain text from contentEditable element
		 *
		 * @private
		 * @return {string} Plain text content
		 */
		_getPlainTextFromEditor() {
			if ( !this.editorElement ) {
				return '';
			}

			// For input elements, just return value
			if ( this.editorElement.tagName === 'INPUT' ) {
				return this.editorElement.value || '';
			}

			// For contentEditable, get the content element (wrapper or editorElement)
			const contentEl = this._getContentElement();
			if ( !contentEl ) {
				return '';
			}

			// Clone and extract text with preserved line breaks
			const clone = contentEl.cloneNode( true );

			// Replace <br> with newlines
			const brs = clone.querySelectorAll( 'br' );
			for ( const br of brs ) {
				br.replaceWith( '\n' );
			}

			// Replace block elements with newlines
			const blocks = clone.querySelectorAll( 'div, p' );
			for ( const block of blocks ) {
				if ( block.previousSibling ) {
					block.insertAdjacentText( 'beforebegin', '\n' );
				}
			}

			return clone.textContent || '';
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
