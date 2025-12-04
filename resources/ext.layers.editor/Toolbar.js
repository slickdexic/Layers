/**
 * Toolbar for Layers Editor
 * Manages drawing tools, color picker, and editor actions
 *
 * Delegates to:
 * - ColorPickerDialog (ui/ColorPickerDialog.js) for color selection
 * - ToolbarKeyboard for keyboard shortcuts
 * - ImportExportManager for layer import/export
 * - ToolbarStyleControls for style controls UI
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

		// Debug logging removed - use mw.config.get('wgLayersDebug') if needed

		// Initialize validator for real-time input validation
		this.validator = window.LayersValidator ? new window.LayersValidator() : null;
		this.dialogCleanups = [];

		// Initialize EventTracker for memory-safe event listener management
		this.eventTracker = window.EventTracker ? new window.EventTracker() : null;
		this.keyboardShortcutHandler = null;

		// Initialize import/export manager
		this.importExportManager = window.ImportExportManager ?
			new window.ImportExportManager( { editor: this.editor } ) : null;

		// Initialize style controls manager
		this.styleControls = null;

		this.init();
	}

	Toolbar.prototype.addDocumentListener = function ( event, handler, options ) {
		if ( !event || typeof handler !== 'function' ) {
			return;
		}
		if ( this.eventTracker ) {
			this.eventTracker.add( document, event, handler, options );
		} else {
			// Fallback if EventTracker not available
			document.addEventListener( event, handler, options );
		}
	};

	/**
	 * Add event listener to a specific element with automatic tracking
	 * @param {Element} element Target element
	 * @param {string} event Event type
	 * @param {Function} handler Event handler
	 * @param {Object} [options] Event listener options
	 */
	Toolbar.prototype.addListener = function ( element, event, handler, options ) {
		if ( !element || !event || typeof handler !== 'function' ) {
			return;
		}
		if ( this.eventTracker ) {
			this.eventTracker.add( element, event, handler, options );
		} else {
			// Fallback if EventTracker not available
			element.addEventListener( event, handler, options );
		}
	};

	Toolbar.prototype.removeAllListeners = function () {
		if ( this.eventTracker ) {
			this.eventTracker.destroy();
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
		this.removeAllListeners();
		this.keyboardShortcutHandler = null;
		this.dialogCleanups = [];
		this.eventTracker = null;
		if ( this.styleControls ) {
			this.styleControls.destroy();
			this.styleControls = null;
		}
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
		const self = this;

		// Initialize style controls manager
		if ( window.ToolbarStyleControls ) {
			this.styleControls = new window.ToolbarStyleControls( {
				toolbar: this,
				msg: this.msg.bind( this )
			} );

			const styleGroup = this.styleControls.create();
			this.container.appendChild( styleGroup );

			// Setup validation if validator available
			if ( this.validator ) {
				this.styleControls.setupValidation( this.validator );
			}

			// Store references for backward compatibility
			this.strokeColorButton = this.styleControls.strokeColorButton;
			this.fillColorButton = this.styleControls.fillColorButton;
			this.strokeWidth = this.styleControls.strokeWidthInput;
			this.fontSize = this.styleControls.fontSizeInput;
			this.fontSizeContainer = this.styleControls.fontSizeContainer;
			this.strokeContainer = this.styleControls.strokeContainer;
			this.shadowContainer = this.styleControls.shadowContainer;
			this.arrowContainer = this.styleControls.arrowContainer;
			this.textStrokeColor = this.styleControls.textStrokeColor;
			this.textStrokeWidth = this.styleControls.textStrokeWidth;
			this.textStrokeValue = this.styleControls.textStrokeValue;
			this.textShadowToggle = this.styleControls.textShadowToggle;
			this.textShadowColor = this.styleControls.textShadowColor;
			this.arrowStyleSelect = this.styleControls.arrowStyleSelect;
		} else {
			// Fallback: create minimal style group if module not loaded
			const styleGroup = document.createElement( 'div' );
			styleGroup.className = 'toolbar-group style-group';
			styleGroup.textContent = self.msg( 'layers-prop-stroke-color', 'Style controls loading...' );
			this.container.appendChild( styleGroup );
		}
	};

	/**
	 * Handle style change notifications from ToolbarStyleControls
	 *
	 * @param {Object} styleOptions The new style options
	 */
	Toolbar.prototype.onStyleChange = function ( styleOptions ) {
		if ( this.editor.canvasManager && typeof this.editor.canvasManager.updateStyleOptions === 'function' ) {
			this.editor.canvasManager.updateStyleOptions( styleOptions );
		}
		if ( this.editor.toolManager && typeof this.editor.toolManager.updateStyle === 'function' ) {
			this.editor.toolManager.updateStyle( {
				color: styleOptions.color,
				fill: styleOptions.fill,
				strokeWidth: styleOptions.strokeWidth,
				fontSize: styleOptions.fontSize,
				arrowStyle: styleOptions.arrowStyle,
				shadow: styleOptions.shadow,
				shadowColor: styleOptions.shadowColor,
				shadowBlur: styleOptions.shadowBlur,
				shadowOffsetX: styleOptions.shadowOffsetX,
				shadowOffsetY: styleOptions.shadowOffsetY
			} );
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

		// Tool selection - tracked for cleanup
		this.addListener( this.container, 'click', ( e ) => {
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
		this.addListener( this.container, 'keydown', ( e ) => {
			if ( e.target.classList && e.target.classList.contains( 'tool-button' ) && ( e.key === 'Enter' || e.key === ' ' ) ) {
				e.preventDefault();
				self.selectTool( e.target.dataset.tool );
			}
		} );

		// Save/Cancel buttons - tracked for cleanup
		this.addListener( this.saveButton, 'click', () => {
			self.editor.save();
		} );

		this.addListener( this.cancelButton, 'click', () => {
			self.editor.cancel( true );
		} );

		// Import JSON - delegate to ImportExportManager
		this.addListener( this.importButton, 'click', () => {
			self.importInput.click();
		} );

		this.addListener( this.importInput, 'change', function () {
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
		this.addListener( this.exportButton, 'click', () => {
			if ( self.importExportManager ) {
				self.importExportManager.exportToFile();
			}
		} );

		// Style controls are handled by ToolbarStyleControls module

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
		// Delegate to style controls module
		if ( this.styleControls ) {
			this.styleControls.updateForTool( toolId );
		}
	};

	Toolbar.prototype.updateStyleOptions = function () {
		// Delegate to style controls module and propagate to editor
		if ( this.styleControls ) {
			const styleOptions = this.styleControls.getStyleOptions();
			this.onStyleChange( styleOptions );
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
