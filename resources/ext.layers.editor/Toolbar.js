/**
 * Toolbar for Layers Editor
 * Manages drawing tools, color picker, and editor actions
 *
 * Delegates to:
 * - ColorPickerDialog (ui/ColorPickerDialog.js) for color selection
 * - ToolbarKeyboard for keyboard shortcuts
 * - ImportExportManager for layer import/export
 */
( function () {
	'use strict';

	/**
	 * Toolbar class
	 *
	 * @class
	 * @param {Object} config Configuration object
	 * @param {HTMLElement} config.container The container element for the toolbar
	 * @param {window.LayersEditor} config.editor A reference to the main editor instance
	 */
	function Toolbar( config ) {
		this.config = config || {};
		this.container = this.config.container;
		this.editor = this.config.editor;
		this.currentTool = 'pointer';
		this.currentStrokeWidth = 2.0;
		this.strokeColorNone = false;
		this.fillColorNone = false;

		// Debug logging removed - use mw.config.get('wgLayersDebug') if needed

		// Initialize validator for real-time input validation
		this.validator = window.LayersValidator ? new window.LayersValidator() : null;
		this.inputValidators = [];
		this.documentListeners = [];
		this.dialogCleanups = [];
		this.keyboardShortcutHandler = null;

		// Initialize import/export manager
		this.importExportManager = window.ImportExportManager ?
			new window.ImportExportManager( { editor: this.editor } ) : null;

		this.init();
	}

	Toolbar.prototype.addDocumentListener = function ( event, handler, options ) {
		if ( !event || typeof handler !== 'function' ) {
			return;
		}
		document.addEventListener( event, handler, options );
		this.documentListeners.push( { event: event, handler: handler, options: options } );
	};

	Toolbar.prototype.removeDocumentListeners = function () {
		while ( this.documentListeners && this.documentListeners.length ) {
			const listener = this.documentListeners.pop();
			document.removeEventListener( listener.event, listener.handler, listener.options );
		}
	};

	Toolbar.prototype.registerDialogCleanup = function ( cleanupFn ) {
		if ( typeof cleanupFn === 'function' ) {
			this.dialogCleanups.push( cleanupFn );
		}
	};

	Toolbar.prototype.runDialogCleanups = function () {
		while ( this.dialogCleanups && this.dialogCleanups.length ) {
			const cleanup = this.dialogCleanups.pop();
			try {
				cleanup();
			} catch ( err ) {
				// Log cleanup errors but don't propagate to avoid cascading failures
				if ( window.layersErrorHandler ) {
					window.layersErrorHandler.handleError( err, 'Toolbar.runDialogCleanups', 'canvas', { severity: 'low' } );
				}
			}
		}
	};

	Toolbar.prototype.destroy = function () {
		this.runDialogCleanups();
		this.removeDocumentListeners();
		this.keyboardShortcutHandler = null;
		this.dialogCleanups = [];
		this.documentListeners = [];
	};

	Toolbar.prototype.init = function () {
		this.createInterface();
		this.setupEventHandlers();

		// Set default tool
		this.selectTool( 'pointer' );
	};

	// Show a modal color picker dialog near an anchor button
	// Uses ui/ColorPickerDialog module
	Toolbar.prototype.openColorPickerDialog = function ( anchorButton, initialValue, options ) {
		options = options || {};
		const self = this;
		const colorPickerStrings = this.getColorPickerStrings();

		if ( !window.ColorPickerDialog ) {
			// Fallback: ColorPickerDialog module not loaded
			return;
		}

		const picker = new window.ColorPickerDialog( {
			currentColor: ( initialValue === 'none' ) ? 'none' : ( initialValue || '#000000' ),
			anchorElement: anchorButton,
			strings: colorPickerStrings,
			registerCleanup: function ( fn ) {
				self.registerDialogCleanup( fn );
			},
			onApply: options.onApply || function () {},
			onCancel: options.onCancel || function () {}
		} );

		picker.open();
	};

	// Update color button display - uses ColorPickerDialog static method
	Toolbar.prototype.updateColorButtonDisplay = function ( btn, color, transparentLabel, previewTemplate ) {
		if ( window.ColorPickerDialog && window.ColorPickerDialog.updateColorButton ) {
			const strings = this.getColorPickerStrings();
			if ( transparentLabel ) {
				strings.transparent = transparentLabel;
			}
			if ( previewTemplate ) {
				strings.previewTemplate = previewTemplate;
			}
			window.ColorPickerDialog.updateColorButton( btn, color, strings );
		} else {
			// Fallback implementation
			let labelValue = color;
			if ( !color || color === 'none' || color === 'transparent' ) {
				btn.classList.add( 'is-transparent' );
				btn.title = transparentLabel || 'Transparent';
				btn.style.background = '';
				labelValue = transparentLabel || 'Transparent';
			} else {
				btn.classList.remove( 'is-transparent' );
				btn.style.background = color;
				btn.title = color;
			}
			if ( previewTemplate ) {
				const previewText = previewTemplate.indexOf( '$1' ) !== -1 ?
					previewTemplate.replace( '$1', labelValue ) :
					previewTemplate + ' ' + labelValue;
				btn.setAttribute( 'aria-label', previewText );
			} else if ( labelValue ) {
				btn.setAttribute( 'aria-label', labelValue );
			}
		}
	};

	// Get color picker strings
	Toolbar.prototype.getColorPickerStrings = function () {
		const t = this.msg.bind( this );
		return {
			title: t( 'layers-color-picker-title', 'Choose color' ),
			standard: t( 'layers-color-picker-standard', 'Standard colors' ),
			saved: t( 'layers-color-picker-saved', 'Saved colors' ),
			customSection: t( 'layers-color-picker-custom-section', 'Custom color' ),
			none: t( 'layers-color-picker-none', 'No fill (transparent)' ),
			emptySlot: t( 'layers-color-picker-empty-slot', 'Empty slot - colors will be saved here automatically' ),
			cancel: t( 'layers-color-picker-cancel', 'Cancel' ),
			apply: t( 'layers-color-picker-apply', 'Apply' ),
			transparent: t( 'layers-color-picker-transparent', 'Transparent' ),
			swatchTemplate: t( 'layers-color-picker-color-swatch', 'Set color to $1' ),
			previewTemplate: t( 'layers-color-picker-color-preview', 'Current color: $1' )
		};
	};

	/**
	 * Resolve i18n text safely, delegating to MessageHelper
	 *
	 * @param {string} key - Message key
	 * @param {string} fallback - Fallback text if message not found
	 * @return {string} Localized message or fallback
	 */
	Toolbar.prototype.msg = function ( key, fallback ) {
		// Delegate to MessageHelper singleton if available
		if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
			return window.layersMessages.get( key, fallback );
		}

		// Fallback: try mw.message directly
		if ( window.mw && mw.message ) {
			try {
				const msg = mw.message( key );
				if ( msg && typeof msg.text === 'function' ) {
					const text = msg.text();
					// Avoid returning placeholder markers
					if ( text && !text.includes( '⧼' ) ) {
						return text;
					}
				}
			} catch ( e ) {
				// Fall through to fallback
			}
		}

		return fallback || '';
	};

	Toolbar.prototype.createInterface = function () {
		this.container.innerHTML = '';
		this.container.className = 'layers-toolbar';
		this.container.setAttribute( 'role', 'toolbar' );
		this.container.setAttribute( 'aria-label', this.msg( 'layers-toolbar-title', 'Toolbar' ) );

		// Create tool groups
		this.createToolGroup();
		this.createStyleGroup();
		this.createZoomGroup();
		this.createActionGroup();
	};

	Toolbar.prototype.createToolGroup = function () {
		const toolGroup = document.createElement( 'div' );
		toolGroup.className = 'toolbar-group tools-group';
		const t = this.msg.bind( this );

		const tools = [
			{ id: 'pointer', icon: '↖', title: t( 'layers-tool-select', 'Select Tool' ), key: 'V' },
			{ id: 'text', icon: 'T', title: t( 'layers-tool-text', 'Text Tool' ), key: 'T' },
			{ id: 'pen', icon: '✏', title: t( 'layers-tool-pen', 'Pen Tool' ), key: 'P' },
			{ id: 'rectangle', icon: '▢', title: t( 'layers-tool-rectangle', 'Rectangle Tool' ), key: 'R' },
			{ id: 'circle', icon: '○', title: t( 'layers-tool-circle', 'Circle Tool' ), key: 'C' },
			{ id: 'ellipse', icon: '⬭', title: t( 'layers-tool-ellipse', 'Ellipse Tool' ), key: 'E' },
			{ id: 'polygon', icon: '⬟', title: t( 'layers-tool-polygon', 'Polygon Tool' ), key: 'G' },
			{ id: 'star', icon: '★', title: t( 'layers-tool-star', 'Star Tool' ), key: 'S' },
			{ id: 'arrow', icon: '→', title: t( 'layers-tool-arrow', 'Arrow Tool' ), key: 'A' },
			{ id: 'line', icon: '/', title: t( 'layers-tool-line', 'Line Tool' ), key: 'L' },
			{ id: 'blur', icon: '◼︎', title: t( 'layers-tool-blur', 'Blur/Redact Tool' ), key: 'B' }
		];

		tools.forEach( ( tool ) => {
			const button = this.createToolButton( tool );
			toolGroup.appendChild( button );
		} );

		this.container.appendChild( toolGroup );
	};

	Toolbar.prototype.createToolButton = function ( tool ) {
		const button = document.createElement( 'button' );
		button.className = 'toolbar-button tool-button';
		button.dataset.tool = tool.id;
		// Use textContent for icon glyphs to avoid HTML parsing
		button.textContent = tool.icon;
		button.title = tool.title + ( tool.key ? ' (' + tool.key + ')' : '' );
		// Expose keyboard shortcut to assistive tech
		if ( tool.key ) {
			button.setAttribute( 'aria-keyshortcuts', tool.key );
		}
		button.setAttribute( 'aria-label', tool.title );
		button.type = 'button';

		if ( tool.id === this.currentTool ) {
			button.classList.add( 'active' );
			button.setAttribute( 'aria-pressed', 'true' );
		} else {
			button.setAttribute( 'aria-pressed', 'false' );
		}

		return button;
	};

	Toolbar.prototype.createStyleGroup = function () {
		const styleGroup = document.createElement( 'div' );
		styleGroup.className = 'toolbar-group style-group';
		const self = this;
		const t = this.msg.bind( this );
		const colorPickerStrings = this.getColorPickerStrings();

		// Horizontal style controls container
		const styleControlsRow = document.createElement( 'div' );
		styleControlsRow.className = 'style-controls-row';

		// Stroke color with label
		const strokeColorItem = document.createElement( 'div' );
		strokeColorItem.className = 'style-control-item';
		const strokeLabel = document.createElement( 'span' );
		strokeLabel.className = 'style-control-label';
		strokeLabel.textContent = t( 'layers-prop-stroke-color', 'Stroke' );
		const strokeBtn = document.createElement( 'button' );
		strokeBtn.type = 'button';
		strokeBtn.className = 'color-display-button stroke-color';
		strokeBtn.setAttribute( 'aria-label', t( 'layers-prop-stroke-color', 'Stroke Color' ) );
		strokeBtn.setAttribute( 'aria-haspopup', 'dialog' );
		strokeBtn.setAttribute( 'aria-expanded', 'false' );
		self.updateColorButtonDisplay( strokeBtn, '#000000', colorPickerStrings.transparent, colorPickerStrings.previewTemplate );
		strokeColorItem.appendChild( strokeLabel );
		strokeColorItem.appendChild( strokeBtn );
		styleControlsRow.appendChild( strokeColorItem );
		strokeBtn.addEventListener( 'click', () => {
			self.openColorPickerDialog( strokeBtn, self.strokeColorNone ? 'none' : self.strokeColorValue, {
				title: t( 'layers-prop-stroke-color', 'Stroke Color' ),
				transparentTitle: t( 'layers-transparent', 'No Stroke (Transparent)' ),
				previewTemplate: colorPickerStrings.previewTemplate,
				onApply: function ( chosen ) {
					if ( chosen === 'none' ) {
						self.strokeColorNone = true;
						self.updateColorButtonDisplay( self.strokeColorButton, 'none', colorPickerStrings.transparent, colorPickerStrings.previewTemplate );
					} else {
						self.strokeColorNone = false;
						self.strokeColorValue = chosen;
						self.updateColorButtonDisplay( self.strokeColorButton, chosen, colorPickerStrings.transparent, colorPickerStrings.previewTemplate );
					}
					self.updateStyleOptions();
				}
			} );
		} );

		// Fill color with label
		const fillColorItem = document.createElement( 'div' );
		fillColorItem.className = 'style-control-item';
		const fillLabel = document.createElement( 'span' );
		fillLabel.className = 'style-control-label';
		fillLabel.textContent = t( 'layers-prop-fill-color', 'Fill' );
		const fillBtn = document.createElement( 'button' );
		fillBtn.type = 'button';
		fillBtn.className = 'color-display-button fill-color';
		fillBtn.setAttribute( 'aria-label', t( 'layers-prop-fill-color', 'Fill Color' ) );
		fillBtn.setAttribute( 'aria-haspopup', 'dialog' );
		fillBtn.setAttribute( 'aria-expanded', 'false' );
		self.updateColorButtonDisplay( fillBtn, '#ffffff', colorPickerStrings.transparent, colorPickerStrings.previewTemplate );
		fillColorItem.appendChild( fillLabel );
		fillColorItem.appendChild( fillBtn );
		styleControlsRow.appendChild( fillColorItem );
		fillBtn.addEventListener( 'click', () => {
			self.openColorPickerDialog( fillBtn, self.fillColorNone ? 'none' : self.fillColorValue, {
				title: t( 'layers-prop-fill-color', 'Fill Color' ),
				transparentTitle: t( 'layers-transparent', 'No Fill (Transparent)' ),
				previewTemplate: colorPickerStrings.previewTemplate,
				onApply: function ( chosen ) {
					if ( chosen === 'none' ) {
						self.fillColorNone = true;
						self.updateColorButtonDisplay( self.fillColorButton, 'none', colorPickerStrings.transparent, colorPickerStrings.previewTemplate );
					} else {
						self.fillColorNone = false;
						self.fillColorValue = chosen;
						self.updateColorButtonDisplay( self.fillColorButton, chosen, colorPickerStrings.transparent, colorPickerStrings.previewTemplate );
					}
					self.updateStyleOptions();
				}
			} );
		} );

		// Stroke width with label
		const strokeWidthItem = document.createElement( 'div' );
		strokeWidthItem.className = 'style-control-item';
		const widthLabel = document.createElement( 'span' );
		widthLabel.className = 'style-control-label';
		widthLabel.textContent = t( 'layers-prop-stroke-width', 'Width' );
		const strokeWidth = document.createElement( 'input' );
		strokeWidth.type = 'number';
		strokeWidth.min = '0';
		strokeWidth.max = '100';
		strokeWidth.step = '1';
		strokeWidth.value = '2';
		strokeWidth.className = 'stroke-width-input';
		strokeWidth.title = t( 'layers-prop-stroke-width', 'Stroke Width' ) + ': 2px';
		strokeWidth.placeholder = 'px';
		strokeWidthItem.appendChild( widthLabel );
		strokeWidthItem.appendChild( strokeWidth );
		styleControlsRow.appendChild( strokeWidthItem );

		styleGroup.appendChild( styleControlsRow );

		// Font size (for text tool) - hidden by default
		const fontSizeContainer = document.createElement( 'div' );
		fontSizeContainer.className = 'font-size-container style-control-item';
		fontSizeContainer.style.display = 'none';

		const fontLabel = document.createElement( 'span' );
		fontLabel.className = 'style-control-label';
		fontLabel.textContent = t( 'layers-prop-font-size', 'Size' );

		const fontSize = document.createElement( 'input' );
		fontSize.type = 'number';
		fontSize.min = '8';
		fontSize.max = '72';
		fontSize.value = '16';
		fontSize.className = 'font-size';
		fontSize.title = t( 'layers-prop-font-size', 'Font Size' );

		fontSizeContainer.appendChild( fontLabel );
		fontSizeContainer.appendChild( fontSize );
		styleGroup.appendChild( fontSizeContainer );

		// Text stroke options (for text tool)
		const strokeContainer = document.createElement( 'div' );
		strokeContainer.className = 'text-stroke-container';
		strokeContainer.style.display = 'none';

		const strokeColorLabel = document.createElement( 'label' );
		strokeColorLabel.textContent = t( 'layers-prop-stroke-color', 'Stroke Color' ) + ':';
		strokeColorLabel.className = 'stroke-color-label';

		const strokeColor = document.createElement( 'input' );
		strokeColor.type = 'color';
		strokeColor.value = '#000000';
		strokeColor.className = 'text-stroke-color';
		strokeColor.title = t( 'layers-prop-stroke-color', 'Text Stroke Color' );

		const strokeWidthInput = document.createElement( 'input' );
		strokeWidthInput.type = 'range';
		strokeWidthInput.min = '0';
		strokeWidthInput.max = '10';
		strokeWidthInput.value = '0';
		strokeWidthInput.className = 'text-stroke-width';
		strokeWidthInput.title = t( 'layers-prop-stroke-width', 'Text Stroke Width' );

		const strokeWidthValue = document.createElement( 'span' );
		strokeWidthValue.className = 'text-stroke-value';
		strokeWidthValue.textContent = '0';

		strokeContainer.appendChild( strokeColorLabel );
		strokeContainer.appendChild( strokeColor );
		strokeContainer.appendChild( strokeWidthInput );
		strokeContainer.appendChild( strokeWidthValue );
		styleGroup.appendChild( strokeContainer );

		// Drop shadow options (for text tool)
		const shadowContainer = document.createElement( 'div' );
		shadowContainer.className = 'text-shadow-container';
		shadowContainer.style.display = 'none';

		const shadowLabel = document.createElement( 'label' );
		shadowLabel.textContent = t( 'layers-effect-shadow', 'Shadow' ) + ':';
		shadowLabel.className = 'shadow-label';

		const shadowToggle = document.createElement( 'input' );
		shadowToggle.type = 'checkbox';
		shadowToggle.className = 'text-shadow-toggle';
		shadowToggle.title = t( 'layers-effect-shadow-enable', 'Enable Drop Shadow' );

		const shadowColor = document.createElement( 'input' );
		shadowColor.type = 'color';
		shadowColor.value = '#000000';
		shadowColor.className = 'text-shadow-color';
		shadowColor.title = t( 'layers-effect-shadow-color', 'Shadow Color' );
		shadowColor.style.display = 'none';

		shadowContainer.appendChild( shadowLabel );
		shadowContainer.appendChild( shadowToggle );
		shadowContainer.appendChild( shadowColor );
		styleGroup.appendChild( shadowContainer );

		// Arrow style options (for arrow tool)
		const arrowContainer = document.createElement( 'div' );
		arrowContainer.className = 'arrow-style-container';
		arrowContainer.style.display = 'none';

		const arrowLabel = document.createElement( 'label' );
		arrowLabel.textContent = t( 'layers-tool-arrow', 'Arrow' ) + ':';
		arrowLabel.className = 'arrow-label';

		const arrowStyleSelect = document.createElement( 'select' );
		arrowStyleSelect.className = 'arrow-style-select';
		// Build options without using innerHTML for safety and lint compliance
		const optSingle = document.createElement( 'option' );
		optSingle.value = 'single';
		optSingle.textContent = t( 'layers-arrow-single', 'Single →' );
		const optDouble = document.createElement( 'option' );
		optDouble.value = 'double';
		optDouble.textContent = t( 'layers-arrow-double', 'Double ↔' );
		const optNone = document.createElement( 'option' );
		optNone.value = 'none';
		optNone.textContent = t( 'layers-arrow-none', 'Line only' );
		arrowStyleSelect.appendChild( optSingle );
		arrowStyleSelect.appendChild( optDouble );
		arrowStyleSelect.appendChild( optNone );

		arrowContainer.appendChild( arrowLabel );
		arrowContainer.appendChild( arrowStyleSelect );
		styleGroup.appendChild( arrowContainer );

		this.container.appendChild( styleGroup );

		// Store references and initial state
		this.strokeColorButton = strokeBtn;
		this.fillColorButton = fillBtn;
		this.strokeColorValue = '#000000';
		this.fillColorValue = '#ffffff';
		this.strokeWidth = strokeWidth;
		this.fontSize = fontSize;
		this.fontSizeContainer = fontSizeContainer;
		this.strokeContainer = strokeContainer;
		this.shadowContainer = shadowContainer;
		this.arrowContainer = arrowContainer;
		this.textStrokeColor = strokeColor;
		this.textStrokeWidth = strokeWidthInput;
		this.textStrokeValue = strokeWidthValue;
		this.textShadowToggle = shadowToggle;
		this.textShadowColor = shadowColor;
		this.arrowStyleSelect = arrowStyleSelect;

		// Set up state tracking for transparent colors
		this.strokeColorNone = false;
		this.fillColorNone = false;

		// Add client-side validation to input fields
		this.setupInputValidation();
	};

	Toolbar.prototype.setupInputValidation = function () {
		if ( !this.validator ) {
			return; // Validator not available
		}

		// eslint-disable-next-line no-unused-vars
		const self = this;

		// Font size validation (1-200)
		if ( this.fontSize ) {
			this.inputValidators.push(
				this.validator.createInputValidator( this.fontSize, 'number', {
					min: 1,
					max: 200
				} )
			);
		}

		// Stroke width validation (0-100 integer)
		if ( this.strokeWidth ) {
			this.inputValidators.push(
				this.validator.createInputValidator( this.strokeWidth, 'number', {
					min: 0,
					max: 100
				} )
			);
		}

		// Text stroke width validation (0-10)
		if ( this.textStrokeWidth ) {
			this.inputValidators.push(
				this.validator.createInputValidator( this.textStrokeWidth, 'number', {
					min: 0,
					max: 10
				} )
			);
		}

		// Color inputs for text stroke/shadow are still validated

		if ( this.textStrokeColor ) {
			this.inputValidators.push(
				this.validator.createInputValidator( this.textStrokeColor, 'color' )
			);
		}

		if ( this.textShadowColor ) {
			this.inputValidators.push(
				this.validator.createInputValidator( this.textShadowColor, 'color' )
			);
		}
	};

	// Effects group removed; moved to LayerPanel Properties

	Toolbar.prototype.createZoomGroup = function () {
		const zoomGroup = document.createElement( 'div' );
		zoomGroup.className = 'toolbar-group zoom-group';
		const t2 = this.msg.bind( this );

		// Zoom out button
		const zoomOutBtn = document.createElement( 'button' );
		zoomOutBtn.className = 'toolbar-button zoom-button';
		// U+2212 Minus Sign
		zoomOutBtn.textContent = '−';
		zoomOutBtn.title = t2( 'layers-zoom-out', 'Zoom Out' ) + ' (Ctrl+-)';
		zoomOutBtn.dataset.action = 'zoom-out';

		// Zoom display/reset
		const zoomDisplay = document.createElement( 'button' );
		zoomDisplay.className = 'toolbar-button zoom-display';
		zoomDisplay.textContent = '100%';
		zoomDisplay.title = t2( 'layers-zoom-reset', 'Reset Zoom' ) + ' (Ctrl+0)';
		zoomDisplay.dataset.action = 'zoom-reset';
		// Announce zoom changes for screen readers
		zoomDisplay.setAttribute( 'aria-live', 'polite' );
		zoomDisplay.setAttribute( 'aria-label', t2( 'layers-status-zoom', 'Zoom' ) + ': 100%' );

		// Zoom in button
		const zoomInBtn = document.createElement( 'button' );
		zoomInBtn.className = 'toolbar-button zoom-button';
		zoomInBtn.textContent = '+';
		zoomInBtn.title = t2( 'layers-zoom-in', 'Zoom In' ) + ' (Ctrl++)';
		zoomInBtn.dataset.action = 'zoom-in';

		// Fit to window button
		const fitBtn = document.createElement( 'button' );
		fitBtn.className = 'toolbar-button fit-button';
		// U+2302 House
		fitBtn.textContent = '⌂';
		fitBtn.title = t2( 'layers-zoom-fit', 'Fit to Window' );
		fitBtn.dataset.action = 'fit-window';

		zoomGroup.appendChild( zoomOutBtn );
		zoomGroup.appendChild( zoomDisplay );
		zoomGroup.appendChild( zoomInBtn );
		zoomGroup.appendChild( fitBtn );

		this.container.appendChild( zoomGroup );

		// Store references
		this.zoomDisplay = zoomDisplay;
	};

	Toolbar.prototype.createActionGroup = function () {
		const actionGroup = document.createElement( 'div' );
		actionGroup.className = 'toolbar-group action-group';
		const t = this.msg.bind( this );

		const actions = [
			{ id: 'undo', icon: '↶', title: t( 'layers-undo', 'Undo' ), key: 'Ctrl+Z' },
			{ id: 'redo', icon: '↷', title: t( 'layers-redo', 'Redo' ), key: 'Ctrl+Y' },
			{ id: 'duplicate', icon: '⧉', title: t( 'layers-duplicate-selected', 'Duplicate Selected' ), key: 'Ctrl+D' }
		];

		actions.forEach( ( action ) => {
			const button = this.createActionButton( action );
			actionGroup.appendChild( button );
		} );

		// Separator
		const separator = document.createElement( 'div' );
		separator.className = 'toolbar-separator';
		actionGroup.appendChild( separator );

		// Import button + hidden file input
		const importButton = document.createElement( 'button' );
		importButton.className = 'toolbar-button import-button';
		importButton.textContent = t( 'layers-import-layers', 'Import Layers' );
		importButton.title = t( 'layers-import-layers', 'Import Layers' );
		actionGroup.appendChild( importButton );

		const importInput = document.createElement( 'input' );
		importInput.type = 'file';
		importInput.accept = '.json,application/json';
		importInput.style.display = 'none';
		actionGroup.appendChild( importInput );

		// Export button
		const exportButton = document.createElement( 'button' );
		exportButton.className = 'toolbar-button export-button';
		exportButton.textContent = t( 'layers-export-layers', 'Export Layers' );
		exportButton.title = t( 'layers-export-layers', 'Export Layers' );
		actionGroup.appendChild( exportButton );

		// Save and Cancel buttons
		const saveButton = document.createElement( 'button' );
		saveButton.className = 'toolbar-button save-button primary';
		saveButton.textContent = t( 'layers-editor-save', 'Save' );
		saveButton.title = t( 'layers-save-changes', 'Save Changes' ) + ' (Ctrl+S)';
		actionGroup.appendChild( saveButton );

		const cancelButton = document.createElement( 'button' );
		cancelButton.className = 'toolbar-button cancel-button';
		cancelButton.textContent = t( 'layers-editor-cancel', 'Cancel' );
		cancelButton.title = t( 'layers-cancel-changes', 'Cancel Changes' ) + ' (Escape)';
		actionGroup.appendChild( cancelButton );

		this.container.appendChild( actionGroup );

		// Store references
		this.saveButton = saveButton;
		this.cancelButton = cancelButton;
		this.importButton = importButton;
		this.importInput = importInput;
		this.exportButton = exportButton;
	};

	Toolbar.prototype.createActionButton = function ( action ) {
		const button = document.createElement( 'button' );
		button.className = 'toolbar-button action-button';
		button.dataset.action = action.id;
		// Icon may be a Unicode glyph; use textContent for safety
		button.textContent = action.icon;
		button.title = action.title + ( action.key ? ' (' + action.key + ')' : '' );

		// Mark common toggle actions as toggle buttons
		if ( [ 'grid', 'rulers', 'guides', 'snap-grid', 'snap-guides' ].includes( action.id ) ) {
			button.setAttribute( 'aria-pressed', 'false' );
		}

		return button;
	};

	Toolbar.prototype.setupEventHandlers = function () {
		const self = this;

		// Tool selection
		this.container.addEventListener( 'click', ( e ) => {
			if ( e.target.classList.contains( 'tool-button' ) ) {
				self.selectTool( e.target.dataset.tool );
			} else if ( e.target.classList.contains( 'action-button' ) ) {
				self.executeAction( e.target.dataset.action );
			} else if ( e.target.dataset.action && e.target.dataset.action.indexOf( 'zoom' ) === 0 ) {
				self.executeZoomAction( e.target.dataset.action );
			} else if ( e.target.dataset.action === 'fit-window' ) {
				self.executeZoomAction( e.target.dataset.action );
			}
		} );

		// Also support keyboard navigation on tool buttons for accessibility
		this.container.addEventListener( 'keydown', ( e ) => {
			if ( e.target.classList && e.target.classList.contains( 'tool-button' ) && ( e.key === 'Enter' || e.key === ' ' ) ) {
				e.preventDefault();
				self.selectTool( e.target.dataset.tool );
			}
		} );

		// Save/Cancel buttons
		this.saveButton.addEventListener( 'click', () => {
			self.editor.save();
		} );

		this.cancelButton.addEventListener( 'click', () => {
			self.editor.cancel( true );
		} );

		// Import JSON - delegate to ImportExportManager
		this.importButton.addEventListener( 'click', () => {
			self.importInput.click();
		} );

		this.importInput.addEventListener( 'change', function () {
			const file = this.files && this.files[ 0 ];
			if ( !file ) {
				return;
			}
			if ( self.importExportManager ) {
				self.importExportManager.importFromFile( file )
					.catch( () => {
						// Error already handled by ImportExportManager
					} )
					.finally( () => {
						self.importInput.value = '';
					} );
			} else {
				// Fallback: ImportExportManager not available
				self.importInput.value = '';
			}
		} );

		// Export JSON - delegate to ImportExportManager
		this.exportButton.addEventListener( 'click', () => {
			if ( self.importExportManager ) {
				self.importExportManager.exportToFile();
			}
		} );

		// Stroke and fill color pickers are wired in createStyleGroup()

		// Stroke width input with improved validation (integer-only) and units consistency
		this.strokeWidth.addEventListener( 'input', function () {
			let val = parseInt( this.value, 10 );
			const isValid = !isNaN( val ) && val >= 0 && val <= 100;

			if ( isValid ) {
				val = Math.round( val );
				self.currentStrokeWidth = val;

				// Update display with px unit for clarity
				this.title = self.msg( 'layers-prop-stroke-width', 'Stroke Width' ) + ': ' + val + 'px';

				// Remove error styling
				this.classList.remove( 'validation-error' );

				// Update canvas with new stroke width
				self.updateStyleOptions();
			} else {
				// Apply error styling for invalid values
				this.classList.add( 'validation-error' );

				// Show validation message in title
				if ( isNaN( val ) ) {
					this.title = 'Please enter a valid number between 0 and 100';
				} else if ( val < 0 ) {
					this.title = 'Minimum stroke width: 0px';
				} else if ( val > 100 ) {
					this.title = 'Maximum stroke width: 100px';
				}
			}
		} );

		// Also handle blur event to reset invalid values
		this.strokeWidth.addEventListener( 'blur', function () {
			const val = parseInt( this.value, 10 );
			if ( isNaN( val ) || val < 0 || val > 100 ) {
				// Reset to last valid value or default
				this.value = String( self.currentStrokeWidth );
				this.classList.remove( 'validation-error' );
				this.title = self.msg( 'layers-prop-stroke-width', 'Stroke Width' ) + ': ' +
					self.currentStrokeWidth + 'px';
			}
		} );

		// Font size
		this.fontSize.addEventListener( 'change', () => {
			self.updateStyleOptions();
		} );

		// Text stroke controls
		this.textStrokeColor.addEventListener( 'change', () => {
			self.updateStyleOptions();
		} );

		this.textStrokeWidth.addEventListener( 'input', function () {
			self.textStrokeValue.textContent = this.value;
			self.updateStyleOptions();
		} );

		// Text shadow controls
		this.textShadowToggle.addEventListener( 'change', function () {
			self.textShadowColor.style.display = this.checked ? 'inline-block' : 'none';
			self.updateStyleOptions();
		} );

		this.textShadowColor.addEventListener( 'change', () => {
			self.updateStyleOptions();
		} );

		// Arrow style controls
		this.arrowStyleSelect.addEventListener( 'change', () => {
			self.updateStyleOptions();
		} );

		// Keyboard shortcuts - delegate to ToolbarKeyboard module
		this.keyboardHandler = new window.ToolbarKeyboard( this );
		this.keyboardShortcutHandler = function ( e ) {
			self.keyboardHandler.handleKeyboardShortcuts( e );
		};
		this.addDocumentListener( 'keydown', this.keyboardShortcutHandler );

		// Layer-level effects removed: opacity, blend, toggles are in Properties panel
	};

	Toolbar.prototype.selectTool = function ( toolId ) {
		// Update UI
		Array.prototype.forEach.call( this.container.querySelectorAll( '.tool-button' ), ( button ) => {
			button.classList.remove( 'active' );
			button.setAttribute( 'aria-pressed', 'false' );
		} );

		const selectedButton = this.container.querySelector( '[data-tool="' + toolId + '"]' );
		if ( selectedButton ) {
			selectedButton.classList.add( 'active' );
			selectedButton.setAttribute( 'aria-pressed', 'true' );
		}

		this.currentTool = toolId;

		// Show/hide tool-specific options
		this.updateToolOptions( toolId );

		// Notify editor
		this.editor.setCurrentTool( toolId, { skipToolbarSync: true } );

		// Ensure focus remains on selected tool for keyboard users
		const focusedBtn = this.container.querySelector( '[data-tool="' + toolId + '"]' );
		if ( focusedBtn ) {
			focusedBtn.focus();
		}
	};

	/**
	 * Set the active tool programmatically (called by LayersEditor)
	 * @param {string} toolId - The tool identifier to activate
	 */
	Toolbar.prototype.setActiveTool = function ( toolId ) {
		if ( this.currentTool === toolId ) {
			return;
		}
		this.selectTool( toolId );
	};

	Toolbar.prototype.updateToolOptions = function ( toolId ) {
		// Show/hide tool-specific options
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

	Toolbar.prototype.updateStyleOptions = function () {
		// Update current style settings and notify editor
		const styleOptions = {
			color: this.strokeColorNone ? 'transparent' : this.strokeColorValue,
			fill: this.fillColorNone ? 'transparent' : this.fillColorValue,
			strokeWidth: this.currentStrokeWidth,
			fontSize: parseInt( this.fontSize.value, 10 ),
			textStrokeColor: this.textStrokeColor.value,
			textStrokeWidth: parseInt( this.textStrokeWidth.value, 10 ),
			textShadow: this.textShadowToggle.checked,
			textShadowColor: this.textShadowColor.value,
			arrowStyle: this.arrowStyleSelect.value,
			// Shape shadow properties (using same controls as text shadow for now)
			shadow: this.textShadowToggle.checked,
			shadowColor: this.textShadowColor.value,
			shadowBlur: 8,
			shadowOffsetX: 2,
			shadowOffsetY: 2
		};

		if ( this.editor.canvasManager && typeof this.editor.canvasManager.updateStyleOptions === 'function' ) {
			this.editor.canvasManager.updateStyleOptions( styleOptions );
		}
		if ( this.editor.toolManager && typeof this.editor.toolManager.updateStyle === 'function' ) {
			this.editor.toolManager.updateStyle( {
				color: styleOptions.color,
				fill: styleOptions.fill,
				strokeWidth: styleOptions.strokeWidth,
				fontSize: styleOptions.fontSize,
				// Ensure new arrows use the chosen arrowStyle by default
				arrowStyle: styleOptions.arrowStyle,
				// Include shadow properties so they propagate to newly created layers
				shadow: styleOptions.shadow,
				shadowColor: styleOptions.shadowColor,
				shadowBlur: styleOptions.shadowBlur,
				shadowOffsetX: styleOptions.shadowOffsetX,
				shadowOffsetY: styleOptions.shadowOffsetY
			} );
		}
	};

	// Removed legacy none buttons; transparent selection is integrated in the color dialog

	Toolbar.prototype.executeAction = function ( actionId ) {
		switch ( actionId ) {
			case 'undo':
				this.editor.undo();
				break;
			case 'redo':
				this.editor.redo();
				break;
			case 'delete':
				this.editor.deleteSelected();
				break;
			case 'duplicate':
				this.editor.duplicateSelected();
				break;
			case 'grid':
				this.toggleGrid();
				break;
			case 'rulers':
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.toggleRulers();
				}
				this.toggleButtonState( 'rulers' );
				break;
			case 'guides':
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.toggleGuidesVisibility();
				}
				this.toggleButtonState( 'guides' );
				break;
			case 'snap-grid':
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.toggleSnapToGrid();
				}
				this.toggleButtonState( 'snap-grid' );
				break;
			case 'snap-guides':
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.toggleSnapToGuides();
				}
				this.toggleButtonState( 'snap-guides' );
				break;
		}
	};

	Toolbar.prototype.toggleButtonState = function ( id ) {
		const btn = this.container.querySelector( '[data-action="' + id + '"]' );
		if ( btn ) {
			btn.classList.toggle( 'active' );
			if ( btn.hasAttribute( 'aria-pressed' ) ) {
				const pressed = btn.getAttribute( 'aria-pressed' ) === 'true';
				btn.setAttribute( 'aria-pressed', pressed ? 'false' : 'true' );
			}
		}
	};

	Toolbar.prototype.toggleGrid = function () {
		if ( this.editor.canvasManager ) {
			this.editor.canvasManager.toggleGrid();
		}

		// Update button state
		const gridButton = this.container.querySelector( '[data-action="grid"]' );
		if ( gridButton ) {
			gridButton.classList.toggle( 'active' );
		}
	};

	Toolbar.prototype.executeZoomAction = function ( actionId ) {
		if ( !this.editor.canvasManager ) {
			return;
		}

		switch ( actionId ) {
			case 'zoom-in':
				this.editor.canvasManager.zoomIn();
				break;
			case 'zoom-out':
				this.editor.canvasManager.zoomOut();
				break;
			case 'zoom-reset':
				this.editor.canvasManager.resetZoom();
				break;
			case 'fit-window':
				this.editor.canvasManager.fitToWindow();
				break;
		}
	};

	Toolbar.prototype.updateZoomDisplay = function ( zoomPercent ) {
		if ( this.zoomDisplay ) {
			this.zoomDisplay.textContent = zoomPercent + '%';
			this.zoomDisplay.setAttribute( 'aria-label', this.msg( 'layers-status-zoom', 'Zoom' ) + ': ' + zoomPercent + '%' );
		}
	};

	/**
	 * @deprecated Use ToolbarKeyboard.handleKeyboardShortcuts instead.
	 * Kept for backward compatibility - delegates to ToolbarKeyboard module.
	 */
	Toolbar.prototype.handleKeyboardShortcuts = function ( e ) {
		if ( this.keyboardHandler ) {
			this.keyboardHandler.handleKeyboardShortcuts( e );
		}
	};

	Toolbar.prototype.updateUndoRedoState = function ( canUndo, canRedo ) {
		const undoButton = this.container.querySelector( '[data-action="undo"]' );
		const redoButton = this.container.querySelector( '[data-action="redo"]' );

		if ( undoButton ) {
			undoButton.disabled = !canUndo;
		}

		if ( redoButton ) {
			redoButton.disabled = !canRedo;
		}
	};

	Toolbar.prototype.updateDeleteState = function ( hasSelection ) {
		const deleteButton = this.container.querySelector( '[data-action="delete"]' );
		const duplicateButton = this.container.querySelector( '[data-action="duplicate"]' );

		if ( deleteButton ) {
			deleteButton.disabled = !hasSelection;
		}

		if ( duplicateButton ) {
			duplicateButton.disabled = !hasSelection;
		}
	};

	// Export Toolbar to global scope
	window.Toolbar = Toolbar;

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = Toolbar;
	}

}() );
