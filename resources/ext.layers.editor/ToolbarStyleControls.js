/**
 * ToolbarStyleControls - Manages style controls UI for Layers Editor Toolbar
 * Handles stroke/fill colors, stroke width, font size, text effects, and arrow styles
 *
 * @module ToolbarStyleControls
 */
( function () {
	'use strict';

	/**
	 * ToolbarStyleControls class
	 *
	 * @class
	 * @param {Object} config Configuration object
	 * @param {Object} config.toolbar Reference to parent Toolbar instance
	 * @param {Function} config.msg Message lookup function for i18n
	 */
	function ToolbarStyleControls( config ) {
		this.config = config || {};
		this.toolbar = this.config.toolbar;
		this.msgFn = this.config.msg || function ( key, fallback ) {
			return fallback || key;
		};

		// Style state
		this.strokeColorValue = '#000000';
		this.fillColorValue = '#ffffff';
		this.strokeColorNone = false;
		this.fillColorNone = false;
		this.currentStrokeWidth = 2.0;

		// DOM references (populated during create)
		this.container = null;
		this.strokeColorButton = null;
		this.fillColorButton = null;
		this.strokeWidthInput = null;
		this.fontSizeInput = null;
		this.fontSizeContainer = null;
		this.strokeContainer = null;
		this.shadowContainer = null;
		this.arrowContainer = null;
		this.textStrokeColor = null;
		this.textStrokeWidth = null;
		this.textStrokeValue = null;
		this.textShadowToggle = null;
		this.textShadowColor = null;
		this.arrowStyleSelect = null;

		// Input validators
		this.inputValidators = [];
	}

	/**
	 * Get localized message
	 *
	 * @param {string} key Message key
	 * @param {string} fallback Fallback text
	 * @return {string} Localized message
	 */
	ToolbarStyleControls.prototype.msg = function ( key, fallback ) {
		return this.msgFn( key, fallback );
	};

	/**
	 * Create the style controls group
	 *
	 * @return {HTMLElement} The style group container element
	 */
	ToolbarStyleControls.prototype.create = function () {
		const styleGroup = document.createElement( 'div' );
		styleGroup.className = 'toolbar-group style-group';
		this.container = styleGroup;

		// Main style controls row (stroke, fill, width)
		const styleControlsRow = this.createMainStyleRow();
		styleGroup.appendChild( styleControlsRow );

		// Font size container (for text tool)
		this.fontSizeContainer = this.createFontSizeControl();
		styleGroup.appendChild( this.fontSizeContainer );

		// Text stroke options
		this.strokeContainer = this.createTextStrokeControl();
		styleGroup.appendChild( this.strokeContainer );

		// Drop shadow options
		this.shadowContainer = this.createShadowControl();
		styleGroup.appendChild( this.shadowContainer );

		// Arrow style options
		this.arrowContainer = this.createArrowStyleControl();
		styleGroup.appendChild( this.arrowContainer );

		return styleGroup;
	};

	/**
	 * Create the main style controls row (stroke color, fill color, stroke width)
	 *
	 * @return {HTMLElement} The row container
	 */
	ToolbarStyleControls.prototype.createMainStyleRow = function () {
		const row = document.createElement( 'div' );
		row.className = 'style-controls-row';

		// Stroke color
		const strokeItem = this.createColorControl( {
			type: 'stroke',
			label: this.msg( 'layers-prop-stroke-color', 'Stroke' ),
			initialColor: this.strokeColorValue,
			onColorChange: ( color, isNone ) => {
				this.strokeColorNone = isNone;
				if ( !isNone ) {
					this.strokeColorValue = color;
				}
				this.notifyStyleChange();
			}
		} );
		this.strokeColorButton = strokeItem.button;
		row.appendChild( strokeItem.container );

		// Fill color
		const fillItem = this.createColorControl( {
			type: 'fill',
			label: this.msg( 'layers-prop-fill-color', 'Fill' ),
			initialColor: this.fillColorValue,
			onColorChange: ( color, isNone ) => {
				this.fillColorNone = isNone;
				if ( !isNone ) {
					this.fillColorValue = color;
				}
				this.notifyStyleChange();
			}
		} );
		this.fillColorButton = fillItem.button;
		row.appendChild( fillItem.container );

		// Stroke width
		const widthItem = this.createStrokeWidthControl();
		this.strokeWidthInput = widthItem.input;
		row.appendChild( widthItem.container );

		return row;
	};

	/**
	 * Create a color control item (stroke or fill)
	 *
	 * @param {Object} options Control options
	 * @param {string} options.type 'stroke' or 'fill'
	 * @param {string} options.label Label text
	 * @param {string} options.initialColor Initial color value
	 * @param {Function} options.onColorChange Callback when color changes
	 * @return {Object} Object with container and button elements
	 */
	ToolbarStyleControls.prototype.createColorControl = function ( options ) {
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
		this.updateColorButtonDisplay( button, options.initialColor );
		container.appendChild( button );

		// Click handler - opens color picker dialog
		button.addEventListener( 'click', () => {
			const isNone = options.type === 'stroke' ? this.strokeColorNone : this.fillColorNone;
			const currentValue = options.type === 'stroke' ? this.strokeColorValue : this.fillColorValue;

			this.openColorPicker( button, isNone ? 'none' : currentValue, {
				onApply: ( chosen ) => {
					const none = chosen === 'none';
					options.onColorChange( chosen, none );
					this.updateColorButtonDisplay( button, none ? 'none' : chosen );
				}
			} );
		} );

		return { container: container, button: button };
	};

	/**
	 * Create the stroke width control
	 *
	 * @return {Object} Object with container and input elements
	 */
	ToolbarStyleControls.prototype.createStrokeWidthControl = function () {
		const container = document.createElement( 'div' );
		container.className = 'style-control-item';

		const label = document.createElement( 'span' );
		label.className = 'style-control-label';
		label.textContent = this.msg( 'layers-prop-stroke-width', 'Width' );
		container.appendChild( label );

		const input = document.createElement( 'input' );
		input.type = 'number';
		input.min = '0';
		input.max = '100';
		input.step = '1';
		input.value = String( this.currentStrokeWidth );
		input.className = 'stroke-width-input';
		input.title = this.msg( 'layers-prop-stroke-width', 'Stroke Width' ) + ': ' + this.currentStrokeWidth + 'px';
		input.placeholder = 'px';
		container.appendChild( input );

		// Input validation and change handling
		input.addEventListener( 'input', () => {
			this.handleStrokeWidthInput( input );
		} );

		input.addEventListener( 'blur', () => {
			this.handleStrokeWidthBlur( input );
		} );

		return { container: container, input: input };
	};

	/**
	 * Handle stroke width input changes
	 *
	 * @param {HTMLInputElement} input The input element
	 */
	ToolbarStyleControls.prototype.handleStrokeWidthInput = function ( input ) {
		let val = parseInt( input.value, 10 );
		const isValid = !isNaN( val ) && val >= 0 && val <= 100;

		if ( isValid ) {
			val = Math.round( val );
			this.currentStrokeWidth = val;
			input.title = this.msg( 'layers-prop-stroke-width', 'Stroke Width' ) + ': ' + val + 'px';
			input.classList.remove( 'validation-error' );
			this.notifyStyleChange();
		} else {
			input.classList.add( 'validation-error' );
			if ( isNaN( val ) ) {
				input.title = 'Please enter a valid number between 0 and 100';
			} else if ( val < 0 ) {
				input.title = 'Minimum stroke width: 0px';
			} else if ( val > 100 ) {
				input.title = 'Maximum stroke width: 100px';
			}
		}
	};

	/**
	 * Handle stroke width blur event (reset invalid values)
	 *
	 * @param {HTMLInputElement} input The input element
	 */
	ToolbarStyleControls.prototype.handleStrokeWidthBlur = function ( input ) {
		const val = parseInt( input.value, 10 );
		if ( isNaN( val ) || val < 0 || val > 100 ) {
			input.value = String( this.currentStrokeWidth );
			input.classList.remove( 'validation-error' );
			input.title = this.msg( 'layers-prop-stroke-width', 'Stroke Width' ) + ': ' + this.currentStrokeWidth + 'px';
		}
	};

	/**
	 * Create the font size control (for text tool)
	 *
	 * @return {HTMLElement} The font size container
	 */
	ToolbarStyleControls.prototype.createFontSizeControl = function () {
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

		input.addEventListener( 'change', () => {
			this.notifyStyleChange();
		} );

		return container;
	};

	/**
	 * Create the text stroke control
	 *
	 * @return {HTMLElement} The text stroke container
	 */
	ToolbarStyleControls.prototype.createTextStrokeControl = function () {
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

		// Event handlers
		colorInput.addEventListener( 'change', () => {
			this.notifyStyleChange();
		} );

		widthInput.addEventListener( 'input', () => {
			widthValue.textContent = widthInput.value;
			this.notifyStyleChange();
		} );

		return container;
	};

	/**
	 * Create the shadow control
	 *
	 * @return {HTMLElement} The shadow container
	 */
	ToolbarStyleControls.prototype.createShadowControl = function () {
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

		// Event handlers
		toggle.addEventListener( 'change', () => {
			colorInput.style.display = toggle.checked ? 'inline-block' : 'none';
			this.notifyStyleChange();
		} );

		colorInput.addEventListener( 'change', () => {
			this.notifyStyleChange();
		} );

		return container;
	};

	/**
	 * Create the arrow style control
	 *
	 * @return {HTMLElement} The arrow style container
	 */
	ToolbarStyleControls.prototype.createArrowStyleControl = function () {
		const container = document.createElement( 'div' );
		container.className = 'arrow-style-container';
		container.style.display = 'none';

		const label = document.createElement( 'label' );
		label.textContent = this.msg( 'layers-tool-arrow', 'Arrow' ) + ':';
		label.className = 'arrow-label';
		container.appendChild( label );

		const select = document.createElement( 'select' );
		select.className = 'arrow-style-select';

		const optSingle = document.createElement( 'option' );
		optSingle.value = 'single';
		optSingle.textContent = this.msg( 'layers-arrow-single', 'Single →' );
		select.appendChild( optSingle );

		const optDouble = document.createElement( 'option' );
		optDouble.value = 'double';
		optDouble.textContent = this.msg( 'layers-arrow-double', 'Double ↔' );
		select.appendChild( optDouble );

		const optNone = document.createElement( 'option' );
		optNone.value = 'none';
		optNone.textContent = this.msg( 'layers-arrow-none', 'Line only' );
		select.appendChild( optNone );

		container.appendChild( select );
		this.arrowStyleSelect = select;

		select.addEventListener( 'change', () => {
			this.notifyStyleChange();
		} );

		return container;
	};

	/**
	 * Get color picker strings for i18n
	 *
	 * @return {Object} Color picker string map
	 */
	ToolbarStyleControls.prototype.getColorPickerStrings = function () {
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
	};

	/**
	 * Open the color picker dialog
	 *
	 * @param {HTMLElement} anchorButton The button that triggered the picker
	 * @param {string} initialValue Current color value
	 * @param {Object} options Options including onApply callback
	 */
	ToolbarStyleControls.prototype.openColorPicker = function ( anchorButton, initialValue, options ) {
		options = options || {};

		if ( !window.ColorPickerDialog ) {
			return;
		}

		const picker = new window.ColorPickerDialog( {
			currentColor: initialValue === 'none' ? 'none' : ( initialValue || '#000000' ),
			anchorElement: anchorButton,
			strings: this.getColorPickerStrings(),
			registerCleanup: ( fn ) => {
				if ( this.toolbar && typeof this.toolbar.registerDialogCleanup === 'function' ) {
					this.toolbar.registerDialogCleanup( fn );
				}
			},
			onApply: options.onApply || function () {},
			onCancel: options.onCancel || function () {}
		} );

		picker.open();
	};

	/**
	 * Update a color button's display
	 *
	 * @param {HTMLElement} btn The button element
	 * @param {string} color The color value or 'none'
	 */
	ToolbarStyleControls.prototype.updateColorButtonDisplay = function ( btn, color ) {
		const strings = this.getColorPickerStrings();

		if ( window.ColorPickerDialog && window.ColorPickerDialog.updateColorButton ) {
			window.ColorPickerDialog.updateColorButton( btn, color, strings );
		} else {
			// Fallback
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
	};

	/**
	 * Notify toolbar of style changes
	 */
	ToolbarStyleControls.prototype.notifyStyleChange = function () {
		if ( this.toolbar && typeof this.toolbar.onStyleChange === 'function' ) {
			this.toolbar.onStyleChange( this.getStyleOptions() );
		}
	};

	/**
	 * Get current style options
	 *
	 * @return {Object} Style options object
	 */
	ToolbarStyleControls.prototype.getStyleOptions = function () {
		return {
			color: this.strokeColorNone ? 'transparent' : this.strokeColorValue,
			fill: this.fillColorNone ? 'transparent' : this.fillColorValue,
			strokeWidth: this.currentStrokeWidth,
			fontSize: this.fontSizeInput ? parseInt( this.fontSizeInput.value, 10 ) : 16,
			textStrokeColor: this.textStrokeColor ? this.textStrokeColor.value : '#000000',
			textStrokeWidth: this.textStrokeWidth ? parseInt( this.textStrokeWidth.value, 10 ) : 0,
			textShadow: this.textShadowToggle ? this.textShadowToggle.checked : false,
			textShadowColor: this.textShadowColor ? this.textShadowColor.value : '#000000',
			arrowStyle: this.arrowStyleSelect ? this.arrowStyleSelect.value : 'single',
			shadow: this.textShadowToggle ? this.textShadowToggle.checked : false,
			shadowColor: this.textShadowColor ? this.textShadowColor.value : '#000000',
			shadowBlur: 8,
			shadowOffsetX: 2,
			shadowOffsetY: 2
		};
	};

	/**
	 * Update visibility of tool-specific options
	 *
	 * @param {string} toolId The currently selected tool
	 */
	ToolbarStyleControls.prototype.updateForTool = function ( toolId ) {
		if ( toolId === 'text' ) {
			this.fontSizeContainer.style.display = 'block';
			this.strokeContainer.style.display = 'block';
			this.shadowContainer.style.display = 'block';
			this.arrowContainer.style.display = 'none';
		} else if ( toolId === 'arrow' ) {
			this.fontSizeContainer.style.display = 'none';
			this.strokeContainer.style.display = 'none';
			this.shadowContainer.style.display = 'none';
			this.arrowContainer.style.display = 'block';
		} else {
			this.fontSizeContainer.style.display = 'none';
			this.strokeContainer.style.display = 'none';
			this.shadowContainer.style.display = 'none';
			this.arrowContainer.style.display = 'none';
		}
	};

	/**
	 * Set stroke color programmatically
	 *
	 * @param {string} color Color value or 'none'
	 */
	ToolbarStyleControls.prototype.setStrokeColor = function ( color ) {
		if ( color === 'none' || color === 'transparent' ) {
			this.strokeColorNone = true;
		} else {
			this.strokeColorNone = false;
			this.strokeColorValue = color;
		}
		if ( this.strokeColorButton ) {
			this.updateColorButtonDisplay( this.strokeColorButton, this.strokeColorNone ? 'none' : this.strokeColorValue );
		}
	};

	/**
	 * Set fill color programmatically
	 *
	 * @param {string} color Color value or 'none'
	 */
	ToolbarStyleControls.prototype.setFillColor = function ( color ) {
		if ( color === 'none' || color === 'transparent' ) {
			this.fillColorNone = true;
		} else {
			this.fillColorNone = false;
			this.fillColorValue = color;
		}
		if ( this.fillColorButton ) {
			this.updateColorButtonDisplay( this.fillColorButton, this.fillColorNone ? 'none' : this.fillColorValue );
		}
	};

	/**
	 * Set stroke width programmatically
	 *
	 * @param {number} width Stroke width in pixels
	 */
	ToolbarStyleControls.prototype.setStrokeWidth = function ( width ) {
		this.currentStrokeWidth = Math.max( 0, Math.min( 100, Math.round( width ) ) );
		if ( this.strokeWidthInput ) {
			this.strokeWidthInput.value = String( this.currentStrokeWidth );
			this.strokeWidthInput.title = this.msg( 'layers-prop-stroke-width', 'Stroke Width' ) + ': ' + this.currentStrokeWidth + 'px';
		}
	};

	/**
	 * Setup input validation (integrates with LayersValidator)
	 *
	 * @param {Object} validator LayersValidator instance
	 */
	ToolbarStyleControls.prototype.setupValidation = function ( validator ) {
		if ( !validator ) {
			return;
		}

		if ( this.fontSizeInput ) {
			this.inputValidators.push(
				validator.createInputValidator( this.fontSizeInput, 'number', { min: 1, max: 200 } )
			);
		}

		if ( this.strokeWidthInput ) {
			this.inputValidators.push(
				validator.createInputValidator( this.strokeWidthInput, 'number', { min: 0, max: 100 } )
			);
		}

		if ( this.textStrokeWidth ) {
			this.inputValidators.push(
				validator.createInputValidator( this.textStrokeWidth, 'number', { min: 0, max: 10 } )
			);
		}

		if ( this.textStrokeColor ) {
			this.inputValidators.push(
				validator.createInputValidator( this.textStrokeColor, 'color' )
			);
		}

		if ( this.textShadowColor ) {
			this.inputValidators.push(
				validator.createInputValidator( this.textShadowColor, 'color' )
			);
		}
	};

	/**
	 * Destroy and cleanup
	 */
	ToolbarStyleControls.prototype.destroy = function () {
		this.inputValidators = [];
		this.container = null;
		this.strokeColorButton = null;
		this.fillColorButton = null;
		this.strokeWidthInput = null;
		this.fontSizeInput = null;
	};

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.ToolbarStyleControls = ToolbarStyleControls;

		// Backward compatibility - direct window export
		window.ToolbarStyleControls = ToolbarStyleControls;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ToolbarStyleControls;
	}

}() );
