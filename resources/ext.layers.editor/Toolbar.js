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

		/**
		 * Handle importing an image file as a layer
		 *
		 * @param {File} file - The image file to import
		 * @return {Promise<void>}
		 */
		async handleImageImport( file ) {
			// Validate file size using configurable limit (default 1MB)
			const maxSize = ( typeof mw !== 'undefined' && mw.config ) ?
				mw.config.get( 'wgLayersMaxImageBytes', 1048576 ) : 1048576;
			const maxSizeKB = Math.round( maxSize / 1024 );
			if ( file.size > maxSize ) {
				mw.notify(
					this.msg( 'layers-import-image-too-large', 'Image file is too large' ) + ` (max ${maxSizeKB}KB)`,
					{ type: 'error' }
				);
				return;
			}

			// Validate file type
			const allowedTypes = [ 'image/png', 'image/jpeg', 'image/gif', 'image/webp' ];
			if ( !allowedTypes.includes( file.type ) ) {
				mw.notify(
					this.msg( 'layers-import-image-invalid-type', 'Invalid image type. Allowed: PNG, JPEG, GIF, WebP' ),
					{ type: 'error' }
				);
				return;
			}

			try {
				// Read file as base64 data URL
				const dataUrl = await this.readFileAsDataURL( file );

				// Load image to get dimensions
				const img = await this.loadImage( dataUrl );

				// Create a new image layer
				const layer = {
					id: 'image-' + Date.now() + '-' + Math.random().toString( 36 ).slice( 2, 9 ),
					type: 'image',
					name: file.name.replace( /\.[^.]+$/, '' ),
					src: dataUrl,
					x: 50,
					y: 50,
					width: img.naturalWidth,
					height: img.naturalHeight,
					originalWidth: img.naturalWidth,
					originalHeight: img.naturalHeight,
					opacity: 1,
					rotation: 0,
					visible: true,
					locked: false,
					preserveAspectRatio: true
				};

				// Add the layer via the editor's state management
				if ( this.editor && this.editor.stateManager ) {
					this.editor.stateManager.addLayer( layer );
					// Save to undo/redo history
					if ( typeof this.editor.saveState === 'function' ) {
						this.editor.saveState( 'Import image layer' );
					}
					// Trigger a redraw
					if ( this.editor.canvasManager ) {
						this.editor.canvasManager.redraw();
					}
				}
			} catch ( error ) {
				if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
					mw.log.error( '[Toolbar] Failed to import image:', error );
				}
				mw.notify(
					this.msg( 'layers-import-image-failed', 'Failed to import image' ),
					{ type: 'error' }
				);
			}
		}

		/**
		 * Read a file as a data URL
		 *
		 * @param {File} file - File to read
		 * @return {Promise<string>} - Data URL string
		 */
		readFileAsDataURL( file ) {
			return new Promise( ( resolve, reject ) => {
				const reader = new FileReader();
				reader.onload = () => resolve( reader.result );
				reader.onerror = () => reject( reader.error );
				reader.readAsDataURL( file );
			} );
		}

		/**
		 * Load an image from a source URL
		 *
		 * @param {string} src - Image source (data URL or regular URL)
		 * @return {Promise<HTMLImageElement>} - Loaded image element
		 */
		loadImage( src ) {
			return new Promise( ( resolve, reject ) => {
				const img = new Image();
				img.onload = () => resolve( img );
				img.onerror = () => reject( new Error( 'Failed to load image' ) );
				img.src = src;
			} );
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

		/**
		 * Get color picker strings for i18n
		 * Delegates to MessageHelper singleton for shared i18n strings
		 *
		 * @return {Object} Color picker string map
		 */
		getColorPickerStrings() {
			// Use shared MessageHelper singleton if available
			if ( typeof window !== 'undefined' && window.layersMessages &&
				typeof window.layersMessages.getColorPickerStrings === 'function' ) {
				return window.layersMessages.getColorPickerStrings();
			}
			// Fallback to local implementation
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

				// Text Box tool - Rectangle with text lines
				textbox: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
				<line x1="7" y1="8" x2="17" y2="8"/>
				<line x1="7" y1="12" x2="17" y2="12"/>
				<line x1="7" y1="16" x2="12" y2="16"/>
			</svg>`,

				// Callout/Chat Bubble tool - Speech bubble with tail
				callout: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
			</svg>`,

				// Number Marker tool - Circled number with optional arrow
				marker: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="10" r="7"/>
				<text x="12" y="13" font-size="9" font-weight="bold" text-anchor="middle" fill="${stroke}" stroke="none">1</text>
				<line x1="12" y1="17" x2="12" y2="22" stroke="${stroke}"/>
				<polyline points="9,19 12,22 15,19" stroke="${stroke}" fill="none"/>
			</svg>`,

				// Dimension tool - Measurement line with extension lines
				dimension: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<line x1="4" y1="12" x2="20" y2="12"/>
				<line x1="4" y1="8" x2="4" y2="16"/>
				<line x1="20" y1="8" x2="20" y2="16"/>
				<polyline points="7,10 4,12 7,14" fill="none"/>
				<polyline points="17,10 20,12 17,14" fill="none"/>
				<text x="12" y="9" font-size="6" text-anchor="middle" fill="${stroke}" stroke="none">50</text>
			</svg>`,

				// Custom Shape Library - Grid of shapes
				customShapes: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="3" width="7" height="7"/>
				<rect x="14" y="3" width="7" height="7"/>
				<polygon points="6.5 21 3 14 10 14 6.5 21"/>
				<circle cx="17.5" cy="17.5" r="3.5"/>
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
			this.createAlignmentGroup();
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
			</svg>`,

				// Import Layers - Folder with arrow up (upload/load file into editor)
				importLayers: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
				<line x1="12" y1="17" x2="12" y2="11"/>
				<polyline points="9 14 12 11 15 14"/>
			</svg>`,

				// Export Layers - Folder with arrow down (download/save file from editor)
				exportLayers: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
				<line x1="12" y1="11" x2="12" y2="17"/>
				<polyline points="9 14 12 17 15 14"/>
			</svg>`,

				// Export Image - Download/save icon (arrow down into tray)
				exportImage: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
				<polyline points="7 10 12 15 17 10"/>
				<line x1="12" y1="15" x2="12" y2="3"/>
			</svg>`,

				// Import Image - Image icon with plus badge (add image layer)
				importImage: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
				<rect x="2" y="2" width="16" height="16" rx="2" ry="2"/>
				<circle cx="7" cy="7" r="1.5"/>
				<path d="M18 14l-4-4-8 8"/>
				<circle cx="18" cy="18" r="5" fill="currentColor" stroke="none"/>
				<line x1="18" y1="15.5" x2="18" y2="20.5" stroke="white" stroke-width="2"/>
				<line x1="15.5" y1="18" x2="20.5" y2="18" stroke="white" stroke-width="2"/>
			</svg>`
			};
		}

		createToolGroup() {
			const toolGroup = document.createElement( 'div' );
			toolGroup.className = 'toolbar-group tools-group';
			const t = this.msg.bind( this );

			// SVG icons following industry standards (Figma, Adobe, etc.)
			const icons = this.getToolIcons();

			// Tool definitions with grouping information
			// Standalone tools are rendered as individual buttons
			// Grouped tools are rendered in dropdown menus
			const standAloneTools = [
				{ id: 'pointer', icon: icons.pointer, title: t( 'layers-tool-select', 'Select Tool' ), key: 'V', isSvg: true }
			];

			// Text tools group
			const textTools = [
				{ id: 'text', icon: icons.text, title: t( 'layers-tool-text', 'Text Tool' ), key: 'T', isSvg: true },
				{ id: 'textbox', icon: icons.textbox, title: t( 'layers-tool-textbox', 'Text Box Tool' ), key: 'X', isSvg: true },
				{ id: 'callout', icon: icons.callout, title: t( 'layers-tool-callout', 'Callout Tool' ), key: 'B', isSvg: true }
			];

			// Annotation tools group (markers, dimensions)
			const annotationTools = [
				{ id: 'marker', icon: icons.marker, title: t( 'layers-tool-marker', 'Marker Tool' ), key: 'M', isSvg: true },
				{ id: 'dimension', icon: icons.dimension, title: t( 'layers-tool-dimension', 'Dimension Tool' ), key: 'D', isSvg: true }
			];

			// Shape tools group
			const shapeTools = [
				{ id: 'rectangle', icon: icons.rectangle, title: t( 'layers-tool-rectangle', 'Rectangle Tool' ), key: 'R', isSvg: true },
				{ id: 'circle', icon: icons.circle, title: t( 'layers-tool-circle', 'Circle Tool' ), key: 'C', isSvg: true },
				{ id: 'ellipse', icon: icons.ellipse, title: t( 'layers-tool-ellipse', 'Ellipse Tool' ), key: 'E', isSvg: true },
				{ id: 'polygon', icon: icons.polygon, title: t( 'layers-tool-polygon', 'Polygon Tool' ), key: 'Y', isSvg: true },
				{ id: 'star', icon: icons.star, title: t( 'layers-tool-star', 'Star Tool' ), key: 'S', isSvg: true }
			];

			// Line tools group
			const lineTools = [
				{ id: 'arrow', icon: icons.arrow, title: t( 'layers-tool-arrow', 'Arrow Tool' ), key: 'A', isSvg: true },
				{ id: 'line', icon: icons.line, title: t( 'layers-tool-line', 'Line Tool' ), key: 'L', isSvg: true }
			];

			// Additional standalone tools
			const additionalTools = [
				{ id: 'pen', icon: icons.pen, title: t( 'layers-tool-pen', 'Pen Tool' ), key: 'P', isSvg: true }
			];

			// Store dropdown references for managing active states
			this.toolDropdowns = [];

			// Get ToolDropdown class
			const ToolDropdown = getClass( 'UI.ToolDropdown', 'ToolDropdown' );

			// Render standalone tools (pointer)
			standAloneTools.forEach( ( tool ) => {
				const button = this.createToolButton( tool );
				toolGroup.appendChild( button );
			} );

			// Create Text dropdown
			if ( ToolDropdown ) {
				const textDropdown = new ToolDropdown( {
					groupId: 'text',
					groupLabel: t( 'layers-tool-group-text', 'Text Tools' ),
					tools: textTools,
					defaultTool: 'text',
					onToolSelect: ( toolId ) => this.selectTool( toolId ),
					msg: t
				} );
				toolGroup.appendChild( textDropdown.create() );
				this.toolDropdowns.push( textDropdown );
			} else {
				// Fallback: render as individual buttons
				textTools.forEach( ( tool ) => {
					toolGroup.appendChild( this.createToolButton( tool ) );
				} );
			}

			// Create Shapes dropdown
			if ( ToolDropdown ) {
				const shapesDropdown = new ToolDropdown( {
					groupId: 'shapes',
					groupLabel: t( 'layers-tool-group-shapes', 'Shape Tools' ),
					tools: shapeTools,
					defaultTool: 'rectangle',
					onToolSelect: ( toolId ) => this.selectTool( toolId ),
					msg: t
				} );
				toolGroup.appendChild( shapesDropdown.create() );
				this.toolDropdowns.push( shapesDropdown );
			} else {
				// Fallback: render as individual buttons
				shapeTools.forEach( ( tool ) => {
					toolGroup.appendChild( this.createToolButton( tool ) );
				} );
			}

			// Create Lines dropdown
			if ( ToolDropdown ) {
				const linesDropdown = new ToolDropdown( {
					groupId: 'lines',
					groupLabel: t( 'layers-tool-group-lines', 'Line Tools' ),
					tools: lineTools,
					defaultTool: 'arrow',
					onToolSelect: ( toolId ) => this.selectTool( toolId ),
					msg: t
				} );
				toolGroup.appendChild( linesDropdown.create() );
				this.toolDropdowns.push( linesDropdown );
			} else {
				// Fallback: render as individual buttons
				lineTools.forEach( ( tool ) => {
					toolGroup.appendChild( this.createToolButton( tool ) );
				} );
			}

			// Create Annotation dropdown (markers, dimensions)
			if ( ToolDropdown ) {
				const annotationDropdown = new ToolDropdown( {
					groupId: 'annotation',
					groupLabel: t( 'layers-tool-group-annotation', 'Annotation Tools' ),
					tools: annotationTools,
					defaultTool: 'marker',
					onToolSelect: ( toolId ) => this.selectTool( toolId ),
					msg: t
				} );
				toolGroup.appendChild( annotationDropdown.create() );
				this.toolDropdowns.push( annotationDropdown );
			} else {
				// Fallback: render as individual buttons
				annotationTools.forEach( ( tool ) => {
					toolGroup.appendChild( this.createToolButton( tool ) );
				} );
			}

			// Render additional standalone tools (pen, blur)
			additionalTools.forEach( ( tool ) => {
				const button = this.createToolButton( tool );
				toolGroup.appendChild( button );
			} );

			// Add Shape Library button
			const shapeLibraryBtn = this.createShapeLibraryButton();
			if ( shapeLibraryBtn ) {
				toolGroup.appendChild( shapeLibraryBtn );
			}

			// Add Emoji Picker button
			const emojiBtn = this.createEmojiPickerButton();
			if ( emojiBtn ) {
				toolGroup.appendChild( emojiBtn );
			}

			this.container.appendChild( toolGroup );
		}

		/**
		 * Create the shape library button
		 *
		 * @return {HTMLElement|null} The button element or null if library not available
		 */
		createShapeLibraryButton() {
			const t = this.msg.bind( this );

			const button = document.createElement( 'button' );
			button.className = 'toolbar-button shape-library-button';
			button.type = 'button';
			button.title = t( 'layers-shape-library-tooltip', 'Insert a shape from the library' );
			button.setAttribute( 'aria-label', t( 'layers-shape-library-button', 'Shape Library' ) );

			// Use a grid/library icon
			button.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">' +
				'<rect x="3" y="3" width="7" height="7" rx="1"/>' +
				'<rect x="14" y="3" width="7" height="7" rx="1"/>' +
				'<rect x="3" y="14" width="7" height="7" rx="1"/>' +
				'<rect x="14" y="14" width="7" height="7" rx="1"/>' +
				'</svg>';

			button.addEventListener( 'click', () => {
				this.openShapeLibrary();
			} );

			return button;
		}

		/**
		 * Open the shape library panel
		 */
		openShapeLibrary() {
			// Load the shape library module if not already loaded
			mw.loader.using( 'ext.layers.shapeLibrary' ).then( () => {
				if ( !window.Layers || !window.Layers.ShapeLibraryPanel ) {
					mw.log.error( 'Shape library module not available' );
					return;
				}

				// Create panel if it doesn't exist
				if ( !this.shapeLibraryPanel ) {
					this.shapeLibraryPanel = new window.Layers.ShapeLibraryPanel( {
						onSelect: ( shape ) => {
							this.insertShape( shape );
						}
					} );
				}

				this.shapeLibraryPanel.open();
			} ).catch( ( error ) => {
				mw.log.error( 'Failed to load shape library module:', error );
			} );
		}

		/**
		 * Insert a shape from the library
		 *
		 * @param {Object} shape - Shape data from the library
		 */
		insertShape( shape ) {
			if ( this.editor && typeof this.editor.createCustomShapeLayer === 'function' ) {
				this.editor.createCustomShapeLayer( {
					id: shape.id,
					svg: shape.svg,
					viewBox: shape.viewBox,
					name: shape.name
				} );
			}
		}

		/**
		 * Create the emoji picker button
		 *
		 * @return {HTMLElement|null} The button element
		 */
		createEmojiPickerButton() {
			const t = this.msg.bind( this );

			const button = document.createElement( 'button' );
			button.className = 'toolbar-button emoji-picker-button';
			button.type = 'button';
			button.title = t( 'layers-emoji-picker-tooltip', 'Insert an emoji icon' );
			button.setAttribute( 'aria-label', t( 'layers-emoji-picker-button', 'Emoji' ) );

			// Use a smiley face icon
			button.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">' +
				'<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>' +
				'<circle cx="8" cy="10" r="1.5"/>' +
				'<circle cx="16" cy="10" r="1.5"/>' +
				'<path d="M8 14c1.5 2 6.5 2 8 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
				'</svg>';

			button.addEventListener( 'click', () => {
				this.openEmojiPicker();
			} );

			return button;
		}

		/**
		 * Open the emoji picker panel
		 */
		openEmojiPicker() {
			// Load the emoji picker module if not already loaded
			mw.loader.using( 'ext.layers.emojiPicker' ).then( () => {
				if ( !window.Layers || !window.Layers.EmojiPickerPanel ) {
					mw.log.error( 'Emoji picker module not available' );
					return;
				}

				// Create panel if it doesn't exist
				if ( !this.emojiPickerPanel ) {
					this.emojiPickerPanel = new window.Layers.EmojiPickerPanel( {
						onSelect: ( shape ) => {
							this.insertShape( shape );
						}
					} );
				}

				this.emojiPickerPanel.open();
			} ).catch( ( error ) => {
				mw.log.error( 'Failed to load emoji picker module:', error );
			} );
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

		/**
		 * Get SVG icons for alignment buttons
		 *
		 * @return {Object} Object containing alignment SVG icon strings
		 */
		getAlignmentIcons() {
			const size = 18;
			const stroke = 'currentColor';
			const strokeWidth = 2;

			return {
				alignLeft: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round">
					<line x1="4" y1="4" x2="4" y2="20"/>
					<rect x="4" y="6" width="12" height="4" rx="1"/>
					<rect x="4" y="14" width="8" height="4" rx="1"/>
				</svg>`,
				alignCenterH: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round">
					<line x1="12" y1="4" x2="12" y2="20"/>
					<rect x="6" y="6" width="12" height="4" rx="1"/>
					<rect x="8" y="14" width="8" height="4" rx="1"/>
				</svg>`,
				alignRight: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round">
					<line x1="20" y1="4" x2="20" y2="20"/>
					<rect x="8" y="6" width="12" height="4" rx="1"/>
					<rect x="12" y="14" width="8" height="4" rx="1"/>
				</svg>`,
				alignTop: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round">
					<line x1="4" y1="4" x2="20" y2="4"/>
					<rect x="6" y="4" width="4" height="12" rx="1"/>
					<rect x="14" y="4" width="4" height="8" rx="1"/>
				</svg>`,
				alignCenterV: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round">
					<line x1="4" y1="12" x2="20" y2="12"/>
					<rect x="6" y="6" width="4" height="12" rx="1"/>
					<rect x="14" y="8" width="4" height="8" rx="1"/>
				</svg>`,
				alignBottom: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round">
					<line x1="4" y1="20" x2="20" y2="20"/>
					<rect x="6" y="8" width="4" height="12" rx="1"/>
					<rect x="14" y="12" width="4" height="8" rx="1"/>
				</svg>`,
				distributeH: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round">
					<line x1="4" y1="4" x2="4" y2="20"/>
					<line x1="20" y1="4" x2="20" y2="20"/>
					<rect x="7" y="8" width="4" height="8" rx="1"/>
					<rect x="13" y="8" width="4" height="8" rx="1"/>
				</svg>`,
				distributeV: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round">
					<line x1="4" y1="4" x2="20" y2="4"/>
					<line x1="4" y1="20" x2="20" y2="20"/>
					<rect x="8" y="7" width="8" height="4" rx="1"/>
					<rect x="8" y="13" width="8" height="4" rx="1"/>
				</svg>`
			};
		}

		/**
		 * Create the alignment toolbar group as a dropdown menu
		 * Consolidates 8 buttons into a single dropdown to save toolbar space
		 */
		createAlignmentGroup() {
			const arrangeGroup = document.createElement( 'div' );
			arrangeGroup.className = 'toolbar-group arrange-dropdown-group';

			// Create the dropdown trigger button
			const triggerButton = document.createElement( 'button' );
			triggerButton.className = 'toolbar-button arrange-dropdown-trigger';
			triggerButton.setAttribute( 'aria-haspopup', 'true' );
			triggerButton.setAttribute( 'aria-expanded', 'false' );
			triggerButton.title = this.msg( 'layers-arrange-menu', 'Arrange & Snap' );
			triggerButton.innerHTML = `
				${ this.getArrangeIcon() }
				<span class="dropdown-arrow">▼</span>
			`;

			// Create dropdown menu
			const dropdownMenu = document.createElement( 'div' );
			dropdownMenu.className = 'arrange-dropdown-menu';
			dropdownMenu.setAttribute( 'role', 'menu' );
			dropdownMenu.style.display = 'none';

			const t = this.msg.bind( this );
			const icons = this.getAlignmentIcons();

			// Smart Guides toggle section
			const snapSection = document.createElement( 'div' );
			snapSection.className = 'dropdown-section';
			const snapTitle = document.createElement( 'div' );
			snapTitle.className = 'dropdown-section-title';
			snapTitle.textContent = t( 'layers-snap-options', 'Snap Options' );
			snapSection.appendChild( snapTitle );

			const smartGuidesItem = this.createDropdownToggleItem(
				'smart-guides',
				t( 'layers-smart-guides', 'Smart Guides' ),
				t( 'layers-smart-guides-desc', 'Snap to other objects' ),
				';',
				false // Default off
			);
			snapSection.appendChild( smartGuidesItem );

			const canvasSnapItem = this.createDropdownToggleItem(
				'canvas-snap',
				t( 'layers-canvas-snap', 'Canvas Snap' ),
				t( 'layers-canvas-snap-desc', 'Snap to canvas edges and center' ),
				'\'',
				true // Default on
			);
			snapSection.appendChild( canvasSnapItem );
			dropdownMenu.appendChild( snapSection );

			// Separator
			dropdownMenu.appendChild( this.createDropdownSeparator() );

			// Alignment section
			const alignSection = document.createElement( 'div' );
			alignSection.className = 'dropdown-section';
			const alignTitle = document.createElement( 'div' );
			alignTitle.className = 'dropdown-section-title';
			alignTitle.textContent = t( 'layers-align-section', 'Align (2+ layers)' );
			alignSection.appendChild( alignTitle );

			const alignItems = [
				{ id: 'align-left', icon: icons.alignLeft, label: t( 'layers-align-left', 'Align Left' ) },
				{ id: 'align-center-h', icon: icons.alignCenterH, label: t( 'layers-align-center-h', 'Align Center' ) },
				{ id: 'align-right', icon: icons.alignRight, label: t( 'layers-align-right', 'Align Right' ) },
				{ id: 'align-top', icon: icons.alignTop, label: t( 'layers-align-top', 'Align Top' ) },
				{ id: 'align-center-v', icon: icons.alignCenterV, label: t( 'layers-align-center-v', 'Align Middle' ) },
				{ id: 'align-bottom', icon: icons.alignBottom, label: t( 'layers-align-bottom', 'Align Bottom' ) }
			];

			alignItems.forEach( ( item ) => {
				alignSection.appendChild( this.createDropdownActionItem( item, 'align' ) );
			} );
			dropdownMenu.appendChild( alignSection );

			// Separator
			dropdownMenu.appendChild( this.createDropdownSeparator() );

			// Distribute section
			const distSection = document.createElement( 'div' );
			distSection.className = 'dropdown-section';
			const distTitle = document.createElement( 'div' );
			distTitle.className = 'dropdown-section-title';
			distTitle.textContent = t( 'layers-distribute-section', 'Distribute (3+ layers)' );
			distSection.appendChild( distTitle );

			const distItems = [
				{ id: 'distribute-h', icon: icons.distributeH, label: t( 'layers-distribute-h', 'Distribute Horizontally' ) },
				{ id: 'distribute-v', icon: icons.distributeV, label: t( 'layers-distribute-v', 'Distribute Vertically' ) }
			];

			distItems.forEach( ( item ) => {
				distSection.appendChild( this.createDropdownActionItem( item, 'distribute' ) );
			} );
			dropdownMenu.appendChild( distSection );

			// Assemble dropdown
			arrangeGroup.appendChild( triggerButton );
			arrangeGroup.appendChild( dropdownMenu );
			this.container.appendChild( arrangeGroup );

			// Store references
			this.alignmentGroup = arrangeGroup;
			this.arrangeDropdownTrigger = triggerButton;
			this.arrangeDropdownMenu = dropdownMenu;
			this.smartGuidesToggle = smartGuidesItem.querySelector( 'input' );
			this.canvasSnapToggle = canvasSnapItem.querySelector( 'input' );

			// Set up dropdown event handlers
			this.setupArrangeDropdownEvents( triggerButton, dropdownMenu );
		}

		/**
		 * Get the arrange menu icon
		 *
		 * @return {string} SVG icon markup
		 */
		getArrangeIcon() {
			return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<line x1="4" y1="6" x2="20" y2="6"/>
				<line x1="4" y1="12" x2="20" y2="12"/>
				<line x1="4" y1="18" x2="20" y2="18"/>
				<line x1="10" y1="3" x2="10" y2="21"/>
				<line x1="14" y1="3" x2="14" y2="21"/>
			</svg>`;
		}

		/**
		 * Create a dropdown separator
		 *
		 * @return {HTMLElement} Separator element
		 */
		createDropdownSeparator() {
			const sep = document.createElement( 'div' );
			sep.className = 'dropdown-separator';
			return sep;
		}

		/**
		 * Create a toggle item for the dropdown
		 *
		 * @param {string} id Item identifier
		 * @param {string} label Display label
		 * @param {string} description Description text
		 * @param {string} shortcut Keyboard shortcut
		 * @param {boolean} checked Initial checked state
		 * @return {HTMLElement} Toggle item element
		 */
		createDropdownToggleItem( id, label, description, shortcut, checked ) {
			const item = document.createElement( 'label' );
			item.className = 'dropdown-item dropdown-toggle-item';
			item.setAttribute( 'role', 'menuitemcheckbox' );
			item.setAttribute( 'aria-checked', String( checked ) );

			const checkbox = document.createElement( 'input' );
			checkbox.type = 'checkbox';
			checkbox.checked = checked;
			checkbox.dataset.toggle = id;
			checkbox.className = 'dropdown-toggle-checkbox';

			const iconSpan = document.createElement( 'span' );
			iconSpan.className = 'dropdown-item-icon';

			const contentSpan = document.createElement( 'span' );
			contentSpan.className = 'dropdown-item-content';

			const labelSpan = document.createElement( 'span' );
			labelSpan.className = 'dropdown-item-label';
			labelSpan.textContent = label;

			const descSpan = document.createElement( 'span' );
			descSpan.className = 'dropdown-item-desc';
			descSpan.textContent = description;

			contentSpan.appendChild( labelSpan );
			contentSpan.appendChild( descSpan );

			item.appendChild( checkbox );
			item.appendChild( iconSpan );
			item.appendChild( contentSpan );

			// Only add shortcut if provided
			if ( shortcut ) {
				const shortcutSpan = document.createElement( 'span' );
				shortcutSpan.className = 'dropdown-item-shortcut';
				shortcutSpan.textContent = shortcut;
				item.appendChild( shortcutSpan );
			}

			return item;
		}

		/**
		 * Create an action item for the dropdown
		 *
		 * @param {Object} config Item configuration
		 * @param {string} config.id Action identifier
		 * @param {string} config.icon SVG icon
		 * @param {string} config.label Display label
		 * @param {string} type 'align' or 'distribute'
		 * @return {HTMLElement} Action item element
		 */
		createDropdownActionItem( config, type ) {
			const item = document.createElement( 'button' );
			item.className = `dropdown-item dropdown-action-item ${ type }-item`;
			item.setAttribute( 'role', 'menuitem' );
			item.dataset.align = config.id;
			item.disabled = true; // Enabled based on selection

			const iconSpan = document.createElement( 'span' );
			iconSpan.className = 'dropdown-item-icon';
			iconSpan.innerHTML = config.icon;

			const labelSpan = document.createElement( 'span' );
			labelSpan.className = 'dropdown-item-label';
			labelSpan.textContent = config.label;

			item.appendChild( iconSpan );
			item.appendChild( labelSpan );

			return item;
		}

		/**
		 * Set up event handlers for the arrange dropdown
		 *
		 * @param {HTMLElement} trigger Trigger button
		 * @param {HTMLElement} menu Dropdown menu
		 */
		setupArrangeDropdownEvents( trigger, menu ) {
			// Toggle dropdown on button click
			this.addListener( trigger, 'click', ( e ) => {
				e.stopPropagation();
				this.toggleArrangeDropdown();
			} );

			// Close on outside click
			this.addDocumentListener( 'click', ( e ) => {
				if ( !this.alignmentGroup.contains( e.target ) ) {
					this.closeArrangeDropdown();
				}
			} );

			// Handle menu item clicks
			this.addListener( menu, 'click', ( e ) => {
				const actionItem = e.target.closest( '.dropdown-action-item' );

				if ( actionItem && !actionItem.disabled ) {
					this.executeAlignmentAction( actionItem.dataset.align );
					// Don't close - user might want multiple operations
				}
				// Toggle items use <label> wrapping <input>, so native click
				// handles checkbox toggle and fires the change event automatically.
				// No manual toggle needed here — doing so would double-toggle.
			} );

			// Handle toggle changes
			this.addListener( menu, 'change', ( e ) => {
				if ( e.target.dataset.toggle === 'smart-guides' ) {
					this.setSmartGuidesEnabled( e.target.checked );
					e.target.closest( '.dropdown-toggle-item' ).setAttribute( 'aria-checked', String( e.target.checked ) );
				} else if ( e.target.dataset.toggle === 'canvas-snap' ) {
					this.setCanvasSnapEnabled( e.target.checked );
					e.target.closest( '.dropdown-toggle-item' ).setAttribute( 'aria-checked', String( e.target.checked ) );
				}
			} );

			// Keyboard navigation
			this.addListener( menu, 'keydown', ( e ) => {
				if ( e.key === 'Escape' ) {
					this.closeArrangeDropdown();
					trigger.focus();
				}
			} );
		}

		/**
		 * Toggle the arrange dropdown open/closed
		 */
		toggleArrangeDropdown() {
			const isOpen = this.arrangeDropdownMenu.style.display !== 'none';
			if ( isOpen ) {
				this.closeArrangeDropdown();
			} else {
				this.openArrangeDropdown();
			}
		}

		/**
		 * Open the arrange dropdown
		 */
		openArrangeDropdown() {
			this.arrangeDropdownMenu.style.display = 'block';
			this.arrangeDropdownTrigger.setAttribute( 'aria-expanded', 'true' );
			this.arrangeDropdownTrigger.classList.add( 'active' );
		}

		/**
		 * Close the arrange dropdown
		 */
		closeArrangeDropdown() {
			if ( this.arrangeDropdownMenu ) {
				this.arrangeDropdownMenu.style.display = 'none';
			}
			if ( this.arrangeDropdownTrigger ) {
				this.arrangeDropdownTrigger.setAttribute( 'aria-expanded', 'false' );
				this.arrangeDropdownTrigger.classList.remove( 'active' );
			}
		}

		/**
		 * Enable or disable smart guides
		 *
		 * @param {boolean} enabled Whether smart guides should be enabled
		 */
		setSmartGuidesEnabled( enabled ) {
			if ( !this.editor.canvasManager || !this.editor.canvasManager.smartGuidesController ) {
				return;
			}
			this.editor.canvasManager.smartGuidesController.setEnabled( enabled );
		}

		/**
		 * Enable or disable canvas snap
		 *
		 * @param {boolean} enabled Whether canvas snap should be enabled
		 */
		setCanvasSnapEnabled( enabled ) {
			if ( !this.editor.canvasManager || !this.editor.canvasManager.smartGuidesController ) {
				return;
			}
			this.editor.canvasManager.smartGuidesController.setCanvasSnapEnabled( enabled );
		}

		/**
		 * Update smart guides button/toggle state (called from keyboard handler)
		 *
		 * @param {boolean} enabled Current enabled state
		 */
		updateSmartGuidesButton( enabled ) {
			if ( this.smartGuidesToggle ) {
				this.smartGuidesToggle.checked = enabled;
				const item = this.smartGuidesToggle.closest( '.dropdown-toggle-item' );
				if ( item ) {
					item.setAttribute( 'aria-checked', String( enabled ) );
				}
			}
		}

		/**
		 * Update canvas snap button/toggle state (called from keyboard handler)
		 *
		 * @param {boolean} enabled Current enabled state
		 */
		updateCanvasSnapButton( enabled ) {
			if ( this.canvasSnapToggle ) {
				this.canvasSnapToggle.checked = enabled;
				const item = this.canvasSnapToggle.closest( '.dropdown-toggle-item' );
				if ( item ) {
					item.setAttribute( 'aria-checked', String( enabled ) );
				}
			}
		}

		/**
		 * Update alignment button states based on selection
		 *
		 * @param {number} selectedCount Number of selected layers
		 */
		updateAlignmentButtons( selectedCount ) {
			if ( !this.alignmentGroup ) {
				return;
			}

			// Alignment requires 2+ layers (now in dropdown)
			const alignItems = this.alignmentGroup.querySelectorAll( '.align-item' );
			alignItems.forEach( ( item ) => {
				item.disabled = selectedCount < 2;
				item.classList.toggle( 'disabled', selectedCount < 2 );
			} );

			// Distribution requires 3+ layers (now in dropdown)
			const distItems = this.alignmentGroup.querySelectorAll( '.distribute-item' );
			distItems.forEach( ( item ) => {
				item.disabled = selectedCount < 3;
				item.classList.toggle( 'disabled', selectedCount < 3 );
			} );
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
			zoomOutBtn.title = t2( 'layers-zoom-out', 'Zoom Out' ) + ' (-)';
			zoomOutBtn.dataset.action = 'zoom-out';

			// Zoom display/reset
			const zoomDisplay = document.createElement( 'button' );
			zoomDisplay.className = 'toolbar-button zoom-display';
			zoomDisplay.textContent = '100%';
			zoomDisplay.title = t2( 'layers-zoom-reset', 'Reset Zoom' ) + ' (0)';
			zoomDisplay.dataset.action = 'zoom-reset';
			// Announce zoom changes for screen readers
			zoomDisplay.setAttribute( 'aria-live', 'polite' );
			zoomDisplay.setAttribute( 'aria-label', t2( 'layers-status-zoom', 'Zoom' ) + ': 100%' );

			// Zoom in button
			const zoomInBtn = document.createElement( 'button' );
			zoomInBtn.className = 'toolbar-button zoom-button';
			zoomInBtn.innerHTML = icons.zoomIn;
			zoomInBtn.title = t2( 'layers-zoom-in', 'Zoom In' ) + ' (+/=)';
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

			// Import button + hidden file input (icon-only with tooltip)
			const importButton = document.createElement( 'button' );
			importButton.className = 'toolbar-button import-button';
			importButton.innerHTML = icons.importLayers;
			importButton.title = t( 'layers-import-layers', 'Import Layers' );
			importButton.setAttribute( 'aria-label', t( 'layers-import-layers', 'Import Layers' ) );
			actionGroup.appendChild( importButton );

			const importInput = document.createElement( 'input' );
			importInput.type = 'file';
			importInput.accept = '.json,application/json';
			importInput.style.display = 'none';
			actionGroup.appendChild( importInput );

		// Export button (icon-only with tooltip)
		const exportButton = document.createElement( 'button' );
		exportButton.className = 'toolbar-button export-button';
		exportButton.innerHTML = icons.exportLayers;
		exportButton.title = t( 'layers-export-layers', 'Export Layers' );
		exportButton.setAttribute( 'aria-label', t( 'layers-export-layers', 'Export Layers' ) );
		actionGroup.appendChild( exportButton );

		// Export as Image button (icon-only with tooltip)
		const exportImageButton = document.createElement( 'button' );
		exportImageButton.className = 'toolbar-button export-image-button';
		exportImageButton.innerHTML = icons.exportImage;
		exportImageButton.title = t( 'layers-export-image-tooltip', 'Download the image with annotations (PNG)' );
		exportImageButton.setAttribute( 'aria-label', t( 'layers-export-image', 'Export as PNG' ) );
		actionGroup.appendChild( exportImageButton );

		// Import Image Layer button + hidden file input (icon-only with tooltip)
		const importImageButton = document.createElement( 'button' );
		importImageButton.className = 'toolbar-button import-image-button';
		importImageButton.innerHTML = icons.importImage;
		importImageButton.title = t( 'layers-import-image-tooltip', 'Add an image as a layer' );
		importImageButton.setAttribute( 'aria-label', t( 'layers-import-image', 'Import Image' ) );
		actionGroup.appendChild( importImageButton );

		const importImageInput = document.createElement( 'input' );
		importImageInput.type = 'file';
		importImageInput.accept = 'image/*';
		importImageInput.style.display = 'none';
		actionGroup.appendChild( importImageInput );

		// Separator before save/help
		const separator2 = document.createElement( 'div' );
		separator2.className = 'toolbar-separator';
		actionGroup.appendChild( separator2 );

		// Help button - shows built-in user guide
		const helpButton = document.createElement( 'button' );
		helpButton.className = 'toolbar-button help-button';
		// Book/help icon
		helpButton.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="12" cy="12" r="10"/>
			<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
			<line x1="12" y1="17" x2="12.01" y2="17"/>
		</svg>`;
		helpButton.title = t( 'layers-help-title', 'Help' ) + ' (Shift+?)';
		helpButton.setAttribute( 'aria-label', t( 'layers-help-title', 'Help' ) );
		helpButton.dataset.action = 'show-help';
		actionGroup.appendChild( helpButton );

		// Save and Cancel buttons
		const saveButton = document.createElement( 'button' );
		saveButton.className = 'toolbar-button save-button primary';
		saveButton.textContent = t( 'layers-editor-save', 'Save' );
		saveButton.title = t( 'layers-save-changes', 'Save Changes' ) + ' (Ctrl+S)';
		actionGroup.appendChild( saveButton );

		// Cancel button removed - X close button provides same functionality

		this.container.appendChild( actionGroup );

		// Store references
		this.saveButton = saveButton;
		this.importButton = importButton;
		this.importInput = importInput;
		this.exportButton = exportButton;
		this.exportImageButton = exportImageButton;
		this.importImageButton = importImageButton;
		this.importImageInput = importImageInput;
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
			const alignButton = e.target.closest( '.align-button, .distribute-button' );

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
			} else if ( alignButton && !alignButton.disabled ) {
				this.executeAlignmentAction( alignButton.dataset.align );
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
			if ( this.editor ) {
				this.editor.save();
			} else if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
				mw.log.error( '[Toolbar] Cannot save - editor reference is null' );
			}
		} );

		// Cancel button listener removed - X close button provides same functionality

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

		// Import Image Layer - add an image file as a layer
		this.addListener( this.importImageButton, 'click', () => {
			this.importImageInput.click();
		} );

		this.addListener( this.importImageInput, 'change', () => {
			const file = this.importImageInput.files && this.importImageInput.files[ 0 ];
			if ( !file ) {
				return;
			}
			this.handleImageImport( file )
				.finally( () => {
					this.importImageInput.value = '';
				} );
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
		// Update UI - clear active state from all standalone tool buttons
		this.container.querySelectorAll( '.tool-button:not(.tool-dropdown-trigger)' ).forEach( ( button ) => {
			button.classList.remove( 'active' );
			button.setAttribute( 'aria-pressed', 'false' );
		} );

		// Update dropdown active states
		if ( this.toolDropdowns && this.toolDropdowns.length > 0 ) {
			this.toolDropdowns.forEach( ( dropdown ) => {
				if ( dropdown.hasTool( toolId ) ) {
					// This dropdown contains the tool - activate it and update MRU
					dropdown.setActive( true );
					// skipCallback=true to prevent recursive call back to selectTool
					dropdown.selectTool( toolId, true, true );
				} else {
					dropdown.setActive( false );
				}
			} );
		}

		// For standalone buttons, set active state directly
		const selectedButton = this.container.querySelector( '.tool-button:not(.tool-dropdown-trigger)[data-tool="' + toolId + '"]' );
		if ( selectedButton ) {
			selectedButton.classList.add( 'active' );
			selectedButton.setAttribute( 'aria-pressed', 'true' );
		}

		this.currentTool = toolId;

		// Show/hide tool-specific options
		this.updateToolOptions( toolId );

		// Notify editor
		this.editor.setCurrentTool( toolId, { skipToolbarSync: true } );

		// Focus: for standalone buttons, focus them; for dropdowns, focus the trigger
		const focusedBtn = this.container.querySelector( '.tool-button:not(.tool-dropdown-trigger)[data-tool="' + toolId + '"]' );
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
			case 'show-help':
				this.editor.showHelpDialog();
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

	/**
	 * Execute an alignment action on selected layers
	 *
	 * @param {string} actionId - The alignment action identifier
	 */
	executeAlignmentAction( actionId ) {
		if ( !this.editor.canvasManager || !this.editor.canvasManager.alignmentController ) {
			return;
		}

		const controller = this.editor.canvasManager.alignmentController;

		switch ( actionId ) {
			case 'align-left':
				controller.alignLeft();
				break;
			case 'align-center-h':
				controller.alignCenterH();
				break;
			case 'align-right':
				controller.alignRight();
				break;
			case 'align-top':
				controller.alignTop();
				break;
			case 'align-center-v':
				controller.alignCenterV();
				break;
			case 'align-bottom':
				controller.alignBottom();
				break;
			case 'distribute-h':
				controller.distributeHorizontal();
				break;
			case 'distribute-v':
				controller.distributeVertical();
				break;
		}
	}

	updateZoomDisplay( zoomPercent ) {
		if ( this.zoomDisplay ) {
			this.zoomDisplay.textContent = zoomPercent + '%';
			this.zoomDisplay.setAttribute( 'aria-label', this.msg( 'layers-status-zoom', 'Zoom' ) + ': ' + zoomPercent + '%' );
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
