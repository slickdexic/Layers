/**
 * Lists other pages' drawings in the page-owned editor and sends the author to the confirmation page that
 * copies one into this page as a new drawing (D1). The control only searches and links; it never writes.
 */
( function () {
	'use strict';

	const SEARCH_DELAY = 250;

	function failure( code ) {
		const error = new Error( code );
		error.code = code;
		return error;
	}

	class PageOwnedCopyPicker {
		/**
		 * @param {Object} options
		 * @param {Function} options.search (text) => Promise of pages { title, pageid, revid, drawings: [ { id, label, kind } ] }
		 * @param {Function} options.copyUrl (page, drawing) => URL of the confirmation page
		 * @param {Function} options.isDirty Whether the editor holds unsaved changes
		 * @param {Function} options.message Localization function (key, ...args) => string
		 */
		constructor( options ) {
			if ( !options || [ 'search', 'copyUrl', 'isDirty', 'message' ]
				.some( ( key ) => typeof options[ key ] !== 'function' ) ) {
				throw failure( 'layers-invalid-copy-picker' );
			}
			this.options = options;
			this.button = null;
			this.dialog = null;
			this.request = 0;
			this.timer = null;
			this.disposed = false;
			this.opener = () => this.open();
			this.onKeydown = ( event ) => this._handleKeydown( event );
		}

		/**
		 * @param {HTMLElement} parent Editor header
		 * @param {?HTMLElement} before Child of parent to insert before, or null to append
		 */
		mount( parent, before ) {
			if ( this.disposed || this.button || !parent || typeof parent.insertBefore !== 'function' ) {
				throw failure( 'layers-invalid-mount-target' );
			}
			this.button = document.createElement( 'button' );
			this.button.type = 'button';
			this.button.className = 'layers-page-drawing-rename layers-page-drawing-copy';
			this.button.textContent = this.options.message( 'layers-page-copy-from-page' );
			this.button.addEventListener( 'click', this.opener );
			parent.insertBefore( this.button, before || null );
		}

		open() {
			if ( this.disposed || this.dialog ) {
				return;
			}
			const message = this.options.message;
			const dialog = document.createElement( 'div' );
			dialog.className = 'layers-page-copy-overlay';
			const panel = document.createElement( 'div' );
			panel.className = 'layers-page-copy-dialog';
			panel.setAttribute( 'role', 'dialog' );
			panel.setAttribute( 'aria-modal', 'true' );
			panel.setAttribute( 'aria-labelledby', 'layers-page-copy-title' );
			const title = document.createElement( 'h2' );
			title.id = 'layers-page-copy-title';
			title.textContent = message( 'layers-page-copy-title' );
			const input = document.createElement( 'input' );
			input.type = 'search';
			input.className = 'layers-page-copy-search';
			input.setAttribute( 'aria-label', message( 'layers-page-copy-search' ) );
			input.placeholder = message( 'layers-page-copy-search' );
			const status = document.createElement( 'p' );
			status.className = 'layers-page-copy-status';
			status.setAttribute( 'role', 'status' );
			const list = document.createElement( 'ul' );
			list.className = 'layers-page-copy-results';
			const close = document.createElement( 'button' );
			close.type = 'button';
			close.className = 'layers-page-drawing-rename layers-page-copy-close';
			close.textContent = message( 'layers-page-copy-close' );
			close.addEventListener( 'click', () => this.close() );
			panel.append( title );
			if ( this.options.isDirty() ) {
				const warning = document.createElement( 'p' );
				warning.className = 'layers-page-copy-unsaved';
				warning.textContent = message( 'layers-page-copy-unsaved' );
				panel.append( warning );
			}
			panel.append( input, status, list, close );
			dialog.appendChild( panel );
			dialog.addEventListener( 'mousedown', ( event ) => {
				if ( event.target === dialog ) {
					this.close();
				}
			} );
			document.body.appendChild( dialog );
			document.addEventListener( 'keydown', this.onKeydown, true );
			this.dialog = { root: dialog, input, status, list, close };
			input.addEventListener( 'input', () => {
				clearTimeout( this.timer );
				this.timer = setTimeout( () => this._search( input.value ), SEARCH_DELAY );
			} );
			input.focus();
			this._search( '' );
		}

		close() {
			if ( !this.dialog ) {
				return;
			}
			clearTimeout( this.timer );
			this.request++;
			document.removeEventListener( 'keydown', this.onKeydown, true );
			this.dialog.root.remove();
			this.dialog = null;
			if ( !this.disposed && this.button ) {
				this.button.focus();
			}
		}

		/** @private */
		_handleKeydown( event ) {
			if ( !this.dialog ) {
				return;
			}
			if ( event.key === 'Escape' ) {
				// The editor's own Escape handling must not also close the editor.
				event.preventDefault();
				event.stopPropagation();
				this.close();
				return;
			}
			if ( event.key === 'Tab' ) {
				const focusable = Array.from( this.dialog.root.querySelectorAll( 'input, a[href], button' ) );
				const first = focusable[ 0 ];
				const last = focusable[ focusable.length - 1 ];
				if ( event.shiftKey && document.activeElement === first ) {
					event.preventDefault();
					last.focus();
				} else if ( !event.shiftKey && document.activeElement === last ) {
					event.preventDefault();
					first.focus();
				}
			}
		}

		/** @private */
		_search( text ) {
			const dialog = this.dialog;
			const request = ++this.request;
			dialog.status.textContent = this.options.message( 'layers-page-copy-searching' );
			Promise.resolve().then( () => this.options.search( text.trim() ) ).then( ( pages ) => {
				if ( this.disposed || this.dialog !== dialog || request !== this.request ) {
					return;
				}
				this._show( pages );
			}, () => {
				if ( this.disposed || this.dialog !== dialog || request !== this.request ) {
					return;
				}
				dialog.list.textContent = '';
				dialog.status.textContent = this.options.message( 'layers-page-copy-failed' );
			} );
		}

		/** @private */
		_show( pages ) {
			const { list, status } = this.dialog;
			list.textContent = '';
			let count = 0;
			for ( const page of pages ) {
				for ( const drawing of page.drawings ) {
					const item = document.createElement( 'li' );
					const link = document.createElement( 'a' );
					link.href = this.options.copyUrl( page, drawing );
					link.textContent = this.options.message( 'layers-page-copy-result', drawing.label, page.title );
					item.appendChild( link );
					list.appendChild( item );
					count++;
				}
			}
			status.textContent = count ?
				this.options.message( 'layers-page-copy-count', count ) :
				this.options.message( 'layers-page-copy-none' );
		}

		/** Idempotent. */
		dispose() {
			if ( this.disposed ) {
				return;
			}
			this.close();
			this.disposed = true;
			if ( this.button ) {
				this.button.removeEventListener( 'click', this.opener );
				this.button.remove();
			}
			this.button = null;
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedCopyPicker = PageOwnedCopyPicker;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedCopyPicker;
	}
}() );
