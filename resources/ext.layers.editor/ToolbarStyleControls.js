/**
 * ToolbarStyleControls - Manages style controls UI for Layers Editor Toolbar
 * Handles stroke/fill colors, stroke width, font size, text effects, and arrow styles
 *
 * @module ToolbarStyleControls
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
	 * ToolbarStyleControls class
	 *
	 * @class
	 */
class ToolbarStyleControls {
	/**
	 * @param {Object} config Configuration object
	 * @param {Object} config.toolbar Reference to parent Toolbar instance
	 * @param {Function} config.msg Message lookup function for i18n
	 */
	constructor( config ) {
		this.config = config || {};
		this.toolbar = this.config.toolbar;
		this.msgFn = this.config.msg || function ( key, fallback ) {
			return fallback || key;
		};

		// Initialize EventTracker for memory-safe event listener management
		const EventTracker = getClass( 'Utils.EventTracker', 'EventTracker' );
		this.eventTracker = EventTracker ? new EventTracker() : null;

		// Initialize ColorControlFactory for color UI delegation
		const ColorControlFactory = getClass( 'UI.ColorControlFactory', 'ColorControlFactory' );
		this.colorFactory = ColorControlFactory ? new ColorControlFactory( {
			msg: this.msg.bind( this ),
			addListener: this.addListener.bind( this ),
			registerDialogCleanup: ( fn ) => {
				if ( this.toolbar && typeof this.toolbar.registerDialogCleanup === 'function' ) {
					this.toolbar.registerDialogCleanup( fn );
				}
			}
		} ) : null;

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
		this.strokeControl = null;
		this.fillControl = null;
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
	 * Add event listener to an element with automatic tracking
	 *
	 * @param {Element} element Target element
	 * @param {string} event Event type
	 * @param {Function} handler Event handler
	 * @param {Object} [options] Event listener options
	 */
	addListener( element, event, handler, options ) {
		if ( !element || !event || typeof handler !== 'function' ) {
			return;
		}
		if ( this.eventTracker ) {
			this.eventTracker.add( element, event, handler, options );
		} else {
			// Fallback if EventTracker not available
			element.addEventListener( event, handler, options );
		}
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
	 * Create the style controls group
	 *
	 * @return {HTMLElement} The style group container element
	 */
	create() {
		const styleGroup = document.createElement( 'div' );
		styleGroup.className = 'toolbar-group style-group';
		this.container = styleGroup;

		// Preset dropdown (if PresetDropdown is available)
		this.presetDropdown = this.createPresetDropdown();
		if ( this.presetDropdown ) {
			styleGroup.appendChild( this.presetDropdown.getElement() );
		}

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

		// Notify toolbar of initial style settings to sync with ToolManager
		this.notifyStyleChange();

		return styleGroup;
	}

	/**
	 * Create the main style controls row (stroke color, fill color, stroke width)
	 *
	 * @return {HTMLElement} The row container
	 */
	createMainStyleRow() {
		const row = document.createElement( 'div' );
		row.className = 'style-controls-row';

		// Use ColorControlFactory if available, otherwise fall back to inline creation
		if ( this.colorFactory ) {
			// Stroke color (via factory)
			this.strokeControl = this.colorFactory.createColorControl( {
				type: 'stroke',
				label: this.msg( 'layers-prop-stroke-color', 'Stroke' ),
				initialColor: this.strokeColorValue,
				initialNone: this.strokeColorNone,
				onColorChange: ( color, isNone ) => {
					this.strokeColorNone = isNone;
					if ( !isNone ) {
						this.strokeColorValue = color;
					}
					this.notifyStyleChange();
				}
			} );
			this.strokeColorButton = this.strokeControl.button;
			row.appendChild( this.strokeControl.container );

			// Fill color (via factory)
			this.fillControl = this.colorFactory.createColorControl( {
				type: 'fill',
				label: this.msg( 'layers-prop-fill-color', 'Fill' ),
				initialColor: this.fillColorValue,
				initialNone: this.fillColorNone,
				onColorChange: ( color, isNone ) => {
					this.fillColorNone = isNone;
					if ( !isNone ) {
						this.fillColorValue = color;
					}
					this.notifyStyleChange();
				}
			} );
			this.fillColorButton = this.fillControl.button;
			row.appendChild( this.fillControl.container );
		} else {
			// Fallback: inline creation (for testing environments)
			const strokeItem = this.createColorControlFallback( {
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

			const fillItem = this.createColorControlFallback( {
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
		}

		// Stroke width
		const widthItem = this.createStrokeWidthControl();
		this.strokeWidthInput = widthItem.input;
		row.appendChild( widthItem.container );

		return row;
	}

	/**
	 * Fallback color control creation (when ColorControlFactory not available)
	 *
	 * @param {Object} options Control options
	 * @return {Object} Object with container and button elements
	 */
	createColorControlFallback( options ) {
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

		this.addListener( button, 'click', () => {
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
	}

	/**
	 * Create the stroke width control
	 *
	 * @return {Object} Object with container and input elements
	 */
	createStrokeWidthControl() {
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

		// Input validation and change handling (tracked for cleanup)
		this.addListener( input, 'input', () => {
			this.handleStrokeWidthInput( input );
		} );

		this.addListener( input, 'blur', () => {
			this.handleStrokeWidthBlur( input );
		} );

		return { container: container, input: input };
	}

	/**
	 * Handle stroke width input changes
	 *
	 * @param {HTMLInputElement} input The input element
	 */
	handleStrokeWidthInput( input ) {
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
	}

	/**
	 * Handle stroke width blur event (reset invalid values)
	 *
	 * @param {HTMLInputElement} input The input element
	 */
	handleStrokeWidthBlur( input ) {
		const val = parseInt( input.value, 10 );
		if ( isNaN( val ) || val < 0 || val > 100 ) {
			input.value = String( this.currentStrokeWidth );
			input.classList.remove( 'validation-error' );
			input.title = this.msg( 'layers-prop-stroke-width', 'Stroke Width' ) + ': ' + this.currentStrokeWidth + 'px';
		}
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
	 * Create the arrow style control
	 *
	 * @return {HTMLElement} The arrow style container
	 */
	createArrowStyleControl() {
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

		this.addListener( select, 'change', () => {
			this.notifyStyleChange();
		} );

		return container;
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
	 * Open the color picker dialog
	 *
	 * @param {HTMLElement} anchorButton The button that triggered the picker
	 * @param {string} initialValue Current color value
	 * @param {Object} options Options including onApply callback
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
			registerCleanup: ( fn ) => {
				if ( this.toolbar && typeof this.toolbar.registerDialogCleanup === 'function' ) {
					this.toolbar.registerDialogCleanup( fn );
				}
			},
			onApply: options.onApply || function () {},
			onCancel: options.onCancel || function () {}
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
	}

	/**
	 * Notify toolbar of style changes
	 */
	notifyStyleChange() {
		if ( this.toolbar && typeof this.toolbar.onStyleChange === 'function' ) {
			this.toolbar.onStyleChange( this.getStyleOptions() );
		}
	}

	/**
	 * Get current style options
	 *
	 * @return {Object} Style options object
	 */
	getStyleOptions() {
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
	}

	/**
	 * Update visibility of tool-specific options
	 *
	 * @param {string} toolId The currently selected tool
	 */
	updateForTool( toolId ) {
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

		// Update preset dropdown for the current tool
		this.setCurrentTool( toolId );
	}

	/**
	 * Set stroke color programmatically
	 *
	 * @param {string} color Color value or 'none'
	 */
	setStrokeColor( color ) {
		if ( color === 'none' || color === 'transparent' ) {
			this.strokeColorNone = true;
		} else {
			this.strokeColorNone = false;
			this.strokeColorValue = color;
		}
		const displayColor = this.strokeColorNone ? 'none' : this.strokeColorValue;
		if ( this.colorFactory && this.strokeControl ) {
			this.colorFactory.updateColorButtonDisplay( this.strokeControl.button, displayColor );
		} else if ( this.strokeColorButton ) {
			this.updateColorButtonDisplay( this.strokeColorButton, displayColor );
		}
	}

	/**
	 * Set fill color programmatically
	 *
	 * @param {string} color Color value or 'none'
	 */
	setFillColor( color ) {
		if ( color === 'none' || color === 'transparent' ) {
			this.fillColorNone = true;
		} else {
			this.fillColorNone = false;
			this.fillColorValue = color;
		}
		const displayColor = this.fillColorNone ? 'none' : this.fillColorValue;
		if ( this.colorFactory && this.fillControl ) {
			this.colorFactory.updateColorButtonDisplay( this.fillControl.button, displayColor );
		} else if ( this.fillColorButton ) {
			this.updateColorButtonDisplay( this.fillColorButton, displayColor );
		}
	}

	/**
	 * Set stroke width programmatically
	 *
	 * @param {number} width Stroke width in pixels
	 */
	setStrokeWidth( width ) {
		this.currentStrokeWidth = Math.max( 0, Math.min( 100, Math.round( width ) ) );
		if ( this.strokeWidthInput ) {
			this.strokeWidthInput.value = String( this.currentStrokeWidth );
			this.strokeWidthInput.title = this.msg( 'layers-prop-stroke-width', 'Stroke Width' ) + ': ' + this.currentStrokeWidth + 'px';
		}
	}

	/**
	 * Setup input validation (integrates with LayersValidator)
	 *
	 * @param {Object} validator LayersValidator instance
	 */
	setupValidation( validator ) {
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
	}

	/**
	 * Create the preset dropdown component
	 *
	 * @return {PresetDropdown|null} The preset dropdown or null if not available
	 */
	createPresetDropdown() {
		const PresetManager = getClass( 'PresetManager', 'PresetManager' );
		const PresetDropdown = getClass( 'PresetDropdown', 'PresetDropdown' );

		// Check if PresetManager and PresetDropdown are available
		if ( !PresetManager || !PresetDropdown ) {
			return null;
		}

		// Create a shared preset manager instance
		if ( !this.presetManager ) {
			this.presetManager = new PresetManager();
		}

		// Store reference to selected layers for preset operations
		this.selectedLayers = [];

		// Create the dropdown
		const dropdown = new PresetDropdown( {
			presetManager: this.presetManager,
			getMessage: this.msg.bind( this ),
			onSelect: ( style ) => {
				this.applyPresetToSelection( style );
			},
			onSave: ( callback ) => {
				const currentStyle = this.getStyleFromSelection();
				callback( currentStyle );
			}
		} );

		return dropdown;
	}

	/**
	 * Apply a preset style to the current controls
	 *
	 * @param {Object} style Style properties from the preset
	 */
	applyPresetStyle( style ) {
		if ( !style ) {
			return;
		}

		// Apply stroke color
		if ( style.stroke !== undefined ) {
			this.strokeColorValue = style.stroke;
			this.strokeColorNone = ( style.stroke === 'none' || style.stroke === 'transparent' );
			if ( this.strokeColorButton && this.toolbar ) {
				this.toolbar.updateColorButtonDisplay(
					this.strokeColorButton,
					this.strokeColorNone ? 'none' : this.strokeColorValue,
					this.msg( 'layers-transparent', 'Transparent' )
				);
			}
		}

		// Apply fill color
		if ( style.fill !== undefined ) {
			this.fillColorValue = style.fill;
			this.fillColorNone = ( style.fill === 'none' || style.fill === 'transparent' );
			if ( this.fillColorButton && this.toolbar ) {
				this.toolbar.updateColorButtonDisplay(
					this.fillColorButton,
					this.fillColorNone ? 'none' : this.fillColorValue,
					this.msg( 'layers-transparent', 'Transparent' )
				);
			}
		}

		// Apply stroke width
		if ( style.strokeWidth !== undefined && this.strokeWidthInput ) {
			this.currentStrokeWidth = style.strokeWidth;
			this.strokeWidthInput.value = style.strokeWidth;
		}

		// Apply font size
		if ( style.fontSize !== undefined && this.fontSizeInput ) {
			this.fontSizeInput.value = style.fontSize;
		}

		// Apply arrow style
		if ( style.arrowStyle !== undefined && this.arrowStyleSelect ) {
			this.arrowStyleSelect.value = style.arrowStyle;
		}

		// Notify of style change
		this.notifyStyleChange();
	}

	/**
	 * Get the current style from all controls
	 *
	 * @return {Object} Current style properties
	 */
	getCurrentStyle() {
		const style = {};

		// Stroke
		style.stroke = this.strokeColorNone ? 'transparent' : this.strokeColorValue;
		style.strokeWidth = this.currentStrokeWidth;

		// Fill
		style.fill = this.fillColorNone ? 'transparent' : this.fillColorValue;

		// Font size
		if ( this.fontSizeInput ) {
			style.fontSize = parseFloat( this.fontSizeInput.value ) || 16;
		}

		// Arrow style
		if ( this.arrowStyleSelect ) {
			style.arrowStyle = this.arrowStyleSelect.value;
		}

		return style;
	}

	/**
	 * Update preset dropdown when tool changes
	 *
	 * @param {string} tool Current tool name
	 */
	setCurrentTool( tool ) {
		// Only update for tool if no layers are selected
		// Layer selection takes precedence over tool selection
		if ( this.presetDropdown && ( !this.selectedLayers || this.selectedLayers.length === 0 ) ) {
			this.presetDropdown.setTool( tool );
		}
	}

	/**
	 * Update preset dropdown when layer selection changes
	 *
	 * @param {Array} selectedLayers Array of selected layer objects
	 */
	updateForSelection( selectedLayers ) {
		this.selectedLayers = selectedLayers || [];

		if ( !this.presetDropdown ) {
			return;
		}

		if ( this.selectedLayers.length === 0 ) {
			// No selection - clear layer type, fall back to tool
			this.presetDropdown.setLayerType( null );
			if ( this.toolbar && this.toolbar.currentTool ) {
				this.presetDropdown.setTool( this.toolbar.currentTool );
			}
			return;
		}

		// Get the type of the first selected layer
		const firstLayer = this.selectedLayers[ 0 ];
		const layerType = firstLayer.type;

		// Map layer types to tool types for preset lookup
		const typeMapping = {
			'rect': 'rectangle',
			'ellipse': 'ellipse',
			'circle': 'circle',
			'line': 'line',
			'arrow': 'arrow',
			'text': 'text',
			'textbox': 'textbox',
			'polygon': 'polygon',
			'star': 'star',
			'path': 'path',
			'rectangle': 'rectangle'
		};

		const toolType = typeMapping[ layerType ] || layerType;
		// Use setLayerType which takes precedence over tool
		this.presetDropdown.setLayerType( toolType );
	}

	/**
	 * All style properties that can be applied from presets.
	 * This list matches PresetManager.extractStyleFromLayer() and sanitizeStyle().
	 *
	 * @type {string[]}
	 */
	static get PRESET_STYLE_PROPERTIES() {
		return [
			// Stroke
			'stroke', 'strokeWidth', 'strokeOpacity',
			// Fill
			'fill', 'fillOpacity',
			// Text
			'color', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
			'textAlign', 'verticalAlign', 'lineHeight', 'padding',
			// Text stroke
			'textStrokeColor', 'textStrokeWidth',
			// Shape
			'cornerRadius',
			// Arrow
			'arrowStyle', 'arrowhead', 'arrowSize', 'arrowHeadType', 'headScale', 'tailWidth',
			// Polygon/Star
			'sides', 'points', 'innerRadius', 'outerRadius', 'pointRadius', 'valleyRadius',
			// Shadow
			'shadow', 'shadowColor', 'shadowBlur',
			'shadowOffsetX', 'shadowOffsetY', 'shadowSpread',
			// Text shadow
			'textShadow', 'textShadowColor', 'textShadowBlur',
			'textShadowOffsetX', 'textShadowOffsetY',
			// Glow
			'glow',
			// Blend mode
			'blendMode',
			// Opacity
			'opacity'
		];
	}

	/**
	 * Apply a preset style to selected layers
	 *
	 * @param {Object} style Style properties from the preset
	 */
	applyPresetToSelection( style ) {
		if ( !style ) {
			return;
		}

		// If we have selected layers, apply to them via the editor
		if ( this.selectedLayers && this.selectedLayers.length > 0 && this.toolbar && this.toolbar.editor ) {
			this.toolbar.editor.applyToSelection( ( layer ) => {
				// Apply all style properties from the preset
				ToolbarStyleControls.PRESET_STYLE_PROPERTIES.forEach( ( prop ) => {
					if ( style[ prop ] !== undefined ) {
						layer[ prop ] = style[ prop ];
					}
				} );
			} );
		}

		// Also update the toolbar controls for future drawings
		this.applyPresetStyle( style );
	}

	/**
	 * Get style from the first selected layer for saving as preset
	 *
	 * @return {Object} Style properties from selected layer, or current controls
	 */
	getStyleFromSelection() {
		if ( this.selectedLayers && this.selectedLayers.length > 0 ) {
			const layer = this.selectedLayers[ 0 ];
			const style = {};

			// Extract all style properties from the layer
			ToolbarStyleControls.PRESET_STYLE_PROPERTIES.forEach( ( prop ) => {
				if ( layer[ prop ] !== undefined ) {
					style[ prop ] = layer[ prop ];
				}
			} );

			return style;
		}

		// Fallback to current toolbar controls
		return this.getCurrentStyle();
	}

	/**
	 * Destroy and cleanup
	 */
	destroy() {
		// Clean up preset dropdown
		if ( this.presetDropdown ) {
			this.presetDropdown.destroy();
			this.presetDropdown = null;
		}

		// Clean up preset manager
		if ( this.presetManager ) {
			this.presetManager.destroy();
			this.presetManager = null;
		}

		// Clean up all event listeners via EventTracker
		if ( this.eventTracker ) {
			this.eventTracker.destroy();
			this.eventTracker = null;
		}

		// Clear input validators
		this.inputValidators = [];

		// Clear DOM references
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
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.ToolbarStyleControls = ToolbarStyleControls;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ToolbarStyleControls;
	}

}() );
