/**
 * Color Picker Dialog Component
 * A reusable color picker dialog with standard colors, custom colors, and a custom input.
 *
 * @module ColorPickerDialog
 */
( function () {
	'use strict';

	/**
	 * Default color picker strings (fallbacks if i18n not available)
	 *
	 * @constant {Object}
	 */
	const DEFAULT_STRINGS = {
		title: 'Choose color',
		standard: 'Standard colors',
		saved: 'Saved colors',
		customSection: 'Custom color',
		none: 'No fill (transparent)',
		emptySlot: 'Empty slot - colors will be saved here automatically',
		cancel: 'Cancel',
		apply: 'Apply',
		transparent: 'Transparent',
		swatchTemplate: 'Set color to $1',
		previewTemplate: 'Current color: $1'
	};

	/**
	 * Standard color palette
	 *
	 * @constant {string[]}
	 */
	const STANDARD_COLORS = [
		'#000000', '#404040', '#808080', '#c0c0c0', '#ffffff',
		'#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff',
		'#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
		'#ff4500', '#ffa500', '#ffff00', '#adff2f', '#00ff7f', '#00bfff',
		'#1e90ff', '#9370db', '#ff69b4', '#ffdab9', '#f0e68c', '#e0ffff',
		'#ffe4e1', '#dcdcdc', '#a9a9a9'
	];

	/**
	 * LocalStorage key for saved custom colors
	 *
	 * @constant {string}
	 */
	const STORAGE_KEY = 'layers-custom-colors';

	/**
	 * Maximum number of custom color slots
	 *
	 * @constant {number}
	 */
	const MAX_CUSTOM_COLORS = 16;

	/**
	 * ColorPickerDialog class
	 *
	 * @class ColorPickerDialog
	 */
class ColorPickerDialog {
	/**
	 * Creates a new ColorPickerDialog instance
	 *
	 * @param {Object} config - Configuration options
	 * @param {string} [config.currentColor] - The currently selected color
	 * @param {Function} config.onApply - Callback when color is applied: function(color)
	 * @param {Function} [config.onCancel] - Callback when dialog is cancelled
	 * @param {Object} [config.strings] - i18n strings (see DEFAULT_STRINGS for keys)
	 * @param {HTMLElement} [config.anchorElement] - Element to position dialog near
	 * @param {Function} [config.registerCleanup] - Function to register cleanup callback
	 */
	constructor( config ) {
		this.config = config || {};
		this.currentColor = config.currentColor || '#000000';
		this.selectedColor = this.currentColor;
		this.onApply = config.onApply || function () {};
		this.onCancel = config.onCancel || function () {};
		this.strings = Object.assign( {}, DEFAULT_STRINGS, config.strings || {} );
		this.anchorElement = config.anchorElement || null;
		this.registerCleanup = config.registerCleanup || function () {};

		this.overlay = null;
		this.dialog = null;
		this.selectedButton = null;
		this.escapeHandler = null;
		this.focusTrapHandler = null;
		this.previouslyFocused = null;
	}

	/**
	 * Format a template string with a value
	 *
	 * @param {string} template - Template with $1 placeholder
	 * @param {string} value - Value to substitute
	 * @return {string} Formatted string
	 */
	formatTemplate( template, value ) {
		if ( typeof template !== 'string' ) {
			return value;
		}
		return template.indexOf( '$1' ) !== -1 ? template.replace( '$1', value ) : template + ' ' + value;
	}

	/**
	 * Get saved custom colors from localStorage
	 *
	 * @return {string[]} Array of color hex values
	 */
	getSavedColors() {
		try {
			return JSON.parse( localStorage.getItem( STORAGE_KEY ) || '[]' );
		} catch ( e ) {
			// localStorage parse failed or unavailable
			if ( window.mw && window.mw.log ) {
				mw.log.warn( '[ColorPickerDialog] Failed to load saved colors:', e.message );
			}
			return [];
		}
	}

	/**
	 * Save a custom color to localStorage
	 * @param {string} color - Color hex value to save
	 */
	saveCustomColor ( color ) {
		if ( !color || color === 'none' ) {
			return;
		}
		try {
			let colors = this.getSavedColors();
			if ( colors.indexOf( color ) === -1 ) {
				colors.unshift( color );
				colors = colors.slice( 0, MAX_CUSTOM_COLORS );
				localStorage.setItem( STORAGE_KEY, JSON.stringify( colors ) );
			}
		} catch ( e ) {
			// localStorage might be unavailable or quota exceeded
			if ( window.mw && window.mw.log ) {
				mw.log.warn( '[ColorPickerDialog] Failed to save custom color:', e.message );
			}
		}
	}

	/**
	 * Create a swatch button element
	 * @param {string} color - Color value or 'none'
	 * @param {string} ariaLabel - Accessible label
	 * @param {boolean} isNone - Whether this is the "no color" button
	 * @return {HTMLButtonElement} The button element
	 */
	createSwatchButton ( color, ariaLabel, isNone ) {
		const btn = document.createElement( 'button' );
		btn.type = 'button';
		btn.className = isNone ? 'color-picker-none-btn' : 'color-picker-swatch-btn';
		btn.title = isNone ? this.strings.none : color;
		btn.setAttribute( 'aria-label', ariaLabel );

		if ( !isNone ) {
			btn.style.backgroundColor = color;
		}

		btn.addEventListener( 'click', () => {
			this.selectedColor = isNone ? 'none' : color;
			this.updateSelection( btn );
		} );

		return btn;
	}

	/**
	 * Update the selected button state
	 * @param {HTMLButtonElement} button - Button to select
	 */
	updateSelection ( button ) {
		if ( this.selectedButton ) {
			this.selectedButton.classList.remove( 'selected' );
		}
		if ( button ) {
			button.classList.add( 'selected' );
			this.selectedButton = button;
		}
	}

	/**
	 * Calculate dialog position based on anchor element
	 * @return {Object} Position with top and left properties
	 */
	calculatePosition () {
		const defaultPos = { top: 100, left: 100 };

		if ( !this.anchorElement ) {
			return defaultPos;
		}

		const rect = this.anchorElement.getBoundingClientRect();
		const dialogHeight = 420;
		const dialogWidth = 300;

		let top = rect.bottom + 5;
		let left = rect.left;

		// Ensure dialog stays within viewport
		const maxTop = window.innerHeight - dialogHeight;
		const maxLeft = window.innerWidth - dialogWidth;

		if ( top > maxTop ) {
			top = rect.top - dialogHeight - 5;
		}
		if ( left > maxLeft ) {
			left = maxLeft;
		}
		if ( left < 10 ) {
			left = 10;
		}
		if ( top < 10 ) {
			top = 10;
		}

		return { top: Math.floor( top ), left: Math.floor( left ) };
	}

	/**
	 * Create the dialog DOM structure
	 * @return {Object} Object with overlay and dialog elements
	 */
	createDialogDOM () {
		const strings = this.strings;

		// Overlay
		const overlay = document.createElement( 'div' );
		overlay.className = 'color-picker-overlay';
		overlay.setAttribute( 'role', 'presentation' );
		overlay.setAttribute( 'aria-hidden', 'true' );

		// Dialog container
		const dialog = document.createElement( 'div' );
		dialog.className = 'color-picker-dialog';
		dialog.setAttribute( 'role', 'dialog' );
		dialog.setAttribute( 'aria-modal', 'true' );
		dialog.setAttribute( 'tabindex', '-1' );

		const pos = this.calculatePosition();
		dialog.style.top = pos.top + 'px';
		dialog.style.left = pos.left + 'px';

		const dialogId = 'layers-color-picker-' + Math.random().toString( 36 ).slice( 2 );

		// Title
		const title = document.createElement( 'h3' );
		title.className = 'color-picker-title';
		title.id = dialogId + '-title';
		title.textContent = strings.title;
		dialog.setAttribute( 'aria-labelledby', title.id );
		dialog.appendChild( title );

		// Standard colors section
		const standardSection = document.createElement( 'div' );
		standardSection.className = 'color-picker-section';

		const standardTitle = document.createElement( 'div' );
		standardTitle.className = 'color-picker-section-title';
		standardTitle.id = dialogId + '-standard';
		standardTitle.textContent = strings.standard;
		dialog.setAttribute( 'aria-describedby', standardTitle.id );
		standardSection.appendChild( standardTitle );

		const standardGrid = document.createElement( 'div' );
		standardGrid.className = 'color-picker-grid';

		// "None" button
		const noneBtn = this.createSwatchButton( 'none', strings.none, true );
		if ( this.selectedColor === 'none' ) {
			this.updateSelection( noneBtn );
		}
		standardGrid.appendChild( noneBtn );

		// Standard color buttons
		STANDARD_COLORS.forEach( ( color ) => {
			const btn = this.createSwatchButton(
				color,
				this.formatTemplate( strings.swatchTemplate, color ),
				false
			);
			standardGrid.appendChild( btn );
		} );

		standardSection.appendChild( standardGrid );
		dialog.appendChild( standardSection );

		// Custom colors section
		const customSection = document.createElement( 'div' );
		customSection.className = 'color-picker-section';

		const customTitle = document.createElement( 'div' );
		customTitle.className = 'color-picker-section-title';
		customTitle.textContent = strings.saved;
		customSection.appendChild( customTitle );

		const customGrid = document.createElement( 'div' );
		customGrid.className = 'color-picker-grid';

		const savedColors = this.getSavedColors();
		for ( let i = 0; i < MAX_CUSTOM_COLORS; i++ ) {
			const customBtn = document.createElement( 'button' );
			customBtn.type = 'button';
			customBtn.className = 'color-picker-swatch-btn';
			customBtn.dataset.slot = i;

			if ( savedColors[ i ] ) {
				customBtn.style.backgroundColor = savedColors[ i ];
				customBtn.title = savedColors[ i ];
				customBtn.setAttribute( 'aria-label', this.formatTemplate( strings.swatchTemplate, savedColors[ i ] ) );
				( ( btn, color ) => {
					btn.addEventListener( 'click', () => {
						this.selectedColor = color;
						this.updateSelection( btn );
					} );
				} )( customBtn, savedColors[ i ] );
			} else {
				customBtn.style.backgroundColor = '#f5f5f5';
				customBtn.title = strings.emptySlot;
				customBtn.setAttribute( 'aria-label', strings.emptySlot );
			}

			customGrid.appendChild( customBtn );
		}

		customSection.appendChild( customGrid );
		dialog.appendChild( customSection );

		// Custom color input section
		const inputSection = document.createElement( 'div' );
		inputSection.className = 'color-picker-section';

		const inputLabel = document.createElement( 'div' );
		inputLabel.className = 'color-picker-section-title';
		inputLabel.textContent = strings.customSection;
		inputSection.appendChild( inputLabel );

		const customInput = document.createElement( 'input' );
		customInput.type = 'color';
		customInput.className = 'color-picker-custom-input';
		customInput.setAttribute( 'aria-label', strings.customSection );
		customInput.addEventListener( 'change', () => {
			this.selectedColor = customInput.value;
		} );
		inputSection.appendChild( customInput );
		dialog.appendChild( inputSection );

		// Action buttons
		const buttonContainer = document.createElement( 'div' );
		buttonContainer.className = 'color-picker-actions';

		const cancelBtn = document.createElement( 'button' );
		cancelBtn.type = 'button';
		cancelBtn.className = 'color-picker-btn color-picker-btn--secondary';
		cancelBtn.textContent = strings.cancel;
		cancelBtn.addEventListener( 'click', () => {
			this.close();
			this.onCancel();
		} );

		const okBtn = document.createElement( 'button' );
		okBtn.type = 'button';
		okBtn.className = 'color-picker-btn color-picker-btn--primary';
		okBtn.textContent = strings.apply;
		okBtn.addEventListener( 'click', () => {
			// Save custom color if it's new
			if ( this.selectedColor !== 'none' && this.selectedColor !== this.currentColor ) {
				this.saveCustomColor( this.selectedColor );
			}
			this.close();
			this.onApply( this.selectedColor );
		} );

		buttonContainer.appendChild( cancelBtn );
		buttonContainer.appendChild( okBtn );
		dialog.appendChild( buttonContainer );

		// Close on overlay click
		overlay.addEventListener( 'click', ( e ) => {
			if ( e.target === overlay ) {
				this.close();
				this.onCancel();
			}
		} );

		return { overlay: overlay, dialog: dialog };
	}

	/**
	 * Set up keyboard event handlers
	 */
	setupKeyboardHandlers () {
		const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

		// Escape to close
		this.escapeHandler = ( e ) => {
			if ( e.key === 'Escape' ) {
				this.close();
				this.onCancel();
			}
		};
		document.addEventListener( 'keydown', this.escapeHandler );

		// Focus trap
		this.focusTrapHandler = ( e ) => {
			if ( e.key !== 'Tab' ) {
				return;
			}

			const focusable = this.dialog.querySelectorAll( focusableSelector );
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
		this.dialog.addEventListener( 'keydown', this.focusTrapHandler );
	}

	/**
	 * Open the color picker dialog
	 */
	open () {
		this.previouslyFocused = document.activeElement;

		const dom = this.createDialogDOM();
		this.overlay = dom.overlay;
		this.dialog = dom.dialog;

		document.body.appendChild( this.overlay );
		document.body.appendChild( this.dialog );

		this.setupKeyboardHandlers();

		// Register cleanup for external management
		this.registerCleanup( this.close.bind( this ) );

		// Update anchor element aria state if provided
		if ( this.anchorElement ) {
			this.anchorElement.setAttribute( 'aria-expanded', 'true' );
		}

		// Focus first focusable element
		const focusable = this.dialog.querySelectorAll( 'button, input' );
		if ( focusable.length ) {
			focusable[ 0 ].focus();
		} else {
			this.dialog.focus();
		}
	}

	/**
	 * Close the color picker dialog
	 */
	close () {
		// Remove event listeners
		if ( this.escapeHandler ) {
			document.removeEventListener( 'keydown', this.escapeHandler );
			this.escapeHandler = null;
		}

		if ( this.focusTrapHandler && this.dialog ) {
			this.dialog.removeEventListener( 'keydown', this.focusTrapHandler );
			this.focusTrapHandler = null;
		}

		// Remove DOM elements
		if ( this.overlay && this.overlay.parentNode ) {
			this.overlay.parentNode.removeChild( this.overlay );
		}
		if ( this.dialog && this.dialog.parentNode ) {
			this.dialog.parentNode.removeChild( this.dialog );
		}

		// Update anchor element aria state
		if ( this.anchorElement ) {
			this.anchorElement.setAttribute( 'aria-expanded', 'false' );
		}

		// Restore focus
		if ( this.previouslyFocused && typeof this.previouslyFocused.focus === 'function' ) {
			this.previouslyFocused.focus();
		}

		this.overlay = null;
		this.dialog = null;
	}

	/**
	 * Static helper to create a color display button
	 *
	 * @param {Object} config - Configuration
	 * @param {string} config.color - Current color value
	 * @param {Object} config.strings - i18n strings
	 * @param {Function} config.onClick - Click handler
	 * @return {HTMLButtonElement} Color display button
	 */
	static createColorButton( config ) {
		const strings = config.strings || DEFAULT_STRINGS;
		const color = config.color;
		const onClick = config.onClick || function () {};

		const button = document.createElement( 'button' );
		button.type = 'button';
		button.className = 'color-display-button';
		button.style.width = '30px';
		button.style.height = '30px';
		button.style.border = '1px solid #ccc';
		button.style.borderRadius = '4px';
		button.style.cursor = 'pointer';
		button.style.marginLeft = '8px';
		button.setAttribute( 'aria-haspopup', 'dialog' );
		button.setAttribute( 'aria-expanded', 'false' );

		ColorPickerDialog.updateColorButton( button, color, strings );

		button.addEventListener( 'click', onClick );

		return button;
	}

	/**
	 * Static helper to update a color display button's appearance
	 *
	 * @param {HTMLButtonElement} button - The button to update
	 * @param {string} color - New color value
	 * @param {Object} [strings] - i18n strings
	 */
	static updateColorButton( button, color, strings ) {
		strings = strings || DEFAULT_STRINGS;
		let labelValue = color;

		if ( !color || color === 'none' || color === 'transparent' ) {
			button.style.background = 'repeating-linear-gradient(45deg, #ff0000 0, #ff0000 4px, transparent 4px, transparent 8px)';
			labelValue = strings.transparent;
		} else {
			button.style.background = color;
		}

		button.title = labelValue;

		const template = strings.previewTemplate || 'Current color: $1';
		const ariaLabel = template.indexOf( '$1' ) !== -1 ?
			template.replace( '$1', labelValue ) :
			template + ' ' + labelValue;
		button.setAttribute( 'aria-label', ariaLabel );
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.ColorPickerDialog = ColorPickerDialog;

			// DEPRECATED: Direct window export - use window.Layers.UI.ColorPickerDialog instead
			// This will be removed in a future version
		window.ColorPickerDialog = ColorPickerDialog;
	}

	// Node.js/CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ColorPickerDialog;
	}
}() );
