/**
 * Confirm Dialog Component
 * A reusable modal confirmation dialog with cancel/confirm actions.
 *
 * @module ConfirmDialog
 */
( function () {
	'use strict';

	/**
	 * Default dialog strings (fallbacks if i18n not available)
	 *
	 * @constant {Object}
	 */
	const DEFAULT_STRINGS = {
		title: 'Confirmation',
		cancel: 'Cancel',
		confirm: 'Confirm'
	};

	/**
	 * ConfirmDialog - A reusable modal confirmation dialog
	 *
	 * @class
	 */
	class ConfirmDialog {
		/**
		 * Creates a new ConfirmDialog instance
		 *
		 * @param {Object} config - Configuration options
		 * @param {string} config.message - The confirmation message to display
		 * @param {Function} config.onConfirm - Callback when confirmed
		 * @param {Function} [config.onCancel] - Callback when cancelled
		 * @param {Object} [config.strings] - i18n strings (see DEFAULT_STRINGS for keys)
		 * @param {string} [config.confirmClass] - CSS class for confirm button (default: 'layers-btn-danger')
		 * @param {Function} [config.registerCleanup] - Function to register cleanup callback
		 */
		constructor( config ) {
			this.config = config || {};
			this.message = config.message || '';
			this.onConfirm = config.onConfirm || function () {};
			this.onCancel = config.onCancel || function () {};
			this.strings = { ...DEFAULT_STRINGS, ...( config.strings || {} ) };
			this.confirmClass = config.confirmClass || 'layers-btn-danger';
			this.registerCleanup = config.registerCleanup || function () {};

			this.overlay = null;
			this.dialog = null;
			this.keydownHandler = null;
			this.previouslyFocused = null;
		}

		/**
		 * Create the dialog DOM structure
		 *
		 * @return {Object} Object with overlay and dialog elements
		 */
		createDialogDOM() {
		const strings = this.strings;

		// Overlay
		const overlay = document.createElement( 'div' );
		overlay.className = 'layers-modal-overlay';
		overlay.setAttribute( 'role', 'presentation' );

		// Dialog container
		const dialog = document.createElement( 'div' );
		dialog.className = 'layers-modal-dialog';
		dialog.setAttribute( 'role', 'alertdialog' );
		dialog.setAttribute( 'aria-modal', 'true' );
		dialog.setAttribute( 'aria-label', strings.title );

		// Message
		const text = document.createElement( 'p' );
		text.textContent = this.message;
		dialog.appendChild( text );

		// Button container
		const buttons = document.createElement( 'div' );
		buttons.className = 'layers-modal-buttons';

		// Cancel button
		const cancelBtn = document.createElement( 'button' );
		cancelBtn.textContent = strings.cancel;
		cancelBtn.className = 'layers-btn layers-btn-secondary';
		cancelBtn.type = 'button';
		cancelBtn.addEventListener( 'click', () => {
			this.close();
			this.onCancel();
		} );

		// Confirm button
		const confirmBtn = document.createElement( 'button' );
		confirmBtn.textContent = strings.confirm;
		confirmBtn.className = 'layers-btn ' + this.confirmClass;
		confirmBtn.type = 'button';
		confirmBtn.addEventListener( 'click', () => {
			this.close();
			this.onConfirm();
		} );

		buttons.appendChild( cancelBtn );
		buttons.appendChild( confirmBtn );
		dialog.appendChild( buttons );

		return { overlay: overlay, dialog: dialog, confirmBtn: confirmBtn };
	}

	/**
	 * Set up keyboard event handlers
	 */
	setupKeyboardHandlers() {
		this.keydownHandler = ( e ) => {
			if ( e.key === 'Escape' ) {
				this.close();
				this.onCancel();
			} else if ( e.key === 'Tab' ) {
				// Focus trap within dialog
				const focusable = this.dialog.querySelectorAll( 'button' );
				if ( focusable.length ) {
					const first = focusable[ 0 ];
					const last = focusable[ focusable.length - 1 ];

					if ( e.shiftKey && document.activeElement === first ) {
						e.preventDefault();
						last.focus();
					} else if ( !e.shiftKey && document.activeElement === last ) {
						e.preventDefault();
						first.focus();
					}
				}
			}
		};

		document.addEventListener( 'keydown', this.keydownHandler );
	}

	/**
	 * Open the confirmation dialog
	 */
	open() {
		this.previouslyFocused = document.activeElement;

		const dom = this.createDialogDOM();
		this.overlay = dom.overlay;
		this.dialog = dom.dialog;

		document.body.appendChild( this.overlay );
		document.body.appendChild( this.dialog );

		this.setupKeyboardHandlers();

		// Register cleanup for external management
		this.registerCleanup( this.close.bind( this ) );

		// Focus the confirm button
		dom.confirmBtn.focus();
	}

	/**
	 * Close the confirmation dialog
	 */
	close() {
		// Remove event listener
		if ( this.keydownHandler ) {
			document.removeEventListener( 'keydown', this.keydownHandler );
			this.keydownHandler = null;
		}

		// Remove DOM elements
		if ( this.overlay && this.overlay.parentNode ) {
			this.overlay.parentNode.removeChild( this.overlay );
		}
		if ( this.dialog && this.dialog.parentNode ) {
			this.dialog.parentNode.removeChild( this.dialog );
		}

		// Restore focus
		if ( this.previouslyFocused && typeof this.previouslyFocused.focus === 'function' ) {
			this.previouslyFocused.focus();
		}

		this.overlay = null;
		this.dialog = null;
	}

	/**
	 * Static helper for simple browser confirm fallback
	 *
	 * @param {string} message - The confirmation message
	 * @param {Function} [logger] - Optional logging function for unavailable dialog
	 * @return {boolean} User's choice
	 */
	static simpleConfirm( message, logger ) {
		if ( typeof window !== 'undefined' && typeof window.confirm === 'function' ) {
			return window.confirm( message );
		}
		if ( typeof logger === 'function' ) {
			logger( 'Confirmation dialog unavailable; auto-confirming action', message );
		}
		return true;
	}

	/**
	 * Static factory to show a confirmation dialog
	 *
	 * @param {Object} config - Configuration (same as constructor)
	 * @return {ConfirmDialog} The dialog instance
	 */
	static show( config ) {
		const dialog = new ConfirmDialog( config );
		dialog.open();
		return dialog;
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.ConfirmDialog = ConfirmDialog;
	}

	// Node.js/CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ConfirmDialog;
	}
}() );
