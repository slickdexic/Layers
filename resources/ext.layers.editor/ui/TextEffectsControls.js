/**
 * TextEffectsControls - Manages text-specific style controls for Layers Editor
 * Handles font size, text stroke, and text shadow controls
 *
 * Extracted from ToolbarStyleControls to keep that module under 1000 lines.
 *
 * @module TextEffectsControls
 */
( function () {
	'use strict';

	/**
	 * TextEffectsControls class
	 *
	 * @class
	 */
	class TextEffectsControls {
		/**
		 * @param {Object} config Configuration object
		 * @param {Function} config.msg Message lookup function for i18n
		 * @param {Function} config.addListener Event listener registration function
		 * @param {Function} config.notifyStyleChange Callback when style changes
		 */
		constructor( config ) {
			this.config = config || {};
			this.msgFn = this.config.msg || function ( key, fallback ) {
				return fallback || key;
			};
			this.addListenerFn = this.config.addListener || function () {};
			this.notifyStyleChangeFn = this.config.notifyStyleChange || function () {};

			// DOM references (populated during create methods)
			this.fontSizeInput = null;
			this.fontSizeContainer = null;
			this.textStrokeColor = null;
			this.textStrokeWidth = null;
			this.textStrokeValue = null;
			this.textStrokeContainer = null;
			this.textShadowToggle = null;
			this.textShadowColor = null;
			this.shadowContainer = null;
		}

		/**
		 * Get localized message
		 *
		 * @param {string} key Message key
		 * @param {string} fallback Fallback text
		 * @return {string} Localized message
		 */
		msg( key, fallback ) {
			return this.msgFn( key, fallback );
		}

		/**
		 * Register event listener with tracking
		 *
		 * @param {HTMLElement} element DOM element
		 * @param {string} event Event name
		 * @param {Function} handler Event handler
		 * @param {Object} options Event options
		 */
		addListener( element, event, handler, options ) {
			this.addListenerFn( element, event, handler, options );
		}

		/**
		 * Notify parent of style changes
		 */
		notifyStyleChange() {
			this.notifyStyleChangeFn();
		}

		/**
		 * Create the font size control (for text tool)
		 *
		 * @return {HTMLElement} The font size container
		 */
		createFontSizeControl() {
			const container = document.createElement( 'div' );
			container.className = 'font-size-container style-control-item';
			container.style.display = 'none';

			const label = document.createElement( 'span' );
			label.className = 'style-control-label';
			label.textContent = this.msg( 'layers-prop-font-size', 'Size' );
			container.appendChild( label );

			const input = document.createElement( 'input' );
			input.type = 'number';
			input.min = '8';
			input.max = '72';
			input.value = '16';
			input.className = 'font-size';
			input.title = this.msg( 'layers-prop-font-size', 'Font Size' );
			container.appendChild( input );

			this.fontSizeInput = input;
			this.fontSizeContainer = container;

			this.addListener( input, 'change', () => {
				this.notifyStyleChange();
			} );

			return container;
		}

		/**
		 * Create the text stroke control
		 *
		 * @return {HTMLElement} The text stroke container
		 */
		createTextStrokeControl() {
			const container = document.createElement( 'div' );
			container.className = 'text-stroke-container';
			container.style.display = 'none';

			const label = document.createElement( 'label' );
			label.textContent = this.msg( 'layers-prop-stroke-color', 'Stroke Color' ) + ':';
			label.className = 'stroke-color-label';
			container.appendChild( label );

			const colorInput = document.createElement( 'input' );
			colorInput.type = 'color';
			colorInput.value = '#000000';
			colorInput.className = 'text-stroke-color';
			colorInput.title = this.msg( 'layers-prop-stroke-color', 'Text Stroke Color' );
			container.appendChild( colorInput );
			this.textStrokeColor = colorInput;

			const widthInput = document.createElement( 'input' );
			widthInput.type = 'range';
			widthInput.min = '0';
			widthInput.max = '10';
			widthInput.value = '0';
			widthInput.className = 'text-stroke-width';
			widthInput.title = this.msg( 'layers-prop-stroke-width', 'Text Stroke Width' );
			container.appendChild( widthInput );
			this.textStrokeWidth = widthInput;

			const widthValue = document.createElement( 'span' );
			widthValue.className = 'text-stroke-value';
			widthValue.textContent = '0';
			container.appendChild( widthValue );
			this.textStrokeValue = widthValue;

			this.textStrokeContainer = container;

			// Event handlers (tracked for cleanup)
			this.addListener( colorInput, 'change', () => {
				this.notifyStyleChange();
			} );

			this.addListener( widthInput, 'input', () => {
				widthValue.textContent = widthInput.value;
				this.notifyStyleChange();
			} );

			return container;
		}

		/**
		 * Create the shadow control
		 *
		 * @return {HTMLElement} The shadow container
		 */
		createShadowControl() {
			const container = document.createElement( 'div' );
			container.className = 'text-shadow-container';
			container.style.display = 'none';

			const label = document.createElement( 'label' );
			label.textContent = this.msg( 'layers-effect-shadow', 'Shadow' ) + ':';
			label.className = 'shadow-label';
			container.appendChild( label );

			const toggle = document.createElement( 'input' );
			toggle.type = 'checkbox';
			toggle.className = 'text-shadow-toggle';
			toggle.title = this.msg( 'layers-effect-shadow-enable', 'Enable Drop Shadow' );
			container.appendChild( toggle );
			this.textShadowToggle = toggle;

			const colorInput = document.createElement( 'input' );
			colorInput.type = 'color';
			colorInput.value = '#000000';
			colorInput.className = 'text-shadow-color';
			colorInput.title = this.msg( 'layers-effect-shadow-color', 'Shadow Color' );
			colorInput.style.display = 'none';
			container.appendChild( colorInput );
			this.textShadowColor = colorInput;

			this.shadowContainer = container;

			// Event handlers (tracked for cleanup)
			this.addListener( toggle, 'change', () => {
				colorInput.style.display = toggle.checked ? 'inline-block' : 'none';
				this.notifyStyleChange();
			} );

			this.addListener( colorInput, 'change', () => {
				this.notifyStyleChange();
			} );

			return container;
		}

		/**
		 * Get current text effect style values
		 *
		 * @return {Object} Text effect style properties
		 */
		getStyleValues() {
			return {
				fontSize: this.fontSizeInput ? parseInt( this.fontSizeInput.value, 10 ) : 16,
				textStrokeColor: this.textStrokeColor ? this.textStrokeColor.value : '#000000',
				textStrokeWidth: this.textStrokeWidth ? parseInt( this.textStrokeWidth.value, 10 ) : 0,
				textShadow: this.textShadowToggle ? this.textShadowToggle.checked : false,
				textShadowColor: this.textShadowColor ? this.textShadowColor.value : '#000000'
			};
		}

		/**
		 * Apply style values to controls
		 *
		 * @param {Object} style Style properties to apply
		 */
		applyStyle( style ) {
			if ( !style ) {
				return;
			}

			if ( style.fontSize !== undefined && this.fontSizeInput ) {
				this.fontSizeInput.value = style.fontSize;
			}

			if ( style.textStrokeColor !== undefined && this.textStrokeColor ) {
				this.textStrokeColor.value = style.textStrokeColor;
			}

			if ( style.textStrokeWidth !== undefined && this.textStrokeWidth ) {
				this.textStrokeWidth.value = style.textStrokeWidth;
				if ( this.textStrokeValue ) {
					this.textStrokeValue.textContent = style.textStrokeWidth;
				}
			}

			if ( style.textShadow !== undefined && this.textShadowToggle ) {
				this.textShadowToggle.checked = style.textShadow;
				if ( this.textShadowColor ) {
					this.textShadowColor.style.display = style.textShadow ? 'inline-block' : 'none';
				}
			}

			if ( style.textShadowColor !== undefined && this.textShadowColor ) {
				this.textShadowColor.value = style.textShadowColor;
			}
		}

		/**
		 * Show/hide controls based on tool type
		 *
		 * @param {string} toolId Current tool ID
		 */
		updateForTool( toolId ) {
			const isTextTool = toolId === 'text' || toolId === 'textbox';

			if ( this.fontSizeContainer ) {
				this.fontSizeContainer.style.display = isTextTool ? 'flex' : 'none';
			}
			if ( this.textStrokeContainer ) {
				this.textStrokeContainer.style.display = isTextTool ? 'flex' : 'none';
			}
			if ( this.shadowContainer ) {
				this.shadowContainer.style.display = isTextTool ? 'flex' : 'none';
			}
		}

		/**
		 * Show/hide controls based on selected layer types
		 * Used by context-aware toolbar when layers are selected
		 *
		 * @param {boolean} hasPureTextLayer Whether pure text layers are selected
		 * @param {boolean} hasTextBoxLayer Whether textbox layers are selected
		 */
		updateForSelectedTypes( hasPureTextLayer, hasTextBoxLayer ) {
			const hasAnyTextLayer = hasPureTextLayer || hasTextBoxLayer;

			if ( this.fontSizeContainer ) {
				this.fontSizeContainer.style.display = hasAnyTextLayer ? 'flex' : 'none';
			}
			if ( this.textStrokeContainer ) {
				this.textStrokeContainer.style.display = hasAnyTextLayer ? 'flex' : 'none';
			}
			if ( this.shadowContainer ) {
				this.shadowContainer.style.display = hasAnyTextLayer ? 'flex' : 'none';
			}
		}

		/**
		 * Update controls from selected layer properties
		 *
		 * @param {Object} layer Selected layer object
		 */
		updateFromLayer( layer ) {
			if ( !layer ) {
				return;
			}

			if ( layer.fontSize !== undefined && this.fontSizeInput ) {
				this.fontSizeInput.value = layer.fontSize;
			}

			if ( layer.textStrokeColor !== undefined && this.textStrokeColor ) {
				this.textStrokeColor.value = layer.textStrokeColor;
			}

			if ( layer.textStrokeWidth !== undefined && this.textStrokeWidth ) {
				this.textStrokeWidth.value = layer.textStrokeWidth;
				if ( this.textStrokeValue ) {
					this.textStrokeValue.textContent = layer.textStrokeWidth;
				}
			}

			if ( layer.textShadow !== undefined && this.textShadowToggle ) {
				this.textShadowToggle.checked = layer.textShadow;
				if ( this.textShadowColor ) {
					this.textShadowColor.style.display = layer.textShadow ? 'inline-block' : 'none';
				}
			}

			if ( layer.textShadowColor !== undefined && this.textShadowColor ) {
				this.textShadowColor.value = layer.textShadowColor;
			}
		}

		/**
		 * Set up input validation for text effect controls
		 *
		 * @param {Object} validator LayersValidator instance
		 * @param {Array} inputValidators Array to push validators into
		 */
		setupValidation( validator, inputValidators ) {
			if ( !validator || !inputValidators ) {
				return;
			}

			if ( this.fontSizeInput ) {
				inputValidators.push(
					validator.createInputValidator( this.fontSizeInput, 'number', { min: 1, max: 200 } )
				);
			}

			if ( this.textStrokeWidth ) {
				inputValidators.push(
					validator.createInputValidator( this.textStrokeWidth, 'number', { min: 0, max: 10 } )
				);
			}

			if ( this.textStrokeColor ) {
				inputValidators.push(
					validator.createInputValidator( this.textStrokeColor, 'color' )
				);
			}

			if ( this.textShadowColor ) {
				inputValidators.push(
					validator.createInputValidator( this.textShadowColor, 'color' )
				);
			}
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			// Clear DOM references
			this.fontSizeInput = null;
			this.fontSizeContainer = null;
			this.textStrokeColor = null;
			this.textStrokeWidth = null;
			this.textStrokeValue = null;
			this.textStrokeContainer = null;
			this.textShadowToggle = null;
			this.textShadowColor = null;
			this.shadowContainer = null;
		}
	}

	// Register in namespace
	window.Layers = window.Layers || {};
	window.Layers.UI = window.Layers.UI || {};
	window.Layers.UI.TextEffectsControls = TextEffectsControls;

	// Also export for module systems
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = TextEffectsControls;
	}
}() );
