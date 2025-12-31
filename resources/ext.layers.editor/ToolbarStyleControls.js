/**
 * ToolbarStyleControls - Manages style controls UI for Layers Editor Toolbar
 * Handles stroke/fill colors, stroke width, font size, text effects, and arrow styles
 *
 * Delegates to:
 * - ColorControlFactory: Color picker button creation
 * - PresetStyleManager: Style preset dropdown and application
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

		// Initialize PresetStyleManager for preset UI delegation
		const PresetStyleManager = getClass( 'UI.PresetStyleManager', 'PresetStyleManager' );
		this.presetStyleManager = PresetStyleManager ? new PresetStyleManager( {
			toolbar: this.toolbar,
			msg: this.msg.bind( this ),
			getStyleOptions: () => this.getCurrentStyle(),
			applyStyle: ( style ) => this.applyPresetStyleInternal( style )
		} ) : null;

		// Initialize TextEffectsControls for text-specific UI delegation
		const TextEffectsControls = getClass( 'UI.TextEffectsControls', 'TextEffectsControls' );
		this.textEffectsControls = TextEffectsControls ? new TextEffectsControls( {
			msg: this.msg.bind( this ),
			addListener: this.addListener.bind( this ),
			notifyStyleChange: this.notifyStyleChange.bind( this )
		} ) : null;

		// Initialize ArrowStyleControl for arrow-specific UI delegation
		const ArrowStyleControl = getClass( 'UI.ArrowStyleControl', 'ArrowStyleControl' );
		this.arrowStyleControl = ArrowStyleControl ? new ArrowStyleControl( {
			msg: this.msg.bind( this ),
			addListener: this.addListener.bind( this ),
			notifyStyleChange: this.notifyStyleChange.bind( this )
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
		this.strokeContainer = null;
		this.arrowContainer = null;
		this.arrowStyleSelect = null;
		this.mainStyleRow = null;
		this.presetContainer = null;

		// Context-aware toolbar state
		this.contextAwareEnabled = ( typeof mw !== 'undefined' && mw.config ) ?
			mw.config.get( 'wgLayersContextAwareToolbar', true ) : true;
		this.currentToolContext = 'pointer';

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

		// Add context-aware class if enabled
		if ( this.contextAwareEnabled ) {
			styleGroup.classList.add( 'context-aware' );
		}

		// Preset dropdown (via PresetStyleManager delegation)
		if ( this.presetStyleManager ) {
			const dropdown = this.presetStyleManager.createPresetDropdown();
			if ( dropdown ) {
				this.presetContainer = this.presetStyleManager.getElement();
				styleGroup.appendChild( this.presetContainer );
			}
		}

		// Main style controls row (stroke, fill, width)
		this.mainStyleRow = this.createMainStyleRow();
		styleGroup.appendChild( this.mainStyleRow );

		// Text effects controls (via TextEffectsControls delegation)
		if ( this.textEffectsControls ) {
			// Font size container (for text tool)
			styleGroup.appendChild( this.textEffectsControls.createFontSizeControl() );

			// Text stroke options
			styleGroup.appendChild( this.textEffectsControls.createTextStrokeControl() );

			// Drop shadow options
			styleGroup.appendChild( this.textEffectsControls.createShadowControl() );
		}

		// Arrow style options (via ArrowStyleControl delegation)
		this.arrowContainer = this.arrowStyleControl.create();
		// Expose internal select for backward compatibility with existing code
		this.arrowStyleSelect = this.arrowStyleControl.arrowStyleSelect;
		styleGroup.appendChild( this.arrowContainer );

		// Apply initial visibility based on default tool (pointer = hidden)
		if ( this.contextAwareEnabled ) {
			this.updateContextVisibility( 'pointer' );
		}

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
				},
				onColorPreview: ( color, isNone ) => {
					this.applyColorPreview( 'stroke', isNone ? 'transparent' : color );
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
				},
				onColorPreview: ( color, isNone ) => {
					this.applyColorPreview( 'fill', isNone ? 'transparent' : color );
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
	 * Apply color preview to selected layers without committing to history.
	 * Used for live preview in color picker dialog.
	 *
	 * @param {string} colorType 'stroke' or 'fill'
	 * @param {string} color The preview color value
	 */
	applyColorPreview( colorType, color ) {
		if ( !this.toolbar || !this.toolbar.editor ) {
			return;
		}

		const editor = this.toolbar.editor;
		const canvasManager = editor.canvasManager;
		if ( !canvasManager ) {
			return;
		}

		// Get selected layer IDs
		const selectedIds = canvasManager.getSelectedLayerIds ? canvasManager.getSelectedLayerIds() : [];
		if ( !selectedIds || !selectedIds.length ) {
			return;
		}

		// Apply preview color to each selected layer
		for ( const id of selectedIds ) {
			const layer = editor.getLayerById ? editor.getLayerById( id ) : null;
			if ( !layer ) {
				continue;
			}

			if ( colorType === 'stroke' ) {
				// For text layers, stroke color = fill
				if ( layer.type === 'text' ) {
					layer.fill = color;
				} else {
					layer.stroke = color;
				}
			} else if ( colorType === 'fill' ) {
				// Fill applies to shapes (not text, line, arrow)
				if ( layer.type !== 'text' && layer.type !== 'line' && layer.type !== 'arrow' ) {
					layer.fill = color;
				}
			}
		}

		// Re-render to show preview
		if ( canvasManager.renderLayers && editor.layers ) {
			canvasManager.renderLayers( editor.layers );
		}
	}

	/**
	 * Get current style options
	 *
	 * @return {Object} Style options object
	 */
	getStyleOptions() {
		// Get text effects from delegate
		const textEffects = this.textEffectsControls ?
			this.textEffectsControls.getStyleValues() :
			{ fontSize: 16, textStrokeColor: '#000000', textStrokeWidth: 0, textShadow: false, textShadowColor: '#000000' };

		// Get arrow style from delegate or fallback
		const arrowStyle = this.arrowStyleControl ?
			this.arrowStyleControl.getValue() :
			( this.arrowStyleSelect ? this.arrowStyleSelect.value : 'single' );

		return {
			color: this.strokeColorNone ? 'transparent' : this.strokeColorValue,
			fill: this.fillColorNone ? 'transparent' : this.fillColorValue,
			strokeWidth: this.currentStrokeWidth,
			fontSize: textEffects.fontSize,
			textStrokeColor: textEffects.textStrokeColor,
			textStrokeWidth: textEffects.textStrokeWidth,
			textShadow: textEffects.textShadow,
			textShadowColor: textEffects.textShadowColor,
			arrowStyle: arrowStyle,
			shadow: textEffects.textShadow,
			shadowColor: textEffects.textShadowColor,
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
		// Delegate text effects visibility to TextEffectsControls
		if ( this.textEffectsControls ) {
			this.textEffectsControls.updateForTool( toolId );
		}

		// Handle arrow container visibility (delegate or direct)
		if ( this.arrowStyleControl ) {
			this.arrowStyleControl.updateForTool( toolId );
		} else if ( this.arrowContainer ) {
			this.arrowContainer.style.display = toolId === 'arrow' ? 'block' : 'none';
		}

		// Update preset dropdown for the current tool
		this.setCurrentTool( toolId );

		// Update context-aware visibility if enabled
		if ( this.contextAwareEnabled ) {
			this.updateContextVisibility( toolId );
		}
	}

	/**
	 * Update visibility of controls based on tool context
	 * Implements context-aware toolbar feature
	 *
	 * @param {string} toolId The currently selected tool
	 */
	updateContextVisibility( toolId ) {
		this.currentToolContext = toolId;

		// Define tool categories for context-aware visibility
		const drawingTools = [ 'rectangle', 'circle', 'ellipse', 'polygon', 'star', 'line', 'blur' ];
		const strokeOnlyTools = [ 'pen', 'arrow' ];

		// Determine what controls should be visible
		// textbox shows stroke/fill, text tool only shows text-specific controls
		const showMainStyleRow = drawingTools.includes( toolId ) ||
			strokeOnlyTools.includes( toolId ) ||
			toolId === 'textbox';
		const showPresets = toolId !== 'pointer';

		// Apply visibility with CSS classes for smooth transitions
		if ( this.mainStyleRow ) {
			if ( showMainStyleRow ) {
				this.mainStyleRow.classList.remove( 'context-hidden' );
			} else {
				this.mainStyleRow.classList.add( 'context-hidden' );
			}
		}

		if ( this.presetContainer ) {
			if ( showPresets ) {
				this.presetContainer.classList.remove( 'context-hidden' );
			} else {
				this.presetContainer.classList.add( 'context-hidden' );
			}
		}

		// Show/hide fill color based on tool (pen and arrow don't use fill)
		if ( this.fillControl && this.fillControl.container ) {
			if ( strokeOnlyTools.includes( toolId ) ) {
				this.fillControl.container.classList.add( 'context-hidden' );
			} else {
				this.fillControl.container.classList.remove( 'context-hidden' );
			}
		}
	}

	/**
	 * Check if context-aware toolbar is enabled
	 *
	 * @return {boolean} True if context-aware mode is active
	 */
	isContextAwareEnabled() {
		return this.contextAwareEnabled;
	}

	/**
	 * Enable or disable context-aware toolbar mode
	 *
	 * @param {boolean} enabled Whether to enable context-aware mode
	 */
	setContextAwareEnabled( enabled ) {
		this.contextAwareEnabled = enabled;
		if ( this.container ) {
			if ( enabled ) {
				this.container.classList.add( 'context-aware' );
				this.updateContextVisibility( this.currentToolContext );
			} else {
				this.container.classList.remove( 'context-aware' );
				// Show all controls when disabled
				this.showAllControls();
			}
		}
	}

	/**
	 * Show all controls (for legacy mode or when a layer is selected)
	 */
	showAllControls() {
		if ( this.mainStyleRow ) {
			this.mainStyleRow.classList.remove( 'context-hidden' );
		}
		if ( this.presetContainer ) {
			this.presetContainer.classList.remove( 'context-hidden' );
		}
		if ( this.fillControl && this.fillControl.container ) {
			this.fillControl.container.classList.remove( 'context-hidden' );
		}
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

		if ( this.strokeWidthInput ) {
			this.inputValidators.push(
				validator.createInputValidator( this.strokeWidthInput, 'number', { min: 0, max: 100 } )
			);
		}

		// Text effect validation is handled by TextEffectsControls
		if ( this.textEffectsControls ) {
			this.textEffectsControls.setupValidation( validator, this.inputValidators );
		}
	}

	/**
	 * Apply a preset style to the current controls (internal, called by PresetStyleManager)
	 *
	 * @param {Object} style Style properties from the preset
	 */
	applyPresetStyleInternal( style ) {
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

		// Delegate text effects (font size, text stroke, text shadow) to TextEffectsControls
		if ( this.textEffectsControls ) {
			this.textEffectsControls.applyStyle( style );
		}

		// Apply arrow style (delegate or fallback)
		if ( style.arrowStyle !== undefined ) {
			if ( this.arrowStyleControl ) {
				this.arrowStyleControl.applyStyle( style );
			} else if ( this.arrowStyleSelect ) {
				this.arrowStyleSelect.value = style.arrowStyle;
			}
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

		// Merge in text effects from delegate
		if ( this.textEffectsControls ) {
			Object.assign( style, this.textEffectsControls.getStyleValues() );
		}

		// Arrow style (delegate or fallback)
		if ( this.arrowStyleControl ) {
			Object.assign( style, this.arrowStyleControl.getStyleValues() );
		} else if ( this.arrowStyleSelect ) {
			style.arrowStyle = this.arrowStyleSelect.value;
		}

		return style;
	}

	/**
	 * Update preset dropdown when tool changes (delegates to PresetStyleManager)
	 *
	 * @param {string} tool Current tool name
	 */
	setCurrentTool( tool ) {
		if ( this.presetStyleManager ) {
			this.presetStyleManager.setCurrentTool( tool );
		}
	}

	/**
	 * Update preset dropdown when layer selection changes (delegates to PresetStyleManager)
	 * Also updates control visibility in context-aware mode
	 *
	 * When a layer is selected, toolbar style controls are HIDDEN because
	 * they are redundant with the Properties panel in the Layer Manager.
	 * Style controls only show when a drawing tool is active for creating new layers.
	 *
	 * @param {Array} selectedLayers Array of selected layer objects
	 */
	updateForSelection( selectedLayers ) {
		if ( this.presetStyleManager ) {
			this.presetStyleManager.updateForSelection( selectedLayers );
		}

		// When a layer is selected, hide toolbar style controls (they're in Properties panel)
		// Only show style controls when drawing tools are active for new layer creation
		if ( this.contextAwareEnabled && selectedLayers && selectedLayers.length > 0 ) {
			this.hideControlsForSelectedLayers( selectedLayers );
		}
	}

	/**
	 * Hide control visibility when layers are selected
	 * Controls are redundant because the Properties panel in the Layer Manager
	 * provides all the same controls for editing selected layers.
	 *
	 * @param {Array} selectedLayers Array of selected layer objects
	 */
	// eslint-disable-next-line no-unused-vars
	hideControlsForSelectedLayers( selectedLayers ) {
		// Hide main style row when layers are selected (Properties panel has these)
		if ( this.mainStyleRow ) {
			this.mainStyleRow.classList.add( 'context-hidden' );
		}

		// Hide presets when layers are selected (can apply from Properties panel)
		if ( this.presetContainer ) {
			this.presetContainer.classList.add( 'context-hidden' );
		}

		// Hide fill control
		if ( this.fillControl && this.fillControl.container ) {
			this.fillControl.container.classList.add( 'context-hidden' );
		}

		// Hide text effects controls
		if ( this.textEffectsControls ) {
			this.textEffectsControls.hideAll();
		}
	}

	/**
	 * Legacy method name for backward compatibility
	 * @deprecated Use hideControlsForSelectedLayers instead
	 * @param {Array} selectedLayers Array of selected layer objects
	 */
	updateContextForSelectedLayers( selectedLayers ) {
		this.hideControlsForSelectedLayers( selectedLayers );
	}

	/**
	 * Destroy and cleanup
	 */
	destroy() {
		// Clean up PresetStyleManager
		if ( this.presetStyleManager ) {
			this.presetStyleManager.destroy();
			this.presetStyleManager = null;
		}

		// Clean up text effects controller
		if ( this.textEffectsControls ) {
			this.textEffectsControls.destroy();
			this.textEffectsControls = null;
		}

		// Clean up arrow style controller
		if ( this.arrowStyleControl ) {
			this.arrowStyleControl.destroy();
			this.arrowStyleControl = null;
		}

		// Clean up all event listeners via EventTracker
		if ( this.eventTracker ) {
			this.eventTracker.destroy();
			this.eventTracker = null;
		}

		// Clear input validators
		this.inputValidators = [];

		// Clear DOM references (text-related refs are in TextEffectsControls)
		this.container = null;
		this.strokeColorButton = null;
		this.fillColorButton = null;
		this.strokeWidthInput = null;
		this.strokeContainer = null;
		this.arrowContainer = null;
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
