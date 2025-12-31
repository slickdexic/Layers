/**
 * ColorControlFactory - Creates and manages color picker controls for the toolbar
 *
 * Extracted from ToolbarStyleControls.js to reduce god class size.
 * Handles color button creation, display updates, and color picker integration.
 *
 * @module ColorControlFactory
 */
( function () {
	'use strict';

	// Helper to resolve classes from namespace with global fallback
	const getClass = window.layersGetClass || function ( namespacePath, globalName ) {
		if ( window.Layers ) {
			const parts = namespacePath.split( '.' );
			let obj = window.Layers;
			for ( const part of parts ) {
				if ( obj && obj[ part ] ) {
					obj = obj[ part ];
				} else {
					break;
				}
			}
			if ( typeof obj === 'function' ) {
				return obj;
			}
		}
		return window[ globalName ];
	};

	/**
	 * ColorControlFactory class
	 *
	 * @class
	 */
	class ColorControlFactory {
		/**
		 * @param {Object} config Configuration object
		 * @param {Function} config.msg Message lookup function for i18n
		 * @param {Function} config.addListener Function to add tracked event listeners
		 * @param {Function} config.registerDialogCleanup Function to register cleanup callbacks
		 */
		constructor( config ) {
			this.config = config || {};
			this.msgFn = this.config.msg || function ( key, fallback ) {
				return fallback || key;
			};
			this.addListenerFn = this.config.addListener || function ( el, evt, handler ) {
				el.addEventListener( evt, handler );
			};
			this.registerDialogCleanupFn = this.config.registerDialogCleanup || function () {};
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
		 * Get color picker strings for i18n
		 *
		 * @return {Object} Color picker string map
		 */
		getColorPickerStrings() {
			return {
				title: this.msg( 'layers-color-picker-title', 'Choose color' ),
				standard: this.msg( 'layers-color-picker-standard', 'Standard colors' ),
				saved: this.msg( 'layers-color-picker-saved', 'Saved colors' ),
				customSection: this.msg( 'layers-color-picker-custom-section', 'Custom color' ),
				none: this.msg( 'layers-color-picker-none', 'No fill (transparent)' ),
				emptySlot: this.msg( 'layers-color-picker-empty-slot', 'Empty slot - colors will be saved here automatically' ),
				cancel: this.msg( 'layers-color-picker-cancel', 'Cancel' ),
				apply: this.msg( 'layers-color-picker-apply', 'Apply' ),
				transparent: this.msg( 'layers-color-picker-transparent', 'Transparent' ),
				swatchTemplate: this.msg( 'layers-color-picker-color-swatch', 'Set color to $1' ),
				previewTemplate: this.msg( 'layers-color-picker-color-preview', 'Current color: $1' )
			};
		}

		/**
		 * Create a color control item (stroke or fill)
		 *
		 * @param {Object} options Control options
		 * @param {string} options.type 'stroke' or 'fill'
		 * @param {string} options.label Label text
		 * @param {string} options.initialColor Initial color value
		 * @param {boolean} options.initialNone Whether initial state is "none"
		 * @param {Function} options.onColorChange Callback when color changes (color, isNone)
		 * @param {Function} [options.onColorPreview] Callback for live preview (color, isNone)
		 * @return {Object} Object with container, button, and state methods
		 */
		createColorControl( options ) {
			const container = document.createElement( 'div' );
			container.className = 'style-control-item';

			const label = document.createElement( 'span' );
			label.className = 'style-control-label';
			label.textContent = options.label;
			container.appendChild( label );

			const button = document.createElement( 'button' );
			button.type = 'button';
			button.className = 'color-display-button ' + options.type + '-color';
			button.setAttribute( 'aria-label', options.label );
			button.setAttribute( 'aria-haspopup', 'dialog' );
			button.setAttribute( 'aria-expanded', 'false' );
			this.updateColorButtonDisplay( button, options.initialNone ? 'none' : options.initialColor );
			container.appendChild( button );

			// State
			let colorValue = options.initialColor || '#000000';
			let isNone = options.initialNone || false;

			// Click handler - opens color picker dialog
			this.addListenerFn( button, 'click', () => {
				this.openColorPicker( button, isNone ? 'none' : colorValue, {
					onApply: ( chosen ) => {
						const none = chosen === 'none';
						isNone = none;
						if ( !none ) {
							colorValue = chosen;
						}
						options.onColorChange( colorValue, isNone );
						this.updateColorButtonDisplay( button, none ? 'none' : colorValue );
					},
					onPreview: options.onColorPreview ? ( previewColor ) => {
						const none = previewColor === 'none';
						options.onColorPreview( none ? colorValue : previewColor, none );
					} : null,
					onCancel: () => {
						// Button display is already correct (not updated during preview)
						// The canvas will be restored by ColorPickerDialog.restoreOriginalColor
					}
				} );
			} );

			return {
				container: container,
				button: button,
				getColor: () => colorValue,
				isNone: () => isNone,
				setColor: ( color, none ) => {
					isNone = none;
					if ( !none ) {
						colorValue = color;
					}
					this.updateColorButtonDisplay( button, none ? 'none' : colorValue );
				}
			};
		}

		/**
		 * Open the color picker dialog
		 *
		 * @param {HTMLElement} anchorButton The button that triggered the picker
		 * @param {string} initialValue Current color value
		 * @param {Object} options Options including onApply, onPreview, and onCancel callbacks
		 */
		openColorPicker( anchorButton, initialValue, options ) {
			options = options || {};

			const ColorPickerDialog = getClass( 'UI.ColorPickerDialog', 'ColorPickerDialog' );
			if ( !ColorPickerDialog ) {
				return;
			}

			const picker = new ColorPickerDialog( {
				currentColor: initialValue === 'none' ? 'none' : ( initialValue || '#000000' ),
				anchorElement: anchorButton,
				strings: this.getColorPickerStrings(),
				registerCleanup: this.registerDialogCleanupFn,
				onApply: options.onApply || function () {},
				onCancel: options.onCancel || function () {},
				onPreview: options.onPreview || null
			} );

			picker.open();
		}

		/**
		 * Update a color button's display
		 *
		 * @param {HTMLElement} btn The button element
		 * @param {string} color The color value or 'none'
		 */
		updateColorButtonDisplay( btn, color ) {
			const strings = this.getColorPickerStrings();
			const ColorPickerDialog = getClass( 'UI.ColorPickerDialog', 'ColorPickerDialog' );

			if ( ColorPickerDialog && ColorPickerDialog.updateColorButton ) {
				ColorPickerDialog.updateColorButton( btn, color, strings );
			} else {
				// Fallback implementation
				let labelValue = color;
				if ( !color || color === 'none' || color === 'transparent' ) {
					btn.classList.add( 'is-transparent' );
					btn.title = strings.transparent;
					btn.style.background = '';
					labelValue = strings.transparent;
				} else {
					btn.classList.remove( 'is-transparent' );
					btn.style.background = color;
					btn.title = color;
				}
				btn.setAttribute( 'aria-label', strings.previewTemplate.replace( '$1', labelValue ) );
			}
		}

		/**
		 * Create a simple color input (type="color")
		 *
		 * @param {Object} options Control options
		 * @param {string} options.className CSS class name
		 * @param {string} options.initialColor Initial color value
		 * @param {string} options.title Tooltip text
		 * @param {Function} options.onChange Callback when color changes
		 * @return {HTMLInputElement} The color input element
		 */
		createSimpleColorInput( options ) {
			const input = document.createElement( 'input' );
			input.type = 'color';
			input.value = options.initialColor || '#000000';
			input.className = options.className || '';
			input.title = options.title || '';

			if ( options.onChange ) {
				this.addListenerFn( input, 'change', () => {
					options.onChange( input.value );
				} );
			}

			return input;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.ColorControlFactory = ColorControlFactory;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ColorControlFactory;
	}

}() );
