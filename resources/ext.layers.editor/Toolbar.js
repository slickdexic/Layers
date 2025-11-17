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
			var listener = this.documentListeners.pop();
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
			var cleanup = this.dialogCleanups.pop();
			try {
				cleanup();
			} catch ( _err ) {
				// Ignore cleanup errors
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

	Toolbar.prototype.getColorPickerStrings = function () {
		var t = this.msg.bind( this );
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

	// Update the visual state of a color display button
	Toolbar.prototype.updateColorButtonDisplay = function ( btn, color, transparentLabel, previewTemplate ) {
		var labelValue = color;
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
			var previewText = previewTemplate.indexOf( '$1' ) !== -1 ?
				previewTemplate.replace( '$1', labelValue ) :
				previewTemplate + ' ' + labelValue;
			btn.setAttribute( 'aria-label', previewText );
		} else if ( labelValue ) {
			btn.setAttribute( 'aria-label', labelValue );
		}
	};

	// Show a modal color picker dialog near an anchor button
	Toolbar.prototype.openColorPickerDialog = function ( anchorButton, initialValue, options ) {
		options = options || {};
		const toolbar = this;
		const colorPickerStrings = this.getColorPickerStrings();
		const onApply = options.onApply || function () {};
		const transparentTitle = options.transparentTitle || colorPickerStrings.none;
		const formatTemplate = function ( template, value ) {
			if ( typeof template !== 'string' ) {
				return value;
			}
			return template.indexOf( '$1' ) !== -1 ? template.replace( '$1', value ) : template + ' ' + value;
		};
		const buttonRect = anchorButton.getBoundingClientRect();
		const previouslyFocused = document.activeElement;
		const overlay = document.createElement( 'div' );
		overlay.className = 'color-picker-overlay';
		overlay.setAttribute( 'role', 'presentation' );
		overlay.setAttribute( 'aria-hidden', 'true' );
		const dialog = document.createElement( 'div' );
		dialog.className = 'color-picker-dialog';
		dialog.setAttribute( 'role', 'dialog' );
		dialog.setAttribute( 'aria-modal', 'true' );
		dialog.setAttribute( 'tabindex', '-1' );
		let escapeHandler = null;
		let focusTrapHandler = null;
		const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
		const cleanup = function () {
			if ( escapeHandler ) {
				document.removeEventListener( 'keydown', escapeHandler );
				escapeHandler = null;
			}
			if ( focusTrapHandler ) {
				dialog.removeEventListener( 'keydown', focusTrapHandler );
				focusTrapHandler = null;
			}
			if ( overlay && overlay.parentNode ) {
				overlay.parentNode.removeChild( overlay );
			}
			if ( dialog && dialog.parentNode ) {
				dialog.parentNode.removeChild( dialog );
			}
			anchorButton.setAttribute( 'aria-expanded', 'false' );
			if ( previouslyFocused && typeof previouslyFocused.focus === 'function' ) {
				previouslyFocused.focus();
			}
			if ( toolbar && Array.isArray( toolbar.dialogCleanups ) ) {
				toolbar.dialogCleanups = toolbar.dialogCleanups.filter( function ( fn ) {
					return fn !== cleanup;
				} );
			}
		};
		this.registerDialogCleanup( cleanup );
		let dialogTop = buttonRect.bottom + 5;
		let dialogLeft = buttonRect.left;
		const maxTop = window.innerHeight - 420;
		const maxLeft = window.innerWidth - 300;
		if ( dialogTop > maxTop ) {
			dialogTop = buttonRect.top - 420 - 5;
		}
		if ( dialogLeft > maxLeft ) {
			dialogLeft = maxLeft;
		}
		if ( dialogLeft < 10 ) {
			dialogLeft = 10;
		}
		if ( dialogTop < 10 ) {
			dialogTop = 10;
		}
		dialog.style.top = Math.floor( dialogTop ) + 'px';
		dialog.style.left = Math.floor( dialogLeft ) + 'px';
		const dialogId = 'layers-color-picker-' + Math.random().toString( 36 ).slice( 2 );
		const title = document.createElement( 'h3' );
		title.className = 'color-picker-title';
		title.id = dialogId + '-title';
		title.textContent = options.title || colorPickerStrings.title;
		dialog.setAttribute( 'aria-labelledby', title.id );
		dialog.appendChild( title );
		const paletteContainer = document.createElement( 'div' );
		paletteContainer.className = 'color-picker-section';
		const paletteTitle = document.createElement( 'div' );
		paletteTitle.className = 'color-picker-section-title';
		paletteTitle.id = dialogId + '-standard';
		paletteTitle.textContent = colorPickerStrings.standard;
		dialog.setAttribute( 'aria-describedby', paletteTitle.id );
		paletteContainer.appendChild( paletteTitle );
		const paletteGrid = document.createElement( 'div' );
		paletteGrid.className = 'color-picker-grid';
		const standardColors = [
			'#000000', '#404040', '#808080', '#c0c0c0', '#ffffff', '#ff0000', '#ffff00', '#00ff00',
			'#00ffff', '#0000ff', '#ff00ff', '#800000', '#808000', '#008000', '#008080', '#000080',
			'#800080', '#ff4500', '#ffa500', '#ffff00', '#adff2f', '#00ff7f', '#00bfff', '#1e90ff',
			'#9370db', '#ff69b4', '#ffdab9', '#f0e68c', '#e0ffff', '#ffe4e1', '#dcdcdc', '#a9a9a9'
		];
		let selectedColor = ( initialValue === 'none' ) ? 'none' : ( initialValue || '#000000' );
		let selectedButton = null;
		const updateSelection = function ( button ) {
			if ( selectedButton ) {
				selectedButton.classList.remove( 'selected' );
			}
			if ( button ) {
				button.classList.add( 'selected' );
				selectedButton = button;
			}
		};
		const noneButton = document.createElement( 'button' );
		noneButton.type = 'button';
		noneButton.className = 'color-picker-none-btn';
		noneButton.title = transparentTitle;
		noneButton.setAttribute( 'aria-label', transparentTitle );
		noneButton.addEventListener( 'click', function () {
			selectedColor = 'none';
			updateSelection( noneButton );
		} );
		paletteGrid.appendChild( noneButton );
		standardColors.forEach( function ( color ) {
			const colorBtn = document.createElement( 'button' );
			colorBtn.type = 'button';
			colorBtn.className = 'color-picker-swatch-btn';
			colorBtn.style.backgroundColor = color;
			colorBtn.title = color;
			colorBtn.setAttribute( 'aria-label', formatTemplate( colorPickerStrings.swatchTemplate, color ) );
			colorBtn.addEventListener( 'click', function () {
				selectedColor = color;
				updateSelection( colorBtn );
			} );
			if ( color.toLowerCase() === String( selectedColor ).toLowerCase() ) {
				updateSelection( colorBtn );
			}
			paletteGrid.appendChild( colorBtn );
		} );
		paletteContainer.appendChild( paletteGrid );
		dialog.appendChild( paletteContainer );
		const customContainer = document.createElement( 'div' );
		customContainer.className = 'color-picker-section';
		const customTitle = document.createElement( 'div' );
		customTitle.className = 'color-picker-section-title';
		customTitle.textContent = colorPickerStrings.saved;
		customContainer.appendChild( customTitle );
		const customGrid = document.createElement( 'div' );
		customGrid.className = 'color-picker-grid';
		let savedCustomColors = [];
		try {
			savedCustomColors = JSON.parse( localStorage.getItem( 'layers-custom-colors' ) || '[]' );
		} catch ( err ) {
			savedCustomColors = [];
		}
		const createCustomButtonClickHandler = function ( button ) {
			return function () {
				selectedColor = button.style.backgroundColor;
				updateSelection( button );
			};
		};
		for ( let i = 0; i < 16; i++ ) {
			const customBtn = document.createElement( 'button' );
			customBtn.type = 'button';
			customBtn.className = 'color-picker-swatch-btn';
			customBtn.dataset.slot = i;
			if ( savedCustomColors[ i ] ) {
				customBtn.style.backgroundColor = savedCustomColors[ i ];
				customBtn.title = savedCustomColors[ i ];
				customBtn.setAttribute( 'aria-label', formatTemplate( colorPickerStrings.swatchTemplate, savedCustomColors[ i ] ) );
				customBtn.addEventListener( 'click', createCustomButtonClickHandler( customBtn ) );
				if ( savedCustomColors[ i ].toLowerCase && savedCustomColors[ i ].toLowerCase() === String( selectedColor ).toLowerCase() ) {
					updateSelection( customBtn );
				}
			} else {
				customBtn.title = colorPickerStrings.emptySlot;
				customBtn.setAttribute( 'aria-label', colorPickerStrings.emptySlot );
			}
			customGrid.appendChild( customBtn );
		}
		customContainer.appendChild( customGrid );
		dialog.appendChild( customContainer );
		const customSection = document.createElement( 'div' );
		customSection.className = 'color-picker-section';
		const customLabel = document.createElement( 'div' );
		customLabel.className = 'color-picker-section-title';
		customLabel.textContent = colorPickerStrings.customSection;
		customSection.appendChild( customLabel );
		const customInput = document.createElement( 'input' );
		customInput.type = 'color';
		customInput.className = 'color-picker-custom-input';
		customInput.setAttribute( 'aria-label', colorPickerStrings.customSection );
		customInput.addEventListener( 'change', function () {
			selectedColor = customInput.value;
			updateSelection( null );
		} );
		customSection.appendChild( customInput );
		dialog.appendChild( customSection );
		if ( selectedColor === 'none' ) {
			updateSelection( noneButton );
		}
		const buttonContainer = document.createElement( 'div' );
		buttonContainer.className = 'color-picker-actions';
		const cancelBtn = document.createElement( 'button' );
		cancelBtn.type = 'button';
		cancelBtn.className = 'color-picker-btn color-picker-btn--secondary';
		cancelBtn.textContent = colorPickerStrings.cancel;
		cancelBtn.addEventListener( 'click', function () {
			cleanup();
		} );
		const okBtn = document.createElement( 'button' );
		okBtn.type = 'button';
		okBtn.className = 'color-picker-btn color-picker-btn--primary';
		okBtn.textContent = colorPickerStrings.apply;
		okBtn.addEventListener( 'click', function () {
			if ( selectedColor !== 'none' && selectedColor !== initialValue ) {
				try {
					let customColors = JSON.parse( localStorage.getItem( 'layers-custom-colors' ) || '[]' );
					if ( customColors.indexOf( selectedColor ) === -1 ) {
						customColors.unshift( selectedColor );
						customColors = customColors.slice( 0, 16 );
						localStorage.setItem( 'layers-custom-colors', JSON.stringify( customColors ) );
					}
				} catch ( err ) {
					// Ignore storage failures
				}
			}
			onApply( selectedColor );
			cleanup();
		} );
		buttonContainer.appendChild( cancelBtn );
		buttonContainer.appendChild( okBtn );
		dialog.appendChild( buttonContainer );
		overlay.addEventListener( 'click', function ( e ) {
			if ( e.target === overlay ) {
				cleanup();
			}
		} );
		escapeHandler = function ( e ) {
			if ( e.key === 'Escape' ) {
				cleanup();
			}
		};
		document.addEventListener( 'keydown', escapeHandler );
		focusTrapHandler = function ( e ) {
			if ( e.key !== 'Tab' ) {
				return;
			}
			const focusable = dialog.querySelectorAll( focusableSelector );
			if ( !focusable.length ) {
				return;
			}
			const first = focusable[ 0 ];
			const last = focusable[ focusable.length - 1 ];
			if ( e.shiftKey && document.activeElement === first ) {
				e.preventDefault();
				last.focus();
			} else if ( !e.shiftKey && document.activeElement === last ) {
				e.preventDefault();
				first.focus();
			}
		};
		dialog.addEventListener( 'keydown', focusTrapHandler );
		const focusInitial = function () {
			const focusable = dialog.querySelectorAll( focusableSelector );
			if ( focusable.length ) {
				focusable[ 0 ].focus();
			} else {
				dialog.focus();
			}
		};
		document.body.appendChild( overlay );
		document.body.appendChild( dialog );
		anchorButton.setAttribute( 'aria-expanded', 'true' );
		focusInitial();
	};

	// Resolve i18n text safely, avoiding placeholder leakage
	Toolbar.prototype.msg = function ( key, fallback ) {
		function pick( txt, fb ) {
			if ( txt && txt.indexOf && !txt.includes( '⧼' ) ) {
				return txt;
			}
			return fb;
		}
		switch ( key ) {
			case 'layers-toolbar-title': {
				const t0 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toolbar-title' ).text() : null;
				return pick( t0, fallback );
			}
			// Tools
			case 'layers-tool-select': {
				const t1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-select' ).text() : null;
				return pick( t1, fallback );
			}
			case 'layers-tool-zoom': {
				const t2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-zoom' ).text() : null;
				return pick( t2, fallback );
			}
			case 'layers-tool-text': {
				const t3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-text' ).text() : null;
				return pick( t3, fallback );
			}
			case 'layers-tool-pen': {
				const t4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-pen' ).text() : null;
				return pick( t4, fallback );
			}
			case 'layers-tool-rectangle': {
				const t5 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-rectangle' ).text() : null;
				return pick( t5, fallback );
			}
			case 'layers-tool-circle': {
				const t6 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-circle' ).text() : null;
				return pick( t6, fallback );
			}
			case 'layers-tool-ellipse': {
				const t7 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-ellipse' ).text() : null;
				return pick( t7, fallback );
			}
			case 'layers-tool-polygon': {
				const t8 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-polygon' ).text() : null;
				return pick( t8, fallback );
			}
			case 'layers-tool-star': {
				const t9 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-star' ).text() : null;
				return pick( t9, fallback );
			}
			case 'layers-tool-arrow': {
				const t10 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-arrow' ).text() : null;
				return pick( t10, fallback );
			}
			case 'layers-tool-line': {
				const t11 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-line' ).text() : null;
				return pick( t11, fallback );
			}
			case 'layers-tool-highlight': {
				const t12 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-highlight' ).text() : null;
				return pick( t12, fallback );
			}
			case 'layers-tool-blur': {
				const t13 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-blur' ).text() : null;
				return pick( t13, fallback );
			}
			case 'layers-tool-marquee': {
				const t14 = ( window.mw && mw.message ) ?
					mw.message( 'layers-tool-marquee' ).text() : null;
				return pick( t14, fallback );
			}
			// Properties/labels
			case 'layers-prop-stroke-color': {
				const p1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-prop-stroke-color' ).text() : null;
				return pick( p1, fallback );
			}
			case 'layers-prop-fill-color': {
				const p2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-prop-fill-color' ).text() : null;
				return pick( p2, fallback );
			}
			case 'layers-prop-stroke-width': {
				const p3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-prop-stroke-width' ).text() : null;
				return pick( p3, fallback );
			}
			case 'layers-prop-font-size': {
				const p4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-prop-font-size' ).text() : null;
				return pick( p4, fallback );
			}
			case 'layers-effect-shadow': {
				const p5 = ( window.mw && mw.message ) ?
					mw.message( 'layers-effect-shadow' ).text() : null;
				return pick( p5, fallback );
			}
			case 'layers-effect-shadow-enable': {
				const p6 = ( window.mw && mw.message ) ?
					mw.message( 'layers-effect-shadow-enable' ).text() : null;
				return pick( p6, fallback );
			}
			case 'layers-effect-shadow-color': {
				const p7 = ( window.mw && mw.message ) ?
					mw.message( 'layers-effect-shadow-color' ).text() : null;
				return pick( p7, fallback );
			}
			case 'layers-arrow-single': {
				const a1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-arrow-single' ).text() : null;
				return pick( a1, fallback );
			}
			case 'layers-arrow-double': {
				const a2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-arrow-double' ).text() : null;
				return pick( a2, fallback );
			}
			case 'layers-arrow-none': {
				const a3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-arrow-none' ).text() : null;
				return pick( a3, fallback );
			}
			// Zoom
			case 'layers-zoom-out': {
				const z1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-zoom-out' ).text() : null;
				return pick( z1, fallback );
			}
			case 'layers-zoom-reset': {
				const z2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-zoom-reset' ).text() : null;
				return pick( z2, fallback );
			}
			case 'layers-zoom-in': {
				const z3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-zoom-in' ).text() : null;
				return pick( z3, fallback );
			}
			case 'layers-zoom-fit': {
				const z4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-zoom-fit' ).text() : null;
				return pick( z4, fallback );
			}
			// Actions
			case 'layers-undo': {
				const ac1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-undo' ).text() : null;
				return pick( ac1, fallback );
			}
			case 'layers-redo': {
				const ac2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-redo' ).text() : null;
				return pick( ac2, fallback );
			}
			case 'layers-delete-selected': {
				const ac3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-delete-selected' ).text() : null;
				return pick( ac3, fallback );
			}
			case 'layers-duplicate-selected': {
				const ac4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-duplicate-selected' ).text() : null;
				return pick( ac4, fallback );
			}
			case 'layers-toggle-grid': {
				const ac5 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toggle-grid' ).text() : null;
				return pick( ac5, fallback );
			}
			case 'layers-toggle-rulers': {
				const ac6 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toggle-rulers' ).text() : null;
				return pick( ac6, fallback );
			}
			case 'layers-toggle-guides': {
				const ac7 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toggle-guides' ).text() : null;
				return pick( ac7, fallback );
			}
			case 'layers-toggle-snap-grid': {
				const ac8 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toggle-snap-grid' ).text() : null;
				return pick( ac8, fallback );
			}
			case 'layers-toggle-snap-guides': {
				const ac9 = ( window.mw && mw.message ) ?
					mw.message( 'layers-toggle-snap-guides' ).text() : null;
				return pick( ac9, fallback );
			}
			// Import/Export
			case 'layers-import': {
				const ie1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-import' ).text() : null;
				return pick( ie1, fallback );
			}
			case 'layers-export': {
				const ie2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-export' ).text() : null;
				return pick( ie2, fallback );
			}
			case 'layers-import-unsaved-confirm': {
				const ie3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-import-unsaved-confirm' ).text() : null;
				return pick( ie3, fallback );
			}
			case 'layers-import-success': {
				const ie4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-import-success' ).text() : null;
				return pick( ie4, fallback );
			}
			case 'layers-import-error': {
				const ie5 = ( window.mw && mw.message ) ?
					mw.message( 'layers-import-error' ).text() : null;
				return pick( ie5, fallback );
			}
			// Save/Cancel
			case 'layers-editor-save': {
				const sc1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-editor-save' ).text() : null;
				return pick( sc1, fallback );
			}
			case 'layers-save-changes': {
				const sc2 = ( window.mw && mw.message ) ?
					mw.message( 'layers-save-changes' ).text() : null;
				return pick( sc2, fallback );
			}
			case 'layers-editor-cancel': {
				const sc3 = ( window.mw && mw.message ) ?
					mw.message( 'layers-editor-cancel' ).text() : null;
				return pick( sc3, fallback );
			}
			case 'layers-cancel-changes': {
				const sc4 = ( window.mw && mw.message ) ?
					mw.message( 'layers-cancel-changes' ).text() : null;
				return pick( sc4, fallback );
			}
			// Misc
			case 'layers-transparent': {
				const mi1 = ( window.mw && mw.message ) ?
					mw.message( 'layers-transparent' ).text() : null;
				return pick( mi1, fallback );
			}
			default:
				return fallback;
		}
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
			{ id: 'zoom', icon: '🔍', title: t( 'layers-tool-zoom', 'Zoom Tool' ), key: 'Z' },
			{ id: 'text', icon: 'T', title: t( 'layers-tool-text', 'Text Tool' ), key: 'T' },
			{ id: 'pen', icon: '✏', title: t( 'layers-tool-pen', 'Pen Tool' ), key: 'P' },
			{ id: 'rectangle', icon: '▢', title: t( 'layers-tool-rectangle', 'Rectangle Tool' ), key: 'R' },
			{ id: 'circle', icon: '○', title: t( 'layers-tool-circle', 'Circle Tool' ), key: 'C' },
			{ id: 'ellipse', icon: '○', title: t( 'layers-tool-ellipse', 'Ellipse Tool' ), key: 'E' },
			{ id: 'polygon', icon: '⬟', title: t( 'layers-tool-polygon', 'Polygon Tool' ), key: 'G' },
			{ id: 'star', icon: '★', title: t( 'layers-tool-star', 'Star Tool' ), key: 'S' },
			{ id: 'arrow', icon: '→', title: t( 'layers-tool-arrow', 'Arrow Tool' ), key: 'A' },
			{ id: 'line', icon: '/', title: t( 'layers-tool-line', 'Line Tool' ), key: 'L' },
			{ id: 'highlight', icon: '▒', title: t( 'layers-tool-highlight', 'Highlight Tool' ), key: 'H' },
			{ id: 'blur', icon: '◼︎', title: t( 'layers-tool-blur', 'Blur/Redact Tool' ), key: 'B' },
			{ id: 'marquee', icon: '⬚', title: t( 'layers-tool-marquee', 'Marquee Select' ), key: 'M' }
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

		// Color pickers (modern dialog-based)
		const colorContainer = document.createElement( 'div' );
		colorContainer.className = 'color-input-group';

		// Stroke color button
		const strokeColorWrapper = document.createElement( 'div' );
		strokeColorWrapper.className = 'color-input-wrapper';
		const strokeBtn = document.createElement( 'button' );
		strokeBtn.type = 'button';
		strokeBtn.className = 'color-display-button stroke-color';
		strokeBtn.setAttribute( 'aria-label', t( 'layers-prop-stroke-color', 'Stroke Color' ) );
		strokeBtn.setAttribute( 'aria-haspopup', 'dialog' );
		strokeBtn.setAttribute( 'aria-expanded', 'false' );
		self.updateColorButtonDisplay( strokeBtn, '#000000', colorPickerStrings.transparent, colorPickerStrings.previewTemplate );
		strokeColorWrapper.appendChild( strokeBtn );
		colorContainer.appendChild( strokeColorWrapper );
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

		// Fill color button
		const fillColorWrapper = document.createElement( 'div' );
		fillColorWrapper.className = 'color-input-wrapper';
		const fillBtn = document.createElement( 'button' );
		fillBtn.type = 'button';
		fillBtn.className = 'color-display-button fill-color';
		fillBtn.setAttribute( 'aria-label', t( 'layers-prop-fill-color', 'Fill Color' ) );
		fillBtn.setAttribute( 'aria-haspopup', 'dialog' );
		fillBtn.setAttribute( 'aria-expanded', 'false' );
		self.updateColorButtonDisplay( fillBtn, '#ffffff', colorPickerStrings.transparent, colorPickerStrings.previewTemplate );
		fillColorWrapper.appendChild( fillBtn );
		colorContainer.appendChild( fillColorWrapper );
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

		styleGroup.appendChild( colorContainer );

		// Stroke width with numeric input only
		const strokeWidthContainer = document.createElement( 'div' );
		strokeWidthContainer.className = 'stroke-width-container';

		const strokeLabel = document.createElement( 'label' );
		strokeLabel.textContent = t( 'layers-prop-stroke-width', 'Stroke' ) + ':';
		strokeLabel.className = 'stroke-label';

		const strokeWidth = document.createElement( 'input' );
		strokeWidth.type = 'number';
		strokeWidth.min = '0';
		strokeWidth.max = '100';
		strokeWidth.step = '1';
		strokeWidth.value = '2';
		strokeWidth.className = 'stroke-width-input';
		strokeWidth.title = t( 'layers-prop-stroke-width', 'Stroke Width' ) + ': 2px';
		strokeWidth.placeholder = '0-100px';

		strokeWidthContainer.appendChild( strokeLabel );
		strokeWidthContainer.appendChild( strokeWidth );
		styleGroup.appendChild( strokeWidthContainer );

		// Font size (for text tool)
		const fontSizeContainer = document.createElement( 'div' );
		fontSizeContainer.className = 'font-size-container';
		fontSizeContainer.style.display = 'none';

		const fontLabel = document.createElement( 'label' );
		fontLabel.textContent = t( 'layers-prop-font-size', 'Font Size' ) + ':';
		fontLabel.className = 'font-label';

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
			{ id: 'delete', icon: '🗑', title: t( 'layers-delete-selected', 'Delete Selected' ), key: 'Delete' },
			{ id: 'duplicate', icon: '⧉', title: t( 'layers-duplicate-selected', 'Duplicate Selected' ), key: 'Ctrl+D' },
			{ id: 'grid', icon: '⊞', title: t( 'layers-toggle-grid', 'Toggle Grid' ), key: 'G' },
			{ id: 'rulers', icon: '📏', title: t( 'layers-toggle-rulers', 'Toggle Rulers' ) },
			{ id: 'guides', icon: '➕', title: t( 'layers-toggle-guides', 'Toggle Guides' ) },
			{ id: 'snap-grid', icon: '🧲⊞', title: t( 'layers-toggle-snap-grid', 'Snap to Grid' ) },
			{ id: 'snap-guides', icon: '🧲▭', title: t( 'layers-toggle-snap-guides', 'Snap to Guides' ) }
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
		importButton.textContent = t( 'layers-import', 'Import' );
		importButton.title = t( 'layers-import', 'Import' );
		actionGroup.appendChild( importButton );

		const importInput = document.createElement( 'input' );
		importInput.type = 'file';
		importInput.accept = '.json,application/json';
		importInput.style.display = 'none';
		actionGroup.appendChild( importInput );

		// Export button
		const exportButton = document.createElement( 'button' );
		exportButton.className = 'toolbar-button export-button';
		exportButton.textContent = t( 'layers-export', 'Export' );
		exportButton.title = t( 'layers-export', 'Export' );
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
			self.editor.cancel();
		} );

		// Import JSON
		this.importButton.addEventListener( 'click', () => {
			self.importInput.click();
		} );

		this.importInput.addEventListener( 'change', function () {
			const file = this.files && this.files[ 0 ];
			if ( !file ) {
				return;
			}
			// Confirm overwrite if there are unsaved changes
			if ( self.editor && self.editor.isDirty ) {
				const msg = ( mw.message ? mw.message( 'layers-import-unsaved-confirm' ).text() : 'You have unsaved changes. Import anyway?' );
				// eslint-disable-next-line no-alert
				if ( !window.confirm( msg ) ) {
					self.importInput.value = '';
					return;
				}
			}
			const reader = new FileReader();
			reader.onload = function () {
				try {
					const text = String( reader.result || '' );
					const parsed = JSON.parse( text );
					let layers;
					if ( Array.isArray( parsed ) ) {
						layers = parsed;
					} else if ( parsed && Array.isArray( parsed.layers ) ) {
						layers = parsed.layers;
					} else {
						layers = [];
					}
					if ( !Array.isArray( layers ) ) {
						throw new Error( 'Invalid JSON format' );
					}
					// Save state and replace layers
					if ( self.editor && typeof self.editor.saveState === 'function' ) {
						self.editor.saveState( 'import' );
					}
					self.editor.layers = layers.map( ( layer ) => {
						const obj = layer || {};
						if ( !obj.id ) {
							obj.id = 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 9 );
						}
						return obj;
					} );
					if ( self.editor && self.editor.canvasManager && typeof self.editor.canvasManager.renderLayers === 'function' ) {
						const layers = self.editor.stateManager ? self.editor.stateManager.get( 'layers' ) || [] : [];
						self.editor.canvasManager.renderLayers( layers );
					}
					if ( self.editor && typeof self.editor.markDirty === 'function' ) {
						self.editor.markDirty();
					}
					if ( window.mw && window.mw.notify ) {
						mw.notify( ( mw.message ? mw.message( 'layers-import-success' ).text() : 'Import complete' ), { type: 'success' } );
					}
				} catch ( err ) {
					if ( window.mw && window.mw.notify ) {
						mw.notify( ( mw.message ? mw.message( 'layers-import-error' ).text() : 'Import failed' ), { type: 'error' } );
					}
				}
				self.importInput.value = '';
			};
			reader.onerror = function () {
				if ( window.mw && window.mw.notify ) {
					mw.notify( ( mw.message ? mw.message( 'layers-import-error' ).text() : 'Import failed' ), { type: 'error' } );
				}
				self.importInput.value = '';
			};
			reader.readAsText( file );
		} );

		// Export JSON
		this.exportButton.addEventListener( 'click', () => {
			try {
				let data = [];
				// Try to get layers from StateManager first, then fallback to bridge property
				if ( self.editor && self.editor.stateManager && typeof self.editor.stateManager.getLayers === 'function' ) {
					data = self.editor.stateManager.getLayers();
				} else if ( self.editor && Array.isArray( self.editor.layers ) ) {
					data = self.editor.layers;
				}
				const json = JSON.stringify( data, null, 2 );
				const fname = ( self.editor && self.editor.filename ? self.editor.filename : 'layers' ) + '.layers.json';
				const blob = new Blob( [ json ], { type: 'application/json' } );
				// IE 11 and old Edge
				if ( window.navigator && window.navigator.msSaveOrOpenBlob ) {
					window.navigator.msSaveOrOpenBlob( blob, fname );
					return;
				}

				const a = document.createElement( 'a' );
				a.style.display = 'none';
				a.download = fname;
				// Use data URL for broad compatibility without relying on window.URL
				a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent( json );
				document.body.appendChild( a );
				a.click();
				setTimeout( () => {
					document.body.removeChild( a );
				}, 0 );
			} catch ( e ) {
				if ( window.mw && window.mw.notify ) {
					mw.notify( ( mw.message ? mw.message( 'layers-export-error' ).text() : 'Export failed' ), { type: 'error' } );
				}
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

		// Keyboard shortcuts
		this.keyboardShortcutHandler = function ( e ) {
			self.handleKeyboardShortcuts( e );
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

	Toolbar.prototype.handleKeyboardShortcuts = function ( e ) {
		// Don't handle shortcuts when typing in input fields
		if ( e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true' ) {
			return;
		}

		const key = e.key.toLowerCase();
		const ctrl = e.ctrlKey || e.metaKey;

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
				case 'b':
					this.selectTool( 'blur' );
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

}() );
