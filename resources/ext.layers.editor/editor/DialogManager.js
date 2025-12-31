/**
 * DialogManager - Handles modal dialogs for the Layers Editor
 *
 * Extracted from LayersEditor.js for better separation of concerns.
 * Manages confirmation dialogs, prompts, and future dialog types.
 *
 * @class DialogManager
 */
( function () {
	'use strict';

	/**
	 * DialogManager handles all modal dialog operations
	 *
	 * @param {Object} config Configuration object
	 * @param {Object} config.editor Reference to the LayersEditor instance
	 */
	class DialogManager {
		constructor( config ) {
			this.editor = config.editor;
			this.activeDialogs = [];
		}

		/**
		 * Get a localized message
		 * @param {string} key Message key
		 * @param {string} fallback Fallback text
		 * @return {string} Localized message
		 */
		getMessage( key, fallback = '' ) {
			if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
				return window.layersMessages.get( key, fallback );
			}
			return fallback;
		}

		/**
		 * Create a modal overlay element
		 * @return {HTMLElement} The overlay element
		 * @private
		 */
		createOverlay() {
			const overlay = document.createElement( 'div' );
			overlay.className = 'layers-modal-overlay';
			overlay.setAttribute( 'role', 'presentation' );
			return overlay;
		}

		/**
		 * Create a modal dialog element
		 * @param {string} ariaLabel ARIA label for the dialog
		 * @return {HTMLElement} The dialog element
		 * @private
		 */
		createDialog( ariaLabel ) {
			const dialog = document.createElement( 'div' );
			dialog.className = 'layers-modal-dialog';
			dialog.setAttribute( 'role', 'alertdialog' );
			dialog.setAttribute( 'aria-modal', 'true' );
			dialog.setAttribute( 'aria-label', ariaLabel );
			return dialog;
		}

		/**
		 * Create a button element
		 * @param {string} text Button text
		 * @param {string} className CSS class names
		 * @return {HTMLButtonElement} The button element
		 * @private
		 */
		createButton( text, className ) {
			const button = document.createElement( 'button' );
			button.textContent = text;
			button.className = className;
			return button;
		}

		/**
		 * Set up keyboard handling for a dialog
		 * @param {HTMLElement} dialog The dialog element
		 * @param {Function} onEscape Callback when Escape is pressed
		 * @return {Function} The keydown handler (for cleanup)
		 * @private
		 */
		setupKeyboardHandler( dialog, onEscape ) {
			const handleKey = ( e ) => {
				if ( e.key === 'Escape' ) {
					onEscape();
				} else if ( e.key === 'Tab' ) {
					const focusable = dialog.querySelectorAll( 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])' );
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
			document.addEventListener( 'keydown', handleKey );
			return handleKey;
		}

		/**
		 * Show a confirmation dialog for canceling with unsaved changes
		 *
		 * @param {Function} onConfirm Callback when user confirms discarding changes
		 * @return {void}
		 */
		showCancelConfirmDialog( onConfirm ) {
			const overlay = this.createOverlay();
			const dialog = this.createDialog( this.getMessage( 'layers-confirm-title', 'Confirm' ) );

			const text = document.createElement( 'p' );
			text.textContent = this.getMessage(
				'layers-cancel-confirm',
				'You have unsaved changes. Are you sure you want to close the editor? All changes will be lost.'
			);
			dialog.appendChild( text );

			const buttons = document.createElement( 'div' );
			buttons.className = 'layers-modal-buttons';

			const cancelBtn = this.createButton(
				this.getMessage( 'layers-cancel-continue', 'Continue Editing' ),
				'layers-btn layers-btn-primary'
			);

			const confirmBtn = this.createButton(
				this.getMessage( 'layers-cancel-discard', 'Discard Changes' ),
				'layers-btn layers-btn-secondary layers-btn-danger'
			);

			buttons.appendChild( cancelBtn );
			buttons.appendChild( confirmBtn );
			dialog.appendChild( buttons );

			document.body.appendChild( overlay );
			document.body.appendChild( dialog );

			// Track active dialog
			this.activeDialogs.push( { overlay, dialog } );

			const cleanup = () => {
				if ( overlay.parentNode ) {
					overlay.parentNode.removeChild( overlay );
				}
				if ( dialog.parentNode ) {
					dialog.parentNode.removeChild( dialog );
				}
				document.removeEventListener( 'keydown', handleKey );
				// Remove from active dialogs
				const index = this.activeDialogs.findIndex( ( d ) => d.dialog === dialog );
				if ( index !== -1 ) {
					this.activeDialogs.splice( index, 1 );
				}
			};

			const handleKey = this.setupKeyboardHandler( dialog, cleanup );

			cancelBtn.addEventListener( 'click', cleanup );
			confirmBtn.addEventListener( 'click', () => {
				cleanup();
				onConfirm();
			} );

			// Focus the "Continue Editing" button (safer default)
			cancelBtn.focus();
		}

		/**
		 * Show a generic confirmation dialog (Promise-based replacement for window.confirm)
		 *
		 * @param {Object} options Dialog options
		 * @param {string} options.message The message to display
		 * @param {string} [options.title] Optional title
		 * @param {string} [options.confirmText] Text for confirm button (default: 'OK')
		 * @param {string} [options.cancelText] Text for cancel button (default: 'Cancel')
		 * @param {boolean} [options.isDanger] Whether this is a destructive action
		 * @return {Promise<boolean>} Resolves to true if confirmed, false if cancelled
		 */
		showConfirmDialog( options ) {
			return new Promise( ( resolve ) => {
				const overlay = this.createOverlay();
				const dialog = this.createDialog( options.title || this.getMessage( 'layers-confirm-title', 'Confirm' ) );

				// Title
				if ( options.title ) {
					const titleEl = document.createElement( 'h3' );
					titleEl.className = 'layers-modal-title';
					titleEl.textContent = options.title;
					dialog.appendChild( titleEl );
				}

				// Message
				const message = document.createElement( 'p' );
				message.textContent = options.message;
				dialog.appendChild( message );

				// Buttons
				const buttons = document.createElement( 'div' );
				buttons.className = 'layers-modal-buttons';

				const cancelBtn = this.createButton(
					options.cancelText || this.getMessage( 'layers-cancel', 'Cancel' ),
					'layers-btn layers-btn-secondary'
				);

				const confirmBtnClass = options.isDanger
					? 'layers-btn layers-btn-primary layers-btn-danger'
					: 'layers-btn layers-btn-primary';
				const confirmBtn = this.createButton(
					options.confirmText || this.getMessage( 'layers-ok', 'OK' ),
					confirmBtnClass
				);

				buttons.appendChild( cancelBtn );
				buttons.appendChild( confirmBtn );
				dialog.appendChild( buttons );

				document.body.appendChild( overlay );
				document.body.appendChild( dialog );

				// Track active dialog
				this.activeDialogs.push( { overlay, dialog } );

				const cleanup = () => {
					if ( overlay.parentNode ) {
						overlay.parentNode.removeChild( overlay );
					}
					if ( dialog.parentNode ) {
						dialog.parentNode.removeChild( dialog );
					}
					document.removeEventListener( 'keydown', handleKey );
					const index = this.activeDialogs.findIndex( ( d ) => d.dialog === dialog );
					if ( index !== -1 ) {
						this.activeDialogs.splice( index, 1 );
					}
				};

				const handleKey = this.setupKeyboardHandler( dialog, () => {
					cleanup();
					resolve( false );
				} );

				cancelBtn.addEventListener( 'click', () => {
					cleanup();
					resolve( false );
				} );

				confirmBtn.addEventListener( 'click', () => {
					cleanup();
					resolve( true );
				} );

				// Focus the cancel button by default (safer)
				cancelBtn.focus();
			} );
		}

		/**
		 * Show an alert dialog (Promise-based replacement for window.alert)
		 *
		 * @param {Object} options Dialog options
		 * @param {string} options.message The message to display
		 * @param {string} [options.title] Optional title
		 * @param {string} [options.type] Type: 'error', 'warning', 'info' (affects styling)
		 * @return {Promise<void>} Resolves when user dismisses the alert
		 */
		showAlertDialog( options ) {
			return new Promise( ( resolve ) => {
				const overlay = this.createOverlay();
				const dialog = this.createDialog( options.title || this.getMessage( 'layers-alert-title', 'Alert' ) );

				// Add type class if specified
				if ( options.type ) {
					dialog.classList.add( 'layers-modal-' + options.type );
				}

				// Title
				if ( options.title ) {
					const titleEl = document.createElement( 'h3' );
					titleEl.className = 'layers-modal-title';
					titleEl.textContent = options.title;
					dialog.appendChild( titleEl );
				}

				// Message
				const message = document.createElement( 'p' );
				message.textContent = options.message;
				dialog.appendChild( message );

				// Button
				const buttons = document.createElement( 'div' );
				buttons.className = 'layers-modal-buttons';

				const okBtn = this.createButton(
					this.getMessage( 'layers-ok', 'OK' ),
					'layers-btn layers-btn-primary'
				);

				buttons.appendChild( okBtn );
				dialog.appendChild( buttons );

				document.body.appendChild( overlay );
				document.body.appendChild( dialog );

				// Track active dialog
				this.activeDialogs.push( { overlay, dialog } );

				const cleanup = () => {
					if ( overlay.parentNode ) {
						overlay.parentNode.removeChild( overlay );
					}
					if ( dialog.parentNode ) {
						dialog.parentNode.removeChild( dialog );
					}
					document.removeEventListener( 'keydown', handleKey );
					const index = this.activeDialogs.findIndex( ( d ) => d.dialog === dialog );
					if ( index !== -1 ) {
						this.activeDialogs.splice( index, 1 );
					}
				};

				const handleKey = this.setupKeyboardHandler( dialog, () => {
					cleanup();
					resolve();
				} );

				okBtn.addEventListener( 'click', () => {
					cleanup();
					resolve();
				} );

				okBtn.focus();
			} );
		}

		/**
		 * Show a prompt dialog for text input (Promise-based replacement for window.prompt)
		 *
		 * @param {Object} options Dialog options
		 * @param {string} [options.title] Dialog title
		 * @param {string} [options.message] Prompt message
		 * @param {string} [options.placeholder] Input placeholder
		 * @param {string} [options.defaultValue] Default input value
		 * @param {string} [options.confirmText] Text for confirm button
		 * @param {string} [options.cancelText] Text for cancel button
		 * @return {Promise<string|null>} Resolves to input value if confirmed, null if cancelled
		 */
		showPromptDialogAsync( options ) {
			return new Promise( ( resolve ) => {
				const overlay = this.createOverlay();
				const dialog = this.createDialog( options.title || this.getMessage( 'layers-prompt-title', 'Input' ) );

				// Title
				if ( options.title ) {
					const titleEl = document.createElement( 'h3' );
					titleEl.className = 'layers-modal-title';
					titleEl.textContent = options.title;
					dialog.appendChild( titleEl );
				}

				// Message
				if ( options.message ) {
					const message = document.createElement( 'p' );
					message.textContent = options.message;
					dialog.appendChild( message );
				}

				// Input
				const input = document.createElement( 'input' );
				input.type = 'text';
				input.className = 'layers-modal-input';
				input.placeholder = options.placeholder || '';
				input.value = options.defaultValue || '';
				dialog.appendChild( input );

				// Buttons
				const buttons = document.createElement( 'div' );
				buttons.className = 'layers-modal-buttons';

				const cancelBtn = this.createButton(
					options.cancelText || this.getMessage( 'layers-cancel', 'Cancel' ),
					'layers-btn layers-btn-secondary'
				);

				const confirmBtn = this.createButton(
					options.confirmText || this.getMessage( 'layers-ok', 'OK' ),
					'layers-btn layers-btn-primary'
				);

				buttons.appendChild( cancelBtn );
				buttons.appendChild( confirmBtn );
				dialog.appendChild( buttons );

				document.body.appendChild( overlay );
				document.body.appendChild( dialog );

				// Track active dialog
				this.activeDialogs.push( { overlay, dialog } );

				const cleanup = () => {
					if ( overlay.parentNode ) {
						overlay.parentNode.removeChild( overlay );
					}
					if ( dialog.parentNode ) {
						dialog.parentNode.removeChild( dialog );
					}
					document.removeEventListener( 'keydown', handleKey );
					const index = this.activeDialogs.findIndex( ( d ) => d.dialog === dialog );
					if ( index !== -1 ) {
						this.activeDialogs.splice( index, 1 );
					}
				};

				const handleKey = ( e ) => {
					if ( e.key === 'Escape' ) {
						cleanup();
						resolve( null );
					} else if ( e.key === 'Enter' ) {
						cleanup();
						resolve( input.value );
					} else if ( e.key === 'Tab' ) {
						const focusable = dialog.querySelectorAll( 'button, input' );
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
				document.addEventListener( 'keydown', handleKey );

				cancelBtn.addEventListener( 'click', () => {
					cleanup();
					resolve( null );
				} );

				confirmBtn.addEventListener( 'click', () => {
					cleanup();
					resolve( input.value );
				} );

				// Focus input for immediate typing
				input.focus();
				input.select();
			} );
		}

		/**
		 * Show a prompt dialog for text input
		 *
		 * @param {Object} options Dialog options
		 * @param {string} options.title Dialog title
		 * @param {string} options.message Prompt message
		 * @param {string} options.placeholder Input placeholder
		 * @param {string} options.defaultValue Default input value
		 * @param {Function} options.onConfirm Callback with input value
		 * @param {Function} options.onCancel Callback when cancelled
		 * @return {void}
		 */
		showPromptDialog( options ) {
			const overlay = this.createOverlay();
			const dialog = this.createDialog( options.title || 'Input' );

			// Title
			if ( options.title ) {
				const title = document.createElement( 'h3' );
				title.className = 'layers-modal-title';
				title.textContent = options.title;
				dialog.appendChild( title );
			}

			// Message
			if ( options.message ) {
				const message = document.createElement( 'p' );
				message.textContent = options.message;
				dialog.appendChild( message );
			}

			// Input
			const input = document.createElement( 'input' );
			input.type = 'text';
			input.className = 'layers-modal-input';
			input.placeholder = options.placeholder || '';
			input.value = options.defaultValue || '';
			dialog.appendChild( input );

			// Buttons
			const buttons = document.createElement( 'div' );
			buttons.className = 'layers-modal-buttons';

			const cancelBtn = this.createButton(
				this.getMessage( 'layers-cancel', 'Cancel' ),
				'layers-btn layers-btn-secondary'
			);

			const confirmBtn = this.createButton(
				this.getMessage( 'layers-ok', 'OK' ),
				'layers-btn layers-btn-primary'
			);

			buttons.appendChild( cancelBtn );
			buttons.appendChild( confirmBtn );
			dialog.appendChild( buttons );

			document.body.appendChild( overlay );
			document.body.appendChild( dialog );

			// Track active dialog
			this.activeDialogs.push( { overlay, dialog } );

			const cleanup = () => {
				if ( overlay.parentNode ) {
					overlay.parentNode.removeChild( overlay );
				}
				if ( dialog.parentNode ) {
					dialog.parentNode.removeChild( dialog );
				}
				document.removeEventListener( 'keydown', handleKey );
				const index = this.activeDialogs.findIndex( ( d ) => d.dialog === dialog );
				if ( index !== -1 ) {
					this.activeDialogs.splice( index, 1 );
				}
			};

			const handleKey = ( e ) => {
				if ( e.key === 'Escape' ) {
					cleanup();
					if ( options.onCancel ) {
						options.onCancel();
					}
				} else if ( e.key === 'Enter' ) {
					cleanup();
					if ( options.onConfirm ) {
						options.onConfirm( input.value );
					}
				} else if ( e.key === 'Tab' ) {
					const focusable = dialog.querySelectorAll( 'button, input' );
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
			document.addEventListener( 'keydown', handleKey );

			cancelBtn.addEventListener( 'click', () => {
				cleanup();
				if ( options.onCancel ) {
					options.onCancel();
				}
			} );

			confirmBtn.addEventListener( 'click', () => {
				cleanup();
				if ( options.onConfirm ) {
					options.onConfirm( input.value );
				}
			} );

			// Focus the input
			input.focus();
			input.select();
		}

		/**
		 * Show keyboard shortcuts help dialog
		 * @return {void}
		 */
		showKeyboardShortcutsDialog() {
			const overlay = this.createOverlay();
			const dialog = this.createDialog( this.getMessage( 'layers-shortcuts-dialog-title', 'Keyboard Shortcuts' ) );
			dialog.classList.add( 'layers-shortcuts-dialog' );

			// Title
			const title = document.createElement( 'h3' );
			title.className = 'layers-modal-title';
			title.textContent = this.getMessage( 'layers-shortcuts-dialog-title', 'Keyboard Shortcuts' );
			dialog.appendChild( title );

			// Shortcuts list - grouped by category
			const shortcuts = [
				// Edit commands
				{ key: 'Ctrl+Z', action: this.getMessage( 'layers-undo', 'Undo' ) },
				{ key: 'Ctrl+Y', action: this.getMessage( 'layers-redo', 'Redo' ) },
				{ key: 'Ctrl+S', action: this.getMessage( 'layers-editor-save', 'Save' ) },
				{ key: 'Ctrl+C', action: this.getMessage( 'layers-shortcut-copy', 'Copy' ) },
				{ key: 'Ctrl+X', action: this.getMessage( 'layers-shortcut-cut', 'Cut' ) },
				{ key: 'Ctrl+V', action: this.getMessage( 'layers-shortcut-paste', 'Paste' ) },
				{ key: 'Delete', action: this.getMessage( 'layers-delete-selected', 'Delete Selected' ) },
				{ key: 'Ctrl+D', action: this.getMessage( 'layers-duplicate-selected', 'Duplicate Selected' ) },
				{ key: 'Ctrl+A', action: this.getMessage( 'layers-shortcut-select-all', 'Select All' ) },
				{ key: 'Escape', action: this.getMessage( 'layers-shortcut-deselect', 'Deselect / Cancel' ) },
				// Layer organization
				{ key: 'Ctrl+G', action: this.getMessage( 'layers-shortcut-group', 'Group Layers' ) },
				{ key: 'Ctrl+Shift+G', action: this.getMessage( 'layers-shortcut-ungroup', 'Ungroup' ) },
				// Tools
				{ key: 'V', action: this.getMessage( 'layers-tool-select', 'Select Tool' ) },
				{ key: 'T', action: this.getMessage( 'layers-tool-text', 'Text' ) },
				{ key: 'X', action: this.getMessage( 'layers-tool-textbox', 'Text Box' ) },
				{ key: 'P', action: this.getMessage( 'layers-tool-pen', 'Pen' ) },
				{ key: 'R', action: this.getMessage( 'layers-tool-rectangle', 'Rectangle' ) },
				{ key: 'C', action: this.getMessage( 'layers-tool-circle', 'Circle' ) },
				{ key: 'E', action: this.getMessage( 'layers-tool-ellipse', 'Ellipse' ) },
				{ key: 'Y', action: this.getMessage( 'layers-tool-polygon', 'Polygon' ) },
				{ key: 'S', action: this.getMessage( 'layers-tool-star', 'Star' ) },
				{ key: 'A', action: this.getMessage( 'layers-tool-arrow', 'Arrow' ) },
				{ key: 'L', action: this.getMessage( 'layers-tool-line', 'Line' ) },
				{ key: 'B', action: this.getMessage( 'layers-tool-blur', 'Blur' ) },
				// View
				{ key: '+/=', action: this.getMessage( 'layers-zoom-in', 'Zoom In' ) },
				{ key: '-', action: this.getMessage( 'layers-zoom-out', 'Zoom Out' ) },
				{ key: '0', action: this.getMessage( 'layers-zoom-fit', 'Fit to Window' ) },
				{ key: ';', action: this.getMessage( 'layers-shortcut-smart-guides', 'Toggle Smart Guides' ) },
				{ key: 'Shift+B', action: this.getMessage( 'layers-toggle-background', 'Toggle Background' ) },
				// Help
				{ key: 'Shift+?', action: this.getMessage( 'layers-shortcut-show-help', 'Show Keyboard Shortcuts' ) }
			];

			const list = document.createElement( 'dl' );
			list.className = 'layers-shortcuts-list';

			shortcuts.forEach( ( shortcut ) => {
				const dt = document.createElement( 'dt' );
				const kbd = document.createElement( 'kbd' );
				kbd.textContent = shortcut.key;
				dt.appendChild( kbd );

				const dd = document.createElement( 'dd' );
				dd.textContent = shortcut.action;

				list.appendChild( dt );
				list.appendChild( dd );
			} );

			dialog.appendChild( list );

			// Close button
			const buttons = document.createElement( 'div' );
			buttons.className = 'layers-modal-buttons';

			const closeBtn = this.createButton(
				this.getMessage( 'layers-shortcuts-dialog-close', 'Close' ),
				'layers-btn layers-btn-primary'
			);

			buttons.appendChild( closeBtn );
			dialog.appendChild( buttons );

			document.body.appendChild( overlay );
			document.body.appendChild( dialog );

			// Track active dialog
			this.activeDialogs.push( { overlay, dialog } );

			const cleanup = () => {
				if ( overlay.parentNode ) {
					overlay.parentNode.removeChild( overlay );
				}
				if ( dialog.parentNode ) {
					dialog.parentNode.removeChild( dialog );
				}
				document.removeEventListener( 'keydown', handleKey );
				const index = this.activeDialogs.findIndex( ( d ) => d.dialog === dialog );
				if ( index !== -1 ) {
					this.activeDialogs.splice( index, 1 );
				}
			};

			const handleKey = this.setupKeyboardHandler( dialog, cleanup );

			closeBtn.addEventListener( 'click', cleanup );
			overlay.addEventListener( 'click', cleanup );

			// Focus close button
			closeBtn.focus();
		}

		/**
		 * Close all active dialogs
		 * @return {void}
		 */
		closeAllDialogs() {
			// Clone array since we modify it during iteration
			const dialogs = [ ...this.activeDialogs ];
			dialogs.forEach( ( { overlay, dialog } ) => {
				if ( overlay.parentNode ) {
					overlay.parentNode.removeChild( overlay );
				}
				if ( dialog.parentNode ) {
					dialog.parentNode.removeChild( dialog );
				}
			} );
			this.activeDialogs = [];
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.closeAllDialogs();
			this.editor = null;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.DialogManager = DialogManager;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = DialogManager;
	}

}() );
