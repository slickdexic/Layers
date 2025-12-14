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

	// Use shared namespace helper (loaded via utils/NamespaceHelper.js)
	const getClass = ( window.Layers && window.Layers.Utils && window.Layers.Utils.getClass ) ||
		window.layersGetClass ||
		function ( namespacePath, globalName ) {
			// Minimal fallback
			return window[ globalName ] || null;
		};

	/**
	 * Toolbar class
	 *
	 * @class Toolbar
	 */
	class Toolbar {
		/**
		 * Create a new Toolbar instance
		 *
		 * @param {Object} config Configuration object
		 * @param {HTMLElement} config.container The container element for the toolbar
		 * @param {window.LayersEditor} config.editor A reference to the main editor instance
		 */
		constructor( config ) {
			this.config = config || {};
			this.container = this.config.container;
			this.editor = this.config.editor;
			this.currentTool = 'pointer';

			// Debug logging removed - use mw.config.get('wgLayersDebug') if needed

			// Get dependencies at construction time (lazy resolution for testability)
			const LayersValidator = getClass( 'Validation.Validator', 'LayersValidator' );
			const EventTracker = getClass( 'Utils.EventTracker', 'EventTracker' );
			const ImportExportManager = getClass( 'Core.ImportExportManager', 'ImportExportManager' );

			// Initialize validator for real-time input validation
			this.validator = LayersValidator ? new LayersValidator() : null;
			this.dialogCleanups = [];

			// Initialize EventTracker for memory-safe event listener management
			this.eventTracker = EventTracker ? new EventTracker() : null;
			this.keyboardShortcutHandler = null;

			// Initialize import/export manager
			this.importExportManager = ImportExportManager ?
				new ImportExportManager( { editor: this.editor } ) : null;

			// Initialize style controls manager
			this.styleControls = null;

			this.init();
		}

		addDocumentListener( event, handler, options ) {
			if ( !event || typeof handler !== 'function' ) {
				return;
			}
			if ( this.eventTracker ) {
				this.eventTracker.add( document, event, handler, options );
			} else {
				// Fallback if EventTracker not available
				document.addEventListener( event, handler, options );
			}
		}

		/**
		 * Add event listener to a specific element with automatic tracking
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

		removeAllListeners() {
			if ( this.eventTracker ) {
				this.eventTracker.destroy();
			}
		}

		registerDialogCleanup( cleanupFn ) {
			if ( typeof cleanupFn === 'function' ) {
				this.dialogCleanups.push( cleanupFn );
			}
		}

		runDialogCleanups() {
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
		}

		destroy() {
			this.runDialogCleanups();
			this.removeAllListeners();
			this.keyboardShortcutHandler = null;
			this.dialogCleanups = [];
			this.eventTracker = null;
			if ( this.styleControls ) {
				this.styleControls.destroy();
				this.styleControls = null;
			}
		}

		init() {
			this.createInterface();
			this.setupEventHandlers();

			// Set default tool
			this.selectTool( 'pointer' );
		}

		// Show a modal color picker dialog near an anchor button
		// Uses ui/ColorPickerDialog module
		openColorPickerDialog( anchorButton, initialValue, options ) {
			options = options || {};
			const colorPickerStrings = this.getColorPickerStrings();

			const ColorPickerDialog = getClass( 'UI.ColorPickerDialog', 'ColorPickerDialog' );
			if ( !ColorPickerDialog ) {
				// Fallback: ColorPickerDialog module not loaded
				return;
			}

			const picker = new ColorPickerDialog( {
				currentColor: ( initialValue === 'none' ) ? 'none' : ( initialValue || '#000000' ),
				anchorElement: anchorButton,
				strings: colorPickerStrings,
				registerCleanup: ( fn ) => {
					this.registerDialogCleanup( fn );
				},
				onApply: options.onApply || function () {},
				onCancel: options.onCancel || function () {}
			} );

			picker.open();
		}

		// Update color button display - uses ColorPickerDialog static method
		updateColorButtonDisplay( btn, color, transparentLabel, previewTemplate ) {
			const ColorPickerDialog = getClass( 'UI.ColorPickerDialog', 'ColorPickerDialog' );
			if ( ColorPickerDialog && ColorPickerDialog.updateColorButton ) {
				const strings = this.getColorPickerStrings();
				if ( transparentLabel ) {
					strings.transparent = transparentLabel;
				}
				if ( previewTemplate ) {
					strings.previewTemplate = previewTemplate;
				}
				ColorPickerDialog.updateColorButton( btn, color, strings );
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
		}

		// Get color picker strings
		getColorPickerStrings() {
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
		}

		/**
		 * Resolve i18n text safely, delegating to MessageHelper
		 *
		 * @param {string} key - Message key
		 * @param {string} fallback - Fallback text if message not found
		 * @return {string} Localized message or fallback
		 */
		msg( key, fallback ) {
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
		}

	/**
		 * Get SVG icons for toolbar tools
		 * Icons follow industry standards (Figma, Adobe, etc.)
		 *
		 * @return {Object} Object containing SVG icon strings for each tool
		 */
		getToolIcons() {
			const size = 24;
			const stroke = 'currentColor';
			const fill = 'none';
			const strokeWidth = 2;

			return {
				// Select/Pointer tool - Mouse cursor arrow (industry standard)
				pointer: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
				<path d="M13 13l6 6"/>
			</svg>`,

				// Text tool - Bold T character
				text: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="4 7 4 4 20 4 20 7"/>
				<line x1="9" y1="20" x2="15" y2="20"/>
				<line x1="12" y1="4" x2="12" y2="20"/>
			</svg>`,

				// Pen tool - Pen nib (Bezier curve tool standard)
				pen: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 19l7-7 3 3-7 7-3-3z"/>
				<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
				<path d="M2 2l7.586 7.586"/>
				<circle cx="11" cy="11" r="2"/>
			</svg>`,

				// Rectangle tool - Rectangle shape
				rectangle: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
			</svg>`,

				// Circle tool - Perfect circle
				circle: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="9"/>
			</svg>`,

				// Ellipse tool - Oval/ellipse shape
				ellipse: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<ellipse cx="12" cy="12" rx="10" ry="6"/>
			</svg>`,

				// Polygon tool - Pentagon shape
				polygon: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<polygon points="12 2 22 9 18.5 21 5.5 21 2 9 12 2"/>
			</svg>`,

				// Star tool - 5-pointed star
				star: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
			</svg>`,

				// Arrow tool - Annotation arrow (distinct from pointer)
				arrow: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<line x1="5" y1="19" x2="19" y2="5"/>
				<polyline points="12 5 19 5 19 12"/>
			</svg>`,

				// Line tool - Diagonal line
				line: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<line x1="5" y1="19" x2="19" y2="5"/>
			</svg>`,

				// Blur/Redact tool - Pixelated/mosaic pattern
				blur: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="3" width="7" height="7"/>
				<rect x="14" y="3" width="7" height="7"/>
				<rect x="14" y="14" width="7" height="7"/>
				<rect x="3" y="14" width="7" height="7"/>
			</svg>`
			};
		}

		createInterface() {
			this.container.innerHTML = '';
			this.container.className = 'layers-toolbar';
			this.container.setAttribute( 'role', 'toolbar' );
			this.container.setAttribute( 'aria-label', this.msg( 'layers-toolbar-title', 'Toolbar' ) );

			// Create tool groups
			this.createToolGroup();
			this.createStyleGroup();
			this.createZoomGroup();
			this.createActionGroup();
		}

		/**
		 * Get SVG icons for zoom and action buttons
		 *
		 * @return {Object} Object containing SVG icon strings
		 */
		getActionIcons() {
			const size = 24;
			const stroke = 'currentColor';
			const fill = 'none';
			const strokeWidth = 2;

			return {
				// Undo - Curved arrow pointing left/back
				undo: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="1 4 1 10 7 10"/>
				<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
			</svg>`,

				// Redo - Curved arrow pointing right/forward
				redo: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="23 4 23 10 17 10"/>
				<path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
			</svg>`,

				// Duplicate - Two overlapping squares
				duplicate: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
				<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
			</svg>`,

				// Zoom in - Magnifying glass with plus
				zoomIn: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="11" cy="11" r="8"/>
				<line x1="21" y1="21" x2="16.65" y2="16.65"/>
				<line x1="11" y1="8" x2="11" y2="14"/>
				<line x1="8" y1="11" x2="14" y2="11"/>
			</svg>`,

				// Zoom out - Magnifying glass with minus
				zoomOut: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="11" cy="11" r="8"/>
				<line x1="21" y1="21" x2="16.65" y2="16.65"/>
				<line x1="8" y1="11" x2="14" y2="11"/>
			</svg>`,

				// Fit to window - Expand arrows
				fitWindow: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="15 3 21 3 21 9"/>
				<polyline points="9 21 3 21 3 15"/>
				<line x1="21" y1="3" x2="14" y2="10"/>
				<line x1="3" y1="21" x2="10" y2="14"/>
			</svg>`
			};
		}

		createToolGroup() {
			const toolGroup = document.createElement( 'div' );
			toolGroup.className = 'toolbar-group tools-group';
			const t = this.msg.bind( this );

			// SVG icons following industry standards (Figma, Adobe, etc.)
			const icons = this.getToolIcons();
			const tools = [
				{ id: 'pointer', icon: icons.pointer, title: t( 'layers-tool-select', 'Select Tool' ), key: 'V', isSvg: true },
				{ id: 'text', icon: icons.text, title: t( 'layers-tool-text', 'Text Tool' ), key: 'T', isSvg: true },
				{ id: 'pen', icon: icons.pen, title: t( 'layers-tool-pen', 'Pen Tool' ), key: 'P', isSvg: true },
				{ id: 'rectangle', icon: icons.rectangle, title: t( 'layers-tool-rectangle', 'Rectangle Tool' ), key: 'R', isSvg: true },
				{ id: 'circle', icon: icons.circle, title: t( 'layers-tool-circle', 'Circle Tool' ), key: 'C', isSvg: true },
				{ id: 'ellipse', icon: icons.ellipse, title: t( 'layers-tool-ellipse', 'Ellipse Tool' ), key: 'E', isSvg: true },
				{ id: 'polygon', icon: icons.polygon, title: t( 'layers-tool-polygon', 'Polygon Tool' ), key: 'G', isSvg: true },
				{ id: 'star', icon: icons.star, title: t( 'layers-tool-star', 'Star Tool' ), key: 'S', isSvg: true },
				{ id: 'arrow', icon: icons.arrow, title: t( 'layers-tool-arrow', 'Arrow Tool' ), key: 'A', isSvg: true },
				{ id: 'line', icon: icons.line, title: t( 'layers-tool-line', 'Line Tool' ), key: 'L', isSvg: true },
				{ id: 'blur', icon: icons.blur, title: t( 'layers-tool-blur', 'Blur/Redact Tool' ), key: 'B', isSvg: true }
			];

			tools.forEach( ( tool ) => {
				const button = this.createToolButton( tool );
				toolGroup.appendChild( button );
			} );

			this.container.appendChild( toolGroup );
		}

		createToolButton( tool ) {
			const button = document.createElement( 'button' );
			button.className = 'toolbar-button tool-button';
			button.dataset.tool = tool.id;
			// Use innerHTML for SVG icons, textContent for text glyphs
			if ( tool.isSvg ) {
				button.innerHTML = tool.icon;
			} else {
				button.textContent = tool.icon;
			}
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
		}

		createStyleGroup() {
			// Initialize style controls manager
			const ToolbarStyleControls = getClass( 'UI.ToolbarStyleControls', 'ToolbarStyleControls' );
			if ( ToolbarStyleControls ) {
				this.styleControls = new ToolbarStyleControls( {
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
				styleGroup.textContent = this.msg( 'layers-prop-stroke-color', 'Style controls loading...' );
				this.container.appendChild( styleGroup );
			}
		}

		/**
		 * Handle style change notifications from ToolbarStyleControls
		 *
		 * @param {Object} styleOptions The new style options
		 */
		onStyleChange( styleOptions ) {
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
		}

		// Effects group removed; moved to LayerPanel Properties

		createZoomGroup() {
			const zoomGroup = document.createElement( 'div' );
			zoomGroup.className = 'toolbar-group zoom-group';
			const t2 = this.msg.bind( this );
			const icons = this.getActionIcons();

			// Zoom out button
			const zoomOutBtn = document.createElement( 'button' );
			zoomOutBtn.className = 'toolbar-button zoom-button';
			zoomOutBtn.innerHTML = icons.zoomOut;
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
			zoomInBtn.innerHTML = icons.zoomIn;
			zoomInBtn.title = t2( 'layers-zoom-in', 'Zoom In' ) + ' (Ctrl++)';
			zoomInBtn.dataset.action = 'zoom-in';

			// Fit to window button
			const fitBtn = document.createElement( 'button' );
			fitBtn.className = 'toolbar-button fit-button';
			fitBtn.innerHTML = icons.fitWindow;
			fitBtn.title = t2( 'layers-zoom-fit', 'Fit to Window' );
			fitBtn.dataset.action = 'fit-window';

			zoomGroup.appendChild( zoomOutBtn );
			zoomGroup.appendChild( zoomDisplay );
			zoomGroup.appendChild( zoomInBtn );
			zoomGroup.appendChild( fitBtn );

			this.container.appendChild( zoomGroup );

			// Store references
			this.zoomDisplay = zoomDisplay;
		}

		createActionGroup() {
			const actionGroup = document.createElement( 'div' );
			actionGroup.className = 'toolbar-group action-group';
			const t = this.msg.bind( this );
			const icons = this.getActionIcons();

			const actions = [
				{ id: 'undo', icon: icons.undo, title: t( 'layers-undo', 'Undo' ), key: 'Ctrl+Z', isSvg: true },
				{ id: 'redo', icon: icons.redo, title: t( 'layers-redo', 'Redo' ), key: 'Ctrl+Y', isSvg: true },
				{ id: 'duplicate', icon: icons.duplicate, title: t( 'layers-duplicate-selected', 'Duplicate Selected' ), key: 'Ctrl+D', isSvg: true }
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

		// Export as Image button (saves annotated image as PNG)
		const exportImageButton = document.createElement( 'button' );
		exportImageButton.className = 'toolbar-button export-image-button';
		exportImageButton.textContent = t( 'layers-export-image', 'Export as Image' );
		exportImageButton.title = t( 'layers-export-image-tooltip', 'Download the image with annotations' );
		exportImageButton.setAttribute( 'aria-label', t( 'layers-export-image', 'Export as Image' ) );
		actionGroup.appendChild( exportImageButton );

		// Separator before save/help
		const separator2 = document.createElement( 'div' );
		separator2.className = 'toolbar-separator';
		actionGroup.appendChild( separator2 );

		// Help button for keyboard shortcuts
		const helpButton = document.createElement( 'button' );
		helpButton.className = 'toolbar-button help-button';
		helpButton.textContent = '?';
		helpButton.title = t( 'layers-keyboard-shortcuts', 'Keyboard Shortcuts' ) + ' (Shift+?)';
		helpButton.setAttribute( 'aria-label', t( 'layers-keyboard-shortcuts', 'Keyboard Shortcuts' ) );
		helpButton.dataset.action = 'show-shortcuts';
		actionGroup.appendChild( helpButton );

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
		this.exportImageButton = exportImageButton;
	}

	createActionButton( action ) {
		const button = document.createElement( 'button' );
		button.className = 'toolbar-button action-button';
		button.dataset.action = action.id;
		// Use innerHTML for SVG icons, textContent for text
		if ( action.isSvg ) {
			button.innerHTML = action.icon;
		} else {
			button.textContent = action.icon;
		}
		button.title = action.title + ( action.key ? ' (' + action.key + ')' : '' );

		// Mark common toggle actions as toggle buttons
		if ( [ 'grid', 'rulers', 'guides', 'snap-grid', 'snap-guides' ].includes( action.id ) ) {
			button.setAttribute( 'aria-pressed', 'false' );
		}

		return button;
	}

	setupEventHandlers() {
		// Tool selection - tracked for cleanup
		this.addListener( this.container, 'click', ( e ) => {
			// Use closest() to handle clicks on child elements (like SVG icons inside buttons)
			const toolButton = e.target.closest( '.tool-button' );
			const actionButton = e.target.closest( '.action-button' );
			const helpButton = e.target.closest( '.help-button' );
			const zoomButton = e.target.closest( '[data-action^="zoom"]' );
			const fitButton = e.target.closest( '[data-action="fit-window"]' );

			if ( toolButton ) {
				this.selectTool( toolButton.dataset.tool );
			} else if ( actionButton ) {
				this.executeAction( actionButton.dataset.action );
			} else if ( helpButton ) {
				this.executeAction( helpButton.dataset.action );
			} else if ( zoomButton ) {
				this.executeZoomAction( zoomButton.dataset.action );
			} else if ( fitButton ) {
				this.executeZoomAction( fitButton.dataset.action );
			}
		} );

		// Also support keyboard navigation on tool buttons for accessibility
		this.addListener( this.container, 'keydown', ( e ) => {
			if ( e.target.classList && e.target.classList.contains( 'tool-button' ) && ( e.key === 'Enter' || e.key === ' ' ) ) {
				e.preventDefault();
				this.selectTool( e.target.dataset.tool );
			}
		} );

		// Save/Cancel buttons - tracked for cleanup
		this.addListener( this.saveButton, 'click', () => {
			this.editor.save();
		} );

		this.addListener( this.cancelButton, 'click', () => {
			this.editor.cancel( true );
		} );

		// Import JSON - delegate to ImportExportManager
		this.addListener( this.importButton, 'click', () => {
			this.importInput.click();
		} );

		this.addListener( this.importInput, 'change', () => {
			const file = this.importInput.files && this.importInput.files[ 0 ];
			if ( !file ) {
				return;
			}
			if ( this.importExportManager ) {
				this.importExportManager.importFromFile( file )
					.catch( () => {
						// Error already handled by ImportExportManager
					} )
					.finally( () => {
						this.importInput.value = '';
					} );
			} else {
				// Fallback: ImportExportManager not available
				this.importInput.value = '';
			}
		} );

		// Export JSON - delegate to ImportExportManager
		this.addListener( this.exportButton, 'click', () => {
			if ( this.importExportManager ) {
				this.importExportManager.exportToFile();
			}
		} );

		// Export as Image - render and download annotated image
		this.addListener( this.exportImageButton, 'click', () => {
			if ( this.editor && this.editor.apiManager &&
				typeof this.editor.apiManager.downloadAsImage === 'function' ) {
				this.editor.apiManager.downloadAsImage( { format: 'png' } );
			}
		} );

		// Style controls are handled by ToolbarStyleControls module

		// Keyboard shortcuts - delegate to ToolbarKeyboard module
		const ToolbarKeyboard = getClass( 'UI.ToolbarKeyboard', 'ToolbarKeyboard' );
		this.keyboardHandler = new ToolbarKeyboard( this );
		this.keyboardShortcutHandler = ( e ) => {
			this.keyboardHandler.handleKeyboardShortcuts( e );
		};
		this.addDocumentListener( 'keydown', this.keyboardShortcutHandler );

		// Layer-level effects removed: opacity, blend, toggles are in Properties panel
	}

	selectTool( toolId ) {
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
	}

	/**
	 * Set the active tool programmatically (called by LayersEditor)
	 *
	 * @param {string} toolId - The tool identifier to activate
	 */
	setActiveTool( toolId ) {
		if ( this.currentTool === toolId ) {
			return;
		}
		this.selectTool( toolId );
	}

	updateToolOptions( toolId ) {
		// Delegate to style controls module
		if ( this.styleControls ) {
			this.styleControls.updateForTool( toolId );
		}
	}

	updateStyleOptions() {
		// Delegate to style controls module and propagate to editor
		if ( this.styleControls ) {
			const styleOptions = this.styleControls.getStyleOptions();
			this.onStyleChange( styleOptions );
		}
	}

	// Removed legacy none buttons; transparent selection is integrated in the color dialog

	executeAction( actionId ) {
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
			case 'show-shortcuts':
				this.editor.showKeyboardShortcutsDialog();
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
	}

	toggleButtonState( id ) {
		const btn = this.container.querySelector( '[data-action="' + id + '"]' );
		if ( btn ) {
			btn.classList.toggle( 'active' );
			if ( btn.hasAttribute( 'aria-pressed' ) ) {
				const pressed = btn.getAttribute( 'aria-pressed' ) === 'true';
				btn.setAttribute( 'aria-pressed', pressed ? 'false' : 'true' );
			}
		}
	}

	toggleGrid() {
		if ( this.editor.canvasManager ) {
			this.editor.canvasManager.toggleGrid();
		}

		// Update button state
		const gridButton = this.container.querySelector( '[data-action="grid"]' );
		if ( gridButton ) {
			gridButton.classList.toggle( 'active' );
		}
	}

	executeZoomAction( actionId ) {
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
	}

	updateZoomDisplay( zoomPercent ) {
		if ( this.zoomDisplay ) {
			this.zoomDisplay.textContent = zoomPercent + '%';
			this.zoomDisplay.setAttribute( 'aria-label', this.msg( 'layers-status-zoom', 'Zoom' ) + ': ' + zoomPercent + '%' );
		}
	}

	/**
	 * @deprecated Use ToolbarKeyboard.handleKeyboardShortcuts instead.
	 * Kept for backward compatibility - delegates to ToolbarKeyboard module.
	 *
	 * @param {Event} e - The keyboard event
	 */
	handleKeyboardShortcuts( e ) {
		if ( this.keyboardHandler ) {
			this.keyboardHandler.handleKeyboardShortcuts( e );
		}
	}

	updateUndoRedoState( canUndo, canRedo ) {
		const undoButton = this.container.querySelector( '[data-action="undo"]' );
		const redoButton = this.container.querySelector( '[data-action="redo"]' );

		if ( undoButton ) {
			undoButton.disabled = !canUndo;
		}

		if ( redoButton ) {
			redoButton.disabled = !canRedo;
		}
	}

	updateDeleteState( hasSelection ) {
		const deleteButton = this.container.querySelector( '[data-action="delete"]' );
		const duplicateButton = this.container.querySelector( '[data-action="duplicate"]' );

		if ( deleteButton ) {
			deleteButton.disabled = !hasSelection;
		}

		if ( duplicateButton ) {
			duplicateButton.disabled = !hasSelection;
		}
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.Toolbar = Toolbar;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = Toolbar;
	}

}() );
