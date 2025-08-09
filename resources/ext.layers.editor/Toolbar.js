/**
 * Toolbar for Layers Editor
 * Manages drawing tools, color picker, and editor actions
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
		this.currentColor = '#000000';
		this.currentStrokeWidth = 2;

		this.init();
	}

	Toolbar.prototype.init = function () {
		this.createInterface();
		this.setupEventHandlers();

		// Set default tool
		this.selectTool( 'pointer' );
	};

	Toolbar.prototype.createInterface = function () {
		this.container.innerHTML = '';
		this.container.className = 'layers-toolbar';

		// Create tool groups
		this.createToolGroup();
		this.createStyleGroup();
		this.createEffectsGroup();
		this.createZoomGroup();
		this.createActionGroup();
	};

	Toolbar.prototype.createToolGroup = function () {
		var toolGroup = document.createElement( 'div' );
		toolGroup.className = 'toolbar-group tools-group';

		var tools = [
			{ id: 'pointer', icon: '↖', title: ( mw.message ? mw.message( 'layers-tool-select' ).text() : 'Select Tool' ), key : 'V' },
			{ id: 'text', icon: 'T', title: ( mw.message ? mw.message( 'layers-tool-text' ).text() : 'Text Tool' ), key : 'T' },
			{ id: 'pen', icon: '✏', title: ( mw.message ? mw.message( 'layers-tool-pen' ).text() : 'Pen Tool' ), key : 'P' },
			{ id: 'rectangle', icon: '▢', title: ( mw.message ? mw.message( 'layers-tool-rectangle' ).text() : 'Rectangle Tool' ), key : 'R' },
			{ id: 'circle', icon: '○', title: ( mw.message ? mw.message( 'layers-tool-circle' ).text() : 'Circle Tool' ), key : 'C' },
			{ id: 'ellipse', icon: '○', title: ( mw.message ? mw.message( 'layers-tool-ellipse' ).text() : 'Ellipse Tool' ), key : 'E' },
			{ id: 'polygon', icon: '⬟', title: ( mw.message ? mw.message( 'layers-tool-polygon' ).text() : 'Polygon Tool' ), key : 'G' },
			{ id: 'star', icon: '★', title: ( mw.message ? mw.message( 'layers-tool-star' ).text() : 'Star Tool' ), key : 'S' },
			{ id: 'arrow', icon: '→', title: ( mw.message ? mw.message( 'layers-tool-arrow' ).text() : 'Arrow Tool' ), key : 'A' },
			{ id: 'line', icon: '/', title: ( mw.message ? mw.message( 'layers-tool-line' ).text() : 'Line Tool' ), key : 'L' },
			{ id: 'highlight', icon: '▒', title: ( mw.message ? mw.message( 'layers-tool-highlight' ).text() : 'Highlight Tool' ), key : 'H' },
			{ id: 'marquee', icon: '⬚', title: ( mw.message ? mw.message( 'layers-tool-marquee' ).text() : 'Marquee Select' ), key : 'M' }
		];

		tools.forEach( function ( tool ) {
			var button = this.createToolButton( tool );
			toolGroup.appendChild( button );
		}.bind( this ) );

		this.container.appendChild( toolGroup );
	};

	Toolbar.prototype.createToolButton = function ( tool ) {
		var button = document.createElement( 'button' );
		button.className = 'toolbar-button tool-button';
		button.dataset.tool = tool.id;
		button.innerHTML = tool.icon;
		button.title = tool.title + ( tool.key ? ' (' + tool.key + ')' : '' );
		button.setAttribute( 'aria-label', tool.title );
		button.type = 'button';

		if ( tool.id === this.currentTool ) {
			button.classList.add( 'active' );
		}

		return button;
	};

	Toolbar.prototype.createStyleGroup = function () {
		var styleGroup = document.createElement( 'div' );
		styleGroup.className = 'toolbar-group style-group';

		// Color picker
		var colorPicker = document.createElement( 'input' );
		colorPicker.type = 'color';
		colorPicker.className = 'color-picker';
		colorPicker.value = this.currentColor;
		colorPicker.title = ( mw.message ? mw.message( 'layers-prop-color' ).text() : 'Color' );
		styleGroup.appendChild( colorPicker );

		// Stroke width
		var strokeWidthContainer = document.createElement( 'div' );
		strokeWidthContainer.className = 'stroke-width-container';

		var strokeLabel = document.createElement( 'label' );
		strokeLabel.textContent = ( mw.message ? mw.message( 'layers-prop-stroke-width' ).text() : 'Stroke Width' ) + ':';
		strokeLabel.className = 'stroke-label';

		var strokeWidth = document.createElement( 'input' );
		strokeWidth.type = 'range';
		strokeWidth.min = '1';
		strokeWidth.max = '20';
		strokeWidth.value = this.currentStrokeWidth;
		strokeWidth.className = 'stroke-width';
		strokeWidth.title = ( mw.message ? mw.message( 'layers-prop-stroke-width' ).text() : 'Stroke Width' );

		var strokeValue = document.createElement( 'span' );
		strokeValue.className = 'stroke-value';
		strokeValue.textContent = this.currentStrokeWidth;

		strokeWidthContainer.appendChild( strokeLabel );
		strokeWidthContainer.appendChild( strokeWidth );
		strokeWidthContainer.appendChild( strokeValue );
		styleGroup.appendChild( strokeWidthContainer );

		// Font size (for text tool)
		var fontSizeContainer = document.createElement( 'div' );
		fontSizeContainer.className = 'font-size-container';
		fontSizeContainer.style.display = 'none';

		var fontLabel = document.createElement( 'label' );
		fontLabel.textContent = ( mw.message ? mw.message( 'layers-prop-font-size' ).text() : 'Font Size' ) + ':';
		fontLabel.className = 'font-label';

		var fontSize = document.createElement( 'input' );
		fontSize.type = 'number';
		fontSize.min = '8';
		fontSize.max = '72';
		fontSize.value = '16';
		fontSize.className = 'font-size';
		fontSize.title = ( mw.message ? mw.message( 'layers-prop-font-size' ).text() : 'Font Size' );

		fontSizeContainer.appendChild( fontLabel );
		fontSizeContainer.appendChild( fontSize );
		styleGroup.appendChild( fontSizeContainer );

		// Text stroke options (for text tool)
		var strokeContainer = document.createElement( 'div' );
		strokeContainer.className = 'text-stroke-container';
		strokeContainer.style.display = 'none';

		var strokeColorLabel = document.createElement( 'label' );
		strokeColorLabel.textContent = ( mw.message ? mw.message( 'layers-prop-stroke-color' ).text() : 'Stroke Color' ) + ':';
		strokeColorLabel.className = 'stroke-color-label';

		var strokeColor = document.createElement( 'input' );
		strokeColor.type = 'color';
		strokeColor.value = '#000000';
		strokeColor.className = 'text-stroke-color';
		strokeColor.title = ( mw.message ? mw.message( 'layers-prop-stroke-color' ).text() : 'Text Stroke Color' );

		var strokeWidthInput = document.createElement( 'input' );
		strokeWidthInput.type = 'range';
		strokeWidthInput.min = '0';
		strokeWidthInput.max = '10';
		strokeWidthInput.value = '0';
		strokeWidthInput.className = 'text-stroke-width';
		strokeWidthInput.title = ( mw.message ? mw.message( 'layers-prop-stroke-width' ).text() : 'Text Stroke Width' );

		var strokeWidthValue = document.createElement( 'span' );
		strokeWidthValue.className = 'text-stroke-value';
		strokeWidthValue.textContent = '0';

		strokeContainer.appendChild( strokeColorLabel );
		strokeContainer.appendChild( strokeColor );
		strokeContainer.appendChild( strokeWidthInput );
		strokeContainer.appendChild( strokeWidthValue );
		styleGroup.appendChild( strokeContainer );

		// Drop shadow options (for text tool)
		var shadowContainer = document.createElement( 'div' );
		shadowContainer.className = 'text-shadow-container';
		shadowContainer.style.display = 'none';

		var shadowLabel = document.createElement( 'label' );
		shadowLabel.textContent = ( mw.message ? mw.message( 'layers-effect-shadow' ).text() : 'Shadow' ) + ':';
		shadowLabel.className = 'shadow-label';

		var shadowToggle = document.createElement( 'input' );
		shadowToggle.type = 'checkbox';
		shadowToggle.className = 'text-shadow-toggle';
		shadowToggle.title = ( mw.message ? mw.message( 'layers-effect-shadow-enable' ).text() : 'Enable Drop Shadow' );

		var shadowColor = document.createElement( 'input' );
		shadowColor.type = 'color';
		shadowColor.value = '#000000';
		shadowColor.className = 'text-shadow-color';
		shadowColor.title = ( mw.message ? mw.message( 'layers-effect-shadow-color' ).text() : 'Shadow Color' );
		shadowColor.style.display = 'none';

		shadowContainer.appendChild( shadowLabel );
		shadowContainer.appendChild( shadowToggle );
		shadowContainer.appendChild( shadowColor );
		styleGroup.appendChild( shadowContainer );

		// Arrow style options (for arrow tool)
		var arrowContainer = document.createElement( 'div' );
		arrowContainer.className = 'arrow-style-container';
		arrowContainer.style.display = 'none';

		var arrowLabel = document.createElement( 'label' );
		arrowLabel.textContent = ( mw.message ? mw.message( 'layers-tool-arrow' ).text() : 'Arrow' ) + ':';
		arrowLabel.className = 'arrow-label';

		var arrowStyleSelect = document.createElement( 'select' );
		arrowStyleSelect.className = 'arrow-style-select';
		arrowStyleSelect.innerHTML =
			'<option value="single">' + ( mw.message ? mw.message( 'layers-arrow-single' ).text() : 'Single →' ) + '</option>' +
			'<option value="double">' + ( mw.message ? mw.message( 'layers-arrow-double' ).text() : 'Double ↔' ) + '</option>' +
			'<option value="none">' + ( mw.message ? mw.message( 'layers-arrow-none' ).text() : 'Line only' ) + '</option>';

		arrowContainer.appendChild( arrowLabel );
		arrowContainer.appendChild( arrowStyleSelect );
		styleGroup.appendChild( arrowContainer );

		this.container.appendChild( styleGroup );

		// Store references
		this.colorPicker = colorPicker;
		this.strokeWidth = strokeWidth;
		this.strokeValue = strokeValue;
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
	};

	Toolbar.prototype.createEffectsGroup = function () {
		var effectsGroup = document.createElement( 'div' );
		effectsGroup.className = 'toolbar-group effects-group';

		// Layer opacity control
		var opacityLabel = document.createElement( 'label' );
		opacityLabel.textContent = ( mw.message ? mw.message( 'layers-prop-opacity' ).text() : 'Opacity' ) + ':';
		opacityLabel.className = 'toolbar-label';
		effectsGroup.appendChild( opacityLabel );

		var opacitySlider = document.createElement( 'input' );
		opacitySlider.type = 'range';
		opacitySlider.min = '0';
		opacitySlider.max = '100';
		opacitySlider.value = '100';
		opacitySlider.className = 'toolbar-slider opacity-slider';
		opacitySlider.title = ( mw.message ? mw.message( 'layers-prop-opacity' ).text() : 'Layer Opacity' );
		effectsGroup.appendChild( opacitySlider );

		var opacityDisplay = document.createElement( 'span' );
		opacityDisplay.textContent = '100%';
		opacityDisplay.className = 'toolbar-display opacity-display';
		effectsGroup.appendChild( opacityDisplay );

		// Layer blend mode
		var blendLabel = document.createElement( 'label' );
		blendLabel.textContent = ( mw.message ? mw.message( 'layers-prop-blend' ).text() : 'Blend' ) + ':';
		blendLabel.className = 'toolbar-label';
		effectsGroup.appendChild( blendLabel );

		var blendSelect = document.createElement( 'select' );
		blendSelect.className = 'toolbar-select blend-mode-select';
		blendSelect.title = ( mw.message ? mw.message( 'layers-prop-blend' ).text() : 'Blend Mode' );

		var blendModes = [
			{ value: 'normal', text: ( mw.message ? mw.message( 'layers-blend-normal' ).text() : 'Normal' ) },
			{ value: 'multiply', text: ( mw.message ? mw.message( 'layers-blend-multiply' ).text() : 'Multiply' ) },
			{ value: 'screen', text: ( mw.message ? mw.message( 'layers-blend-screen' ).text() : 'Screen' ) },
			{ value: 'overlay', text: ( mw.message ? mw.message( 'layers-blend-overlay' ).text() : 'Overlay' ) },
			{ value: 'soft-light', text: ( mw.message ? mw.message( 'layers-blend-soft-light' ).text() : 'Soft Light' ) },
			{ value: 'hard-light', text: ( mw.message ? mw.message( 'layers-blend-hard-light' ).text() : 'Hard Light' ) },
			{ value: 'color-dodge', text: ( mw.message ? mw.message( 'layers-blend-color-dodge' ).text() : 'Color Dodge' ) },
			{ value: 'color-burn', text: ( mw.message ? mw.message( 'layers-blend-color-burn' ).text() : 'Color Burn' ) },
			{ value: 'darken', text: ( mw.message ? mw.message( 'layers-blend-darken' ).text() : 'Darken' ) },
			{ value: 'lighten', text: ( mw.message ? mw.message( 'layers-blend-lighten' ).text() : 'Lighten' ) },
			{ value: 'difference', text: ( mw.message ? mw.message( 'layers-blend-difference' ).text() : 'Difference' ) },
			{ value: 'exclusion', text: ( mw.message ? mw.message( 'layers-blend-exclusion' ).text() : 'Exclusion' ) }
		];

		blendModes.forEach( function ( mode ) {
			var option = document.createElement( 'option' );
			option.value = mode.value;
			option.textContent = mode.text;
			blendSelect.appendChild( option );
		} );

		effectsGroup.appendChild( blendSelect );

		// Layer effects toggles
		var effectsLabel = document.createElement( 'label' );
		effectsLabel.textContent = ( mw.message ? mw.message( 'layers-effects' ).text() : 'Effects' ) + ':';
		effectsLabel.className = 'toolbar-label';
		effectsGroup.appendChild( effectsLabel );

		var shadowToggle = document.createElement( 'button' );
		shadowToggle.className = 'toolbar-button effect-toggle shadow-toggle';
		shadowToggle.textContent = ( mw.message ? mw.message( 'layers-effect-shadow' ).text() : 'Shadow' );
		shadowToggle.title = ( mw.message ? mw.message( 'layers-effect-shadow-toggle' ).text() : 'Toggle Drop Shadow' );
		effectsGroup.appendChild( shadowToggle );

		var glowToggle = document.createElement( 'button' );
		glowToggle.className = 'toolbar-button effect-toggle glow-toggle';
		glowToggle.textContent = ( mw.message ? mw.message( 'layers-effect-glow' ).text() : 'Glow' );
		glowToggle.title = ( mw.message ? mw.message( 'layers-effect-glow-toggle' ).text() : 'Toggle Glow Effect' );
		effectsGroup.appendChild( glowToggle );

		var strokeToggle = document.createElement( 'button' );
		strokeToggle.className = 'toolbar-button effect-toggle stroke-toggle';
		strokeToggle.textContent = ( mw.message ? mw.message( 'layers-effect-stroke' ).text() : 'Stroke' );
		strokeToggle.title = ( mw.message ? mw.message( 'layers-effect-stroke-toggle' ).text() : 'Toggle Stroke Effect' );
		effectsGroup.appendChild( strokeToggle );

		this.container.appendChild( effectsGroup );

		// Store references
		this.opacitySlider = opacitySlider;
		this.opacityDisplay = opacityDisplay;
		this.blendSelect = blendSelect;
		this.shadowToggle = shadowToggle;
		this.glowToggle = glowToggle;
		this.strokeToggle = strokeToggle;
	};

	Toolbar.prototype.createZoomGroup = function () {
		var zoomGroup = document.createElement( 'div' );
		zoomGroup.className = 'toolbar-group zoom-group';

		// Zoom out button
		var zoomOutBtn = document.createElement( 'button' );
		zoomOutBtn.className = 'toolbar-button zoom-button';
		zoomOutBtn.innerHTML = '−';
		zoomOutBtn.title = ( mw.message ? mw.message( 'layers-zoom-out' ).text() : 'Zoom Out' ) + ' (Ctrl+-)';
		zoomOutBtn.dataset.action = 'zoom-out';

		// Zoom display/reset
		var zoomDisplay = document.createElement( 'button' );
		zoomDisplay.className = 'toolbar-button zoom-display';
		zoomDisplay.textContent = '100%';
		zoomDisplay.title = ( mw.message ? mw.message( 'layers-zoom-reset' ).text() : 'Reset Zoom' ) + ' (Ctrl+0)';
		zoomDisplay.dataset.action = 'zoom-reset';

		// Zoom in button
		var zoomInBtn = document.createElement( 'button' );
		zoomInBtn.className = 'toolbar-button zoom-button';
		zoomInBtn.innerHTML = '+';
		zoomInBtn.title = ( mw.message ? mw.message( 'layers-zoom-in' ).text() : 'Zoom In' ) + ' (Ctrl++)';
		zoomInBtn.dataset.action = 'zoom-in';

		// Fit to window button
		var fitBtn = document.createElement( 'button' );
		fitBtn.className = 'toolbar-button fit-button';
		fitBtn.innerHTML = '⌂';
		fitBtn.title = ( mw.message ? mw.message( 'layers-zoom-fit' ).text() : 'Fit to Window' );
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
		var actionGroup = document.createElement( 'div' );
		actionGroup.className = 'toolbar-group action-group';

		var actions = [
			{ id: 'undo', icon: '↶', title: ( mw.message ? mw.message( 'layers-undo' ).text() : 'Undo' ), key : 'Ctrl+Z' },
			{ id: 'redo', icon: '↷', title: ( mw.message ? mw.message( 'layers-redo' ).text() : 'Redo' ), key : 'Ctrl+Y' },
			{ id: 'delete', icon: '🗑', title: ( mw.message ? mw.message( 'layers-delete-selected' ).text() : 'Delete Selected' ), key : 'Delete' },
			{ id: 'duplicate', icon: '⧉', title: ( mw.message ? mw.message( 'layers-duplicate-selected' ).text() : 'Duplicate Selected' ), key : 'Ctrl+D' },
			{ id: 'grid', icon: '⊞', title: ( mw.message ? mw.message( 'layers-toggle-grid' ).text() : 'Toggle Grid' ), key : 'G' }
		];

		actions.forEach( function ( action ) {
			var button = this.createActionButton( action );
			actionGroup.appendChild( button );
		}.bind( this ) );

		// Separator
		var separator = document.createElement( 'div' );
		separator.className = 'toolbar-separator';
		actionGroup.appendChild( separator );

		// Save and Cancel buttons
		var saveButton = document.createElement( 'button' );
		saveButton.className = 'toolbar-button save-button primary';
		saveButton.textContent = ( mw.message ? mw.message( 'layers-editor-save' ).text() : ( mw.msg ? mw.msg( 'layers-editor-save' ) : 'Save' ) );
		saveButton.title = ( mw.message ? mw.message( 'layers-save-changes' ).text() : 'Save Changes' ) + ' (Ctrl+S)';
		actionGroup.appendChild( saveButton );

		var cancelButton = document.createElement( 'button' );
		cancelButton.className = 'toolbar-button cancel-button';
		cancelButton.textContent = ( mw.message ? mw.message( 'layers-editor-cancel' ).text() : ( mw.msg ? mw.msg( 'layers-editor-cancel' ) : 'Cancel' ) );
		cancelButton.title = ( mw.message ? mw.message( 'layers-cancel-changes' ).text() : 'Cancel Changes' ) + ' (Escape)';
		actionGroup.appendChild( cancelButton );

		this.container.appendChild( actionGroup );

		// Store references
		this.saveButton = saveButton;
		this.cancelButton = cancelButton;
	};

	Toolbar.prototype.createActionButton = function ( action ) {
		var button = document.createElement( 'button' );
		button.className = 'toolbar-button action-button';
		button.dataset.action = action.id;
		button.innerHTML = action.icon;
		button.title = action.title + ( action.key ? ' (' + action.key + ')' : '' );

		return button;
	};

	Toolbar.prototype.setupEventHandlers = function () {
		var self = this;

		// Tool selection
		this.container.addEventListener( 'click', function ( e ) {
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
		this.container.addEventListener( 'keydown', function ( e ) {
			if ( e.target.classList && e.target.classList.contains( 'tool-button' ) && ( e.key === 'Enter' || e.key === ' ' ) ) {
				e.preventDefault();
				self.selectTool( e.target.dataset.tool );
			}
		} );

		// Save/Cancel buttons
		this.saveButton.addEventListener( 'click', function () {
			self.editor.save();
		} );

		this.cancelButton.addEventListener( 'click', function () {
			self.editor.cancel();
		} );

		// Color picker
		this.colorPicker.addEventListener( 'change', function () {
			self.currentColor = this.value;
			self.updateStyleOptions();
		} );

		// Stroke width
		this.strokeWidth.addEventListener( 'input', function () {
			self.currentStrokeWidth = parseInt( this.value );
			self.strokeValue.textContent = self.currentStrokeWidth;
			self.updateStyleOptions();
		} );

		// Font size
		this.fontSize.addEventListener( 'change', function () {
			self.updateStyleOptions();
		} );

		// Text stroke controls
		this.textStrokeColor.addEventListener( 'change', function () {
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

		this.textShadowColor.addEventListener( 'change', function () {
			self.updateStyleOptions();
		} );

		// Arrow style controls
		this.arrowStyleSelect.addEventListener( 'change', function () {
			self.updateStyleOptions();
		} );

		// Keyboard shortcuts
		document.addEventListener( 'keydown', function ( e ) {
			self.handleKeyboardShortcuts( e );
		} );
	};

	Toolbar.prototype.selectTool = function ( toolId ) {
		// Update UI
		Array.prototype.forEach.call( this.container.querySelectorAll( '.tool-button' ), function ( button ) {
			button.classList.remove( 'active' );
		} );

		var selectedButton = this.container.querySelector( '[data-tool="' + toolId + '"]' );
		if ( selectedButton ) {
			selectedButton.classList.add( 'active' );
		}

		this.currentTool = toolId;

		// Show/hide tool-specific options
		this.updateToolOptions( toolId );

		// Notify editor
		this.editor.setCurrentTool( toolId );

		// Ensure focus remains on selected tool for keyboard users
		var focusedBtn = this.container.querySelector( '[data-tool="' + toolId + '"]' );
		if ( focusedBtn ) {
			focusedBtn.focus();
		}
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
		var styleOptions = {
			color: this.currentColor,
			strokeWidth: this.currentStrokeWidth,
			fontSize: parseInt( this.fontSize.value ),
			textStrokeColor: this.textStrokeColor.value,
			textStrokeWidth: parseInt( this.textStrokeWidth.value ),
			textShadow: this.textShadowToggle.checked,
			textShadowColor: this.textShadowColor.value,
			arrowStyle: this.arrowStyleSelect.value
		};

		if ( this.editor.canvasManager ) {
			this.editor.canvasManager.updateStyleOptions( styleOptions );
		}

		// console.log( 'Layers: Style options updated:', styleOptions );
	};

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
		}
	};

	Toolbar.prototype.toggleGrid = function () {
		if ( this.editor.canvasManager ) {
			this.editor.canvasManager.toggleGrid();
		}

		// Update button state
		var gridButton = this.container.querySelector( '[data-action="grid"]' );
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
		}
	};

	Toolbar.prototype.handleKeyboardShortcuts = function ( e ) {
		// Don't handle shortcuts when typing in input fields
		if ( e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true' ) {
			return;
		}

		var key = e.key.toLowerCase();
		var ctrl = e.ctrlKey || e.metaKey;

		if ( ctrl ) {
			switch ( key ) {
				case 'z':
					e.preventDefault();
					if ( e.shiftKey ) {
						this.editor.redo();
					} else {
						this.editor.undo();
					}
					break;
				case 'y':
					e.preventDefault();
					this.editor.redo();
					break;
				case 's':
					e.preventDefault();
					this.editor.save();
					break;
				case 'd':
					e.preventDefault();
					this.editor.duplicateSelected();
					break;
			}
		} else {
			// Tool shortcuts
			switch ( key ) {
				case 'v':
					this.selectTool( 'pointer' );
					break;
				case 't':
					this.selectTool( 'text' );
					break;
				case 'p':
					this.selectTool( 'pen' );
					break;
				case 'r':
					this.selectTool( 'rectangle' );
					break;
				case 'c':
					this.selectTool( 'circle' );
					break;
				case 'a':
					this.selectTool( 'arrow' );
					break;
				case 'l':
					this.selectTool( 'line' );
					break;
				case 'h':
					this.selectTool( 'highlight' );
					break;
				case 'g':
					this.toggleGrid();
					break;
				case 'delete':
				case 'backspace':
					this.editor.deleteSelected();
					break;
				case 'escape':
					this.editor.cancel();
					break;
			}
		}
	};

	Toolbar.prototype.updateUndoRedoState = function ( canUndo, canRedo ) {
		var undoButton = this.container.querySelector( '[data-action="undo"]' );
		var redoButton = this.container.querySelector( '[data-action="redo"]' );

		if ( undoButton ) {
			undoButton.disabled = !canUndo;
		}

		if ( redoButton ) {
			redoButton.disabled = !canRedo;
		}
	};

	Toolbar.prototype.updateDeleteState = function ( hasSelection ) {
		var deleteButton = this.container.querySelector( '[data-action="delete"]' );
		var duplicateButton = this.container.querySelector( '[data-action="duplicate"]' );

		if ( deleteButton ) {
			deleteButton.disabled = !hasSelection;
		}

		if ( duplicateButton ) {
			duplicateButton.disabled = !hasSelection;
		}
	};

	// Export Toolbar to global scope
	window.Toolbar = Toolbar;

}() );
