/**
 * Slide Properties Panel for Layers Editor
 * Creates a collapsible panel showing slide-specific properties:
 * - Slide name (read-only)
 * - Canvas dimensions
 * - Background color
 * - Lock mode indicator
 * - Embed code copy button
 *
 * @module ui/SlidePropertiesPanel
 */
( function () {
	'use strict';

	// Default values fallback (for test environments where mw.ext may not be fully mocked)
	const DEFAULT_VALUES = {
		MIN_SLIDE_DIMENSION: 50,
		MAX_SLIDE_DIMENSION: 4096
	};

	// Import defaults from centralized constants (lazy-loaded, with fallback for tests)
	const getDefaults = () => {
		if ( typeof mw !== 'undefined' && mw.ext && mw.ext.layers && mw.ext.layers.LayerDefaults ) {
			return mw.ext.layers.LayerDefaults;
		}
		return DEFAULT_VALUES;
	};

	/**
	 * Get class from Layers namespace or fallback to global
	 *
	 * @param {string} namespacePath - Dot-separated path in Layers namespace
	 * @param {string} globalName - Global fallback name
	 * @return {Function|Object|undefined} The class or object
	 */
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
			if ( typeof obj === 'function' || typeof obj === 'object' ) {
				return obj;
			}
		}
		return window[ globalName ];
	};

	/**
	 * Helper to get translated message
	 *
	 * @param {string} key - Message key
	 * @param {string} fallback - Fallback text
	 * @return {string}
	 */
	function msg( key, fallback ) {
		if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
			return window.layersMessages.get( key, fallback );
		}
		if ( typeof mw !== 'undefined' && mw.message ) {
			const message = mw.message( key );
			if ( message.exists() ) {
				return message.text();
			}
		}
		return fallback || '';
	}

	/**
	 * SlidePropertiesPanel - Creates slide property editing UI
	 */
	class SlidePropertiesPanel {
		/**
		 * Create a new SlidePropertiesPanel
		 *
		 * @param {Object} config Configuration
		 * @param {Object} config.editor Reference to the LayersEditor
		 * @param {HTMLElement} config.container Container element to append panel to
		 */
		constructor( config ) {
			this.config = config || {};
			this.editor = config.editor;
			this.container = config.container;
			this.panel = null;
			this.isExpanded = true;

			// References to input elements
			this.widthInput = null;
			this.heightInput = null;
			this.bgColorButton = null;
			this.bgColorSwatch = null;
			this.lockIndicator = null;

			// Event tracker for cleanup
			const EventTracker = getClass( 'Utils.EventTracker', 'EventTracker' );
			this.eventTracker = EventTracker ? new EventTracker() : null;

			// Debounce timers
			this.widthTimer = null;
			this.heightTimer = null;
		}

		/**
		 * Create and render the panel
		 *
		 * @return {HTMLElement} The created panel element
		 */
		create() {
			const panel = document.createElement( 'div' );
			panel.className = 'slide-properties-panel';
			panel.style.display = 'none'; // Hidden by default (shown when in slide mode)

			// Header with collapse toggle
			const header = this.createHeader();
			panel.appendChild( header );

			// Content container
			const content = document.createElement( 'div' );
			content.className = 'slide-properties-content';

			// Slide name row (read-only)
			const nameRow = this.createNameRow();
			content.appendChild( nameRow );

			// Dimensions row
			const dimensionsRow = this.createDimensionsRow();
			content.appendChild( dimensionsRow );

			// Background row
			const bgRow = this.createBackgroundRow();
			content.appendChild( bgRow );

			// Embed code row
			const embedRow = this.createEmbedRow();
			content.appendChild( embedRow );

			panel.appendChild( content );
			this.content = content;
			this.panel = panel;

			if ( this.container ) {
				this.container.appendChild( panel );
			}

			return panel;
		}

		/**
		 * Create the collapsible header
		 *
		 * @return {HTMLElement}
		 */
		createHeader() {
			const header = document.createElement( 'div' );
			header.className = 'slide-properties-header';
			header.setAttribute( 'role', 'button' );
			header.setAttribute( 'tabindex', '0' );
			header.setAttribute( 'aria-expanded', 'true' );

			const icon = document.createElement( 'span' );
			icon.className = 'slide-properties-icon';
			icon.innerHTML = '▼';
			header.appendChild( icon );

			const title = document.createElement( 'span' );
			title.className = 'slide-properties-title';
			title.textContent = msg( 'layers-slide-properties', 'Slide Properties' );
			header.appendChild( title );

			this.headerIcon = icon;

			// Toggle on click
			const toggleHandler = () => {
				this.toggle();
			};
			const keyHandler = ( e ) => {
				if ( e.key === 'Enter' || e.key === ' ' ) {
					e.preventDefault();
					this.toggle();
				}
			};

			if ( this.eventTracker ) {
				this.eventTracker.add( header, 'click', toggleHandler );
				this.eventTracker.add( header, 'keydown', keyHandler );
			} else {
				header.addEventListener( 'click', toggleHandler );
				header.addEventListener( 'keydown', keyHandler );
			}

			return header;
		}

		/**
		 * Create slide name row
		 *
		 * @return {HTMLElement}
		 */
		createNameRow() {
			const row = document.createElement( 'div' );
			row.className = 'slide-prop-row slide-name-row';

			const label = document.createElement( 'label' );
			label.className = 'slide-prop-label';
			label.textContent = msg( 'layers-slide-prop-name', 'Name:' );

			const value = document.createElement( 'span' );
			value.className = 'slide-prop-value slide-name-value';
			value.textContent = '—';

			row.appendChild( label );
			row.appendChild( value );

			this.nameValue = value;
			return row;
		}

		/**
		 * Create dimensions row
		 *
		 * @return {HTMLElement}
		 */
		createDimensionsRow() {
			const row = document.createElement( 'div' );
			row.className = 'slide-prop-row slide-dimensions-row';

			const label = document.createElement( 'label' );
			label.className = 'slide-prop-label';
			label.textContent = msg( 'layers-slide-prop-size', 'Size:' );

			const controls = document.createElement( 'div' );
			controls.className = 'slide-prop-controls';

			// Width input
			const widthInput = document.createElement( 'input' );
			widthInput.type = 'number';
			widthInput.className = 'slide-prop-input slide-width-input';
			widthInput.min = String( getDefaults().MIN_SLIDE_DIMENSION );
			widthInput.max = String( getDefaults().MAX_SLIDE_DIMENSION );
			widthInput.value = '800';
			widthInput.setAttribute( 'aria-label', msg( 'layers-slide-canvas-width', 'Width' ) );

			const separator = document.createElement( 'span' );
			separator.className = 'slide-prop-separator';
			separator.textContent = '×';

			// Height input
			const heightInput = document.createElement( 'input' );
			heightInput.type = 'number';
			heightInput.className = 'slide-prop-input slide-height-input';
			heightInput.min = String( getDefaults().MIN_SLIDE_DIMENSION );
			heightInput.max = String( getDefaults().MAX_SLIDE_DIMENSION );
			heightInput.value = '600';
			heightInput.setAttribute( 'aria-label', msg( 'layers-slide-canvas-height', 'Height' ) );

			const unit = document.createElement( 'span' );
			unit.className = 'slide-prop-unit';
			unit.textContent = 'px';

			controls.appendChild( widthInput );
			controls.appendChild( separator );
			controls.appendChild( heightInput );
			controls.appendChild( unit );

			row.appendChild( label );
			row.appendChild( controls );

			this.widthInput = widthInput;
			this.heightInput = heightInput;

			// Setup event handlers
			this.setupDimensionHandlers();

			return row;
		}

		/**
		 * Setup dimension input event handlers
		 */
		setupDimensionHandlers() {
			const widthHandler = () => {
				if ( this.widthTimer ) {
					clearTimeout( this.widthTimer );
				}
				this.widthTimer = setTimeout( () => {
					const width = parseInt( this.widthInput.value, 10 );
					const defaults = getDefaults();
					if ( width >= defaults.MIN_SLIDE_DIMENSION && width <= defaults.MAX_SLIDE_DIMENSION ) {
						this.updateCanvasSize( width, null );
					}
				}, 300 );
			};

			const heightHandler = () => {
				if ( this.heightTimer ) {
					clearTimeout( this.heightTimer );
				}
				this.heightTimer = setTimeout( () => {
					const height = parseInt( this.heightInput.value, 10 );
					const defaults = getDefaults();
					if ( height >= defaults.MIN_SLIDE_DIMENSION && height <= defaults.MAX_SLIDE_DIMENSION ) {
						this.updateCanvasSize( null, height );
					}
				}, 300 );
			};

			if ( this.eventTracker ) {
				this.eventTracker.add( this.widthInput, 'input', widthHandler );
				this.eventTracker.add( this.heightInput, 'input', heightHandler );
			} else {
				this.widthInput.addEventListener( 'input', widthHandler );
				this.heightInput.addEventListener( 'input', heightHandler );
			}
		}

		/**
		 * Create background color row
		 *
		 * @return {HTMLElement}
		 */
		createBackgroundRow() {
			const row = document.createElement( 'div' );
			row.className = 'slide-prop-row slide-background-row';

			const label = document.createElement( 'label' );
			label.className = 'slide-prop-label';
			label.textContent = msg( 'layers-slide-prop-background', 'Background:' );

			const controls = document.createElement( 'div' );
			controls.className = 'slide-prop-controls';

			// Color button with swatch
			const colorBtn = document.createElement( 'button' );
			colorBtn.type = 'button';
			colorBtn.className = 'slide-prop-color-button';
			colorBtn.setAttribute( 'aria-label', msg( 'layers-slide-background-color', 'Background color' ) );

			const swatch = document.createElement( 'span' );
			swatch.className = 'slide-prop-color-swatch';
			swatch.style.backgroundColor = '#ffffff';
			colorBtn.appendChild( swatch );

			controls.appendChild( colorBtn );

			row.appendChild( label );
			row.appendChild( controls );

			this.bgColorButton = colorBtn;
			this.bgColorSwatch = swatch;

			// Setup color picker handler
			const colorHandler = () => {
				this.openBackgroundColorPicker();
			};

			if ( this.eventTracker ) {
				this.eventTracker.add( colorBtn, 'click', colorHandler );
			} else {
				colorBtn.addEventListener( 'click', colorHandler );
			}

			return row;
		}

		/**
		 * Create embed code row
		 *
		 * @return {HTMLElement}
		 */
		createEmbedRow() {
			const row = document.createElement( 'div' );
			row.className = 'slide-prop-row slide-embed-row';

			const button = document.createElement( 'button' );
			button.type = 'button';
			button.className = 'slide-embed-button';
			button.textContent = msg( 'layers-slide-copy-embed', 'Copy Embed Code' );

			row.appendChild( button );

			// Setup copy handler
			const copyHandler = () => {
				this.copyEmbedCode();
			};

			if ( this.eventTracker ) {
				this.eventTracker.add( button, 'click', copyHandler );
			} else {
				button.addEventListener( 'click', copyHandler );
			}

			this.embedButton = button;

			return row;
		}

		/**
		 * Toggle panel expanded/collapsed state
		 */
		toggle() {
			this.isExpanded = !this.isExpanded;
			if ( this.content ) {
				this.content.style.display = this.isExpanded ? '' : 'none';
			}
			if ( this.headerIcon ) {
				this.headerIcon.innerHTML = this.isExpanded ? '▼' : '▶';
			}
			if ( this.panel ) {
				const header = this.panel.querySelector( '.slide-properties-header' );
				if ( header ) {
					header.setAttribute( 'aria-expanded', String( this.isExpanded ) );
				}
			}
		}

		/**
		 * Show or hide the panel based on slide mode
		 *
		 * @param {boolean} isSlide Whether in slide mode
		 */
		updateVisibility( isSlide ) {
			if ( !this.panel ) {
				return;
			}

			this.panel.style.display = isSlide ? '' : 'none';
		}

		/**
		 * Update panel values from state
		 *
		 * @param {Object} slideData Slide data
		 * @param {string} slideData.name Slide name
		 * @param {number} slideData.width Canvas width
		 * @param {number} slideData.height Canvas height
		 * @param {string} slideData.backgroundColor Background color
		 */
		updateValues( slideData ) {
			if ( this.nameValue && slideData.name ) {
				this.nameValue.textContent = slideData.name;
			}
			if ( this.widthInput && slideData.width ) {
				this.widthInput.value = slideData.width;
			}
			if ( this.heightInput && slideData.height ) {
				this.heightInput.value = slideData.height;
			}
			if ( this.bgColorSwatch && slideData.backgroundColor ) {
				this.updateBackgroundSwatch( slideData.backgroundColor );
			}
		}

		/**
		 * Update canvas size in state
		 *
		 * @param {number|null} width New width
		 * @param {number|null} height New height
		 */
		updateCanvasSize( width, height ) {
			if ( !this.editor || !this.editor.stateManager ) {
				return;
			}

			const stateManager = this.editor.stateManager;

			if ( width !== null ) {
				stateManager.set( 'baseWidth', width );
			}
			if ( height !== null ) {
				stateManager.set( 'baseHeight', height );
			}

			// Sync toolbar if available
			if ( this.editor.toolbar && this.editor.toolbar.slideWidthInput && width !== null ) {
				this.editor.toolbar.slideWidthInput.value = width;
			}
			if ( this.editor.toolbar && this.editor.toolbar.slideHeightInput && height !== null ) {
				this.editor.toolbar.slideHeightInput.value = height;
			}

			// Update canvas manager
			if ( this.editor.canvasManager && this.editor.canvasManager.setBaseDimensions ) {
				const currentWidth = width !== null ? width : stateManager.get( 'baseWidth' );
				const currentHeight = height !== null ? height : stateManager.get( 'baseHeight' );
				this.editor.canvasManager.setBaseDimensions( currentWidth, currentHeight );
			}

			// Mark dirty
			stateManager.set( 'isDirty', true );
		}

		/**
		 * Open background color picker dialog
		 */
		openBackgroundColorPicker() {
			const currentColor = this.editor && this.editor.stateManager ?
				this.editor.stateManager.get( 'slideBackgroundColor' ) || 'transparent' :
				'transparent';

			// Use toolbar's color picker if available
			// openColorPickerDialog( anchorButton, initialValue, options )
			if ( this.editor && this.editor.toolbar &&
				typeof this.editor.toolbar.openColorPickerDialog === 'function' ) {
				this.editor.toolbar.openColorPickerDialog( this.bgColorButton, currentColor, {
					onApply: ( newColor ) => {
						this.setBackgroundColor( newColor );
					}
				} );
			}
		}

		/**
		 * Set background color
		 *
		 * @param {string} color New background color
		 */
		setBackgroundColor( color ) {
			// Update swatch
			this.updateBackgroundSwatch( color );

			// Update state
			if ( this.editor && this.editor.stateManager ) {
				this.editor.stateManager.set( 'slideBackgroundColor', color );

				// Sync toolbar
				if ( this.editor.toolbar && this.editor.toolbar.setSlideBackgroundColor ) {
					this.editor.toolbar.setSlideBackgroundColor( color );
				}

				// Update canvas
				if ( this.editor.canvasManager && this.editor.canvasManager.setBackgroundColor ) {
					this.editor.canvasManager.setBackgroundColor( color );
				}

				// Mark dirty
				this.editor.stateManager.set( 'isDirty', true );
			}
		}

		/**
		 * Update background color swatch display
		 *
		 * @param {string} color Color value
		 */
		updateBackgroundSwatch( color ) {
			if ( !this.bgColorSwatch ) {
				return;
			}

			if ( color === 'transparent' ) {
				this.bgColorSwatch.style.backgroundColor = 'transparent';
				this.bgColorSwatch.style.backgroundImage =
					'linear-gradient(45deg, #ccc 25%, transparent 25%), ' +
					'linear-gradient(-45deg, #ccc 25%, transparent 25%), ' +
					'linear-gradient(45deg, transparent 75%, #ccc 75%), ' +
					'linear-gradient(-45deg, transparent 75%, #ccc 75%)';
				this.bgColorSwatch.style.backgroundSize = '8px 8px';
				this.bgColorSwatch.style.backgroundPosition = '0 0, 0 4px, 4px -4px, -4px 0px';
			} else {
				this.bgColorSwatch.style.backgroundColor = color;
				this.bgColorSwatch.style.backgroundImage = 'none';
			}
		}

		/**
		 * Copy embed code to clipboard
		 */
		copyEmbedCode() {
			if ( !this.editor || !this.editor.stateManager ) {
				return;
			}

			const slideName = this.editor.stateManager.get( 'slideName' ) || '';
			const setName = this.editor.stateManager.get( 'currentSetName' ) || 'default';

			// Build the wikitext
			let embedCode = '{{#Slide: ' + slideName;
			if ( setName && setName !== 'default' ) {
				embedCode += ' | layerset=' + setName;
			}
			embedCode += ' }}';

			// Copy to clipboard
			if ( navigator.clipboard && navigator.clipboard.writeText ) {
				navigator.clipboard.writeText( embedCode ).then( function () {
					// Show success feedback
					if ( typeof mw !== 'undefined' && mw.notify ) {
						mw.notify( msg( 'layers-slide-embed-copied', 'Embed code copied!' ), {
							type: 'info',
							tag: 'layers-embed'
						} );
					}
				} ).catch( function ( err ) {
					// Clipboard API failed, log and use fallback
					if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
						mw.log.warn( '[SlidePropertiesPanel] Clipboard API failed:', err );
					}
					this.fallbackCopy( embedCode );
				}.bind( this ) );
			} else {
				this.fallbackCopy( embedCode );
			}
		}

		/**
		 * Fallback copy method using textarea
		 *
		 * @param {string} text Text to copy
		 */
		fallbackCopy( text ) {
			const textarea = document.createElement( 'textarea' );
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.left = '-9999px';
			document.body.appendChild( textarea );
			textarea.select();
			try {
				document.execCommand( 'copy' );
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify( msg( 'layers-slide-embed-copied', 'Embed code copied!' ), {
						type: 'info',
						tag: 'layers-embed'
					} );
				}
			} catch ( e ) {
				// Silent fail
			}
			document.body.removeChild( textarea );
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			// Clear timers
			if ( this.widthTimer ) {
				clearTimeout( this.widthTimer );
			}
			if ( this.heightTimer ) {
				clearTimeout( this.heightTimer );
			}

			// Clean up event tracker
			if ( this.eventTracker && typeof this.eventTracker.destroy === 'function' ) {
				this.eventTracker.destroy();
			}

			// Remove from DOM
			if ( this.panel && this.panel.parentNode ) {
				this.panel.parentNode.removeChild( this.panel );
			}

			// Clear references
			this.panel = null;
			this.content = null;
			this.widthInput = null;
			this.heightInput = null;
			this.bgColorButton = null;
			this.bgColorSwatch = null;
			this.lockRow = null;
			this.lockText = null;
			this.embedButton = null;
			this.nameValue = null;
		}
	}

	// Export to Layers namespace
	if ( !window.Layers ) {
		window.Layers = {};
	}
	if ( !window.Layers.UI ) {
		window.Layers.UI = {};
	}
	window.Layers.UI.SlidePropertiesPanel = SlidePropertiesPanel;

	// Legacy global export
	window.SlidePropertiesPanel = SlidePropertiesPanel;

}() );
