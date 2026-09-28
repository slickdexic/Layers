/**
 * Shows the drawing's name in the page-owned editor and lets the user rename it.
 * A rename is an edit like any other: it is published by the next save, never by this control.
 */
( function () {
	'use strict';

	const FORBIDDEN = '| [ ] { } < > :';

	function failure( code ) {
		const error = new Error( code );
		error.code = code;
		return error;
	}

	class PageOwnedNameControl {
		/**
		 * @param {Object} options
		 * @param {Function} options.getName Returns the current name
		 * @param {Function} options.rename Applies a name, returns it as saved, or throws with a code
		 * @param {Function} options.prompt Resolves to the entered text, or null when cancelled
		 * @param {Function} options.message Localization function (key, ...args) => string
		 * @param {Function} options.notify Shows (text, type) to the user
		 */
		constructor( options ) {
			if ( !options || [ 'getName', 'rename', 'prompt', 'message', 'notify' ]
				.some( ( key ) => typeof options[ key ] !== 'function' ) ) {
				throw failure( 'layers-invalid-name-control' );
			}
			this.options = options;
			this.container = null;
			this.nameElement = null;
			this.button = null;
			this.pending = false;
			this.disposed = false;
			this.clickHandler = () => this._handleClick();
		}

		/**
		 * @param {HTMLElement} parent Editor header
		 * @param {?HTMLElement} before Child of parent to insert before, or null to append
		 */
		mount( parent, before ) {
			if ( this.disposed || this.container || !parent || typeof parent.insertBefore !== 'function' ) {
				throw failure( 'layers-invalid-mount-target' );
			}
			this.container = document.createElement( 'div' );
			this.container.className = 'layers-page-drawing-name';
			this.nameElement = document.createElement( 'span' );
			this.nameElement.className = 'layers-page-drawing-name-text';
			this.button = document.createElement( 'button' );
			this.button.type = 'button';
			this.button.className = 'layers-page-drawing-rename';
			this.button.textContent = this.options.message( 'layers-page-drawing-rename' );
			this.button.setAttribute( 'aria-label', this.options.message( 'layers-page-drawing-rename-title' ) );
			this.button.addEventListener( 'click', this.clickHandler );
			this.container.appendChild( this.nameElement );
			this.container.appendChild( this.button );
			parent.insertBefore( this.container, before || null );
			this._showName();
		}

		/** @private */
		_showName() {
			this.nameElement.textContent = this.options.message( 'layers-page-drawing-name', this.options.getName() );
		}

		/** @private */
		async _handleClick() {
			if ( this.disposed || this.pending ) {
				return;
			}
			this.pending = true;
			this.button.disabled = true;
			try {
				const current = this.options.getName();
				const entered = await this.options.prompt( {
					title: this.options.message( 'layers-page-drawing-rename-title' ),
					message: this.options.message( 'layers-page-drawing-rename-prompt' ),
					defaultValue: current,
					confirmText: this.options.message( 'layers-page-drawing-rename' )
				} );
				if ( this.disposed || typeof entered !== 'string' || entered.trim() === '' ||
					entered.trim() === current ) {
					return;
				}
				let label;
				try {
					label = this.options.rename( entered );
				} catch ( error ) {
					const code = error && error.code;
					if ( code === 'layers-page-drawing-rename-invalid' || code === 'layers-page-drawing-rename-taken' ) {
						// Literal brackets and braces in the message itself would break the browser's message parser.
						this.options.notify( this.options.message( code, entered.trim(), FORBIDDEN ), 'error' );
					} else {
						this.options.notify( this.options.message( 'layers-page-drawing-rename-failed' ), 'error' );
					}
					return;
				}
				this._showName();
				if ( label !== current ) {
					this.options.notify( this.options.message( 'layers-page-drawing-renamed', label ), 'info' );
				}
			} finally {
				this.pending = false;
				if ( !this.disposed ) {
					this.button.disabled = false;
					this.button.focus();
				}
			}
		}

		/** Idempotent; late prompt results are ignored. */
		dispose() {
			if ( this.disposed ) {
				return;
			}
			this.disposed = true;
			if ( this.button ) {
				this.button.removeEventListener( 'click', this.clickHandler );
			}
			if ( this.container ) {
				this.container.remove();
			}
			this.container = null;
			this.nameElement = null;
			this.button = null;
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedNameControl = PageOwnedNameControl;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedNameControl;
	}
}() );
