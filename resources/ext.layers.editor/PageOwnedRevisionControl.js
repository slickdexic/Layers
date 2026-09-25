/**
 * Accessible presentation control for deliberate page-owned revision reconciliation.
 * Mounts a native button and an aria-live text-only status element.
 * Never initiates publication or automatically saves.
 */
( function () {
	'use strict';

	/**
	 * Create a standardized Error with a fixed code.
	 *
	 * @param {string} code
	 * @return {Error}
	 */
	function failure( code ) {
		const error = new Error( code );
		error.code = code;
		return error;
	}

	class PageOwnedRevisionControl {
		/**
		 * @param {Object} options
		 * @param {Function} options.check Injected async function returning reconciliation status
		 * @param {Function} options.message Injected localization function (key, ...args) => string
		 */
		constructor( options ) {
			if ( !options || typeof options !== 'object' || Array.isArray( options ) ) {
				throw failure( 'layers-invalid-revision-control' );
			}
			if ( typeof options.check !== 'function' || typeof options.message !== 'function' ) {
				throw failure( 'layers-invalid-revision-control' );
			}

			this.check = options.check;
			this.message = options.message;

			this.mounted = false;
			this.disposed = false;
			this.pending = false;

			this.container = null;
			this.button = null;
			this.status = null;
			this.clickHandler = null;
		}

		/**
		 * Validate that the returned status matches the expected contract.
		 * Required: phase === 'ready', integer revisionId (1..2147483647), and
		 * booleans dirty, editorStateValid, draftPersisted.
		 *
		 * @param {*} result
		 * @return {boolean}
		 * @private
		 */
		_isValidResult( result ) {
			return Boolean(
				result &&
				typeof result === 'object' &&
				!Array.isArray( result ) &&
				result.phase === 'ready' &&
				Number.isInteger( result.revisionId ) &&
				result.revisionId >= 1 &&
				result.revisionId <= 2147483647 &&
				typeof result.dirty === 'boolean' &&
				typeof result.editorStateValid === 'boolean' &&
				typeof result.draftPersisted === 'boolean'
			);
		}

		/**
		 * Mount the control into the parent DOM node.
		 * Mounting never calls check.
		 *
		 * @param {HTMLElement|Node} parent
		 */
		mount( parent ) {
			if ( this.disposed ) {
				throw failure( 'layers-revision-control-disposed' );
			}
			if ( this.mounted ) {
				throw failure( 'layers-control-already-mounted' );
			}
			if ( !parent || typeof parent.appendChild !== 'function' ) {
				throw failure( 'layers-invalid-mount-target' );
			}

			this.container = document.createElement( 'div' );
			this.container.className = 'layers-page-revision-control';

			this.button = document.createElement( 'button' );
			this.button.type = 'button';
			this.button.className = 'layers-page-revision-check-button';
			this.button.textContent = this.message( 'layers-page-revision-check-button' );

			this.status = document.createElement( 'span' );
			this.status.className = 'layers-page-revision-check-status';
			this.status.setAttribute( 'role', 'status' );
			this.status.setAttribute( 'aria-live', 'polite' );

			this.clickHandler = () => {
				this._handleClick();
			};
			this.button.addEventListener( 'click', this.clickHandler );

			this.container.appendChild( this.button );
			this.container.appendChild( this.status );
			parent.appendChild( this.container );

			this.mounted = true;
		}

		/**
		 * Handle button click. Calls check exactly once, disabling button while pending.
		 * Repeated clicks while pending do nothing.
		 * Keeps focus on the existing button; does not replace the DOM tree.
		 *
		 * @private
		 */
		async _handleClick() {
			if ( this.disposed || this.pending || !this.button || !this.status ) {
				return;
			}

			const hadFocus = ( typeof document !== 'undefined' && document.activeElement === this.button );

			this.pending = true;
			this.button.disabled = true;
			this.status.textContent = String( this.message( 'layers-page-revision-check-checking' ) || '' );

			let messageKey = 'layers-page-revision-check-failed';
			try {
				const result = await this.check();
				if ( this.disposed ) {
					return;
				}

				if ( this._isValidResult( result ) ) {
					if ( result.draftPersisted === false ) {
						messageKey = 'layers-page-revision-check-backup-failed';
					} else if ( result.editorStateValid === false ) {
						messageKey = 'layers-page-revision-check-invalid-edits';
					} else if ( result.dirty === true ) {
						messageKey = 'layers-page-revision-check-ready';
					} else {
						messageKey = 'layers-page-revision-check-matched';
					}
				} else {
					messageKey = 'layers-page-revision-check-failed';
				}
			} catch ( error ) {
				if ( this.disposed ) {
					return;
				}

				const isConflict = Boolean(
					error &&
					( error.code === 'layers-editor-reconciliation-required' ||
					error.message === 'layers-editor-reconciliation-required' )
				);

				if ( isConflict ) {
					messageKey = 'layers-page-revision-check-conflict';
				} else {
					messageKey = 'layers-page-revision-check-failed';
				}
			} finally {
				this.pending = false;
				if ( !this.disposed && this.button && this.status ) {
					this.status.textContent = String( this.message( messageKey ) || '' );
					this.button.disabled = false;
					// Restore focus lost by disabling the button, but never steal it from another control.
					if ( hadFocus && typeof this.button.focus === 'function' && document.activeElement === document.body ) {
						this.button.focus();
					}
				}
			}
		}

		/**
		 * Dispose of the control.
		 * Removes DOM elements and listeners, idempotent, makes late results inert.
		 */
		dispose() {
			if ( this.disposed ) {
				return;
			}

			this.disposed = true;
			this.mounted = false;

			if ( this.button && this.clickHandler ) {
				this.button.removeEventListener( 'click', this.clickHandler );
				this.clickHandler = null;
			}

			if ( this.container ) {
				if ( typeof this.container.remove === 'function' ) {
					this.container.remove();
				} else if ( this.container.parentNode ) {
					this.container.parentNode.removeChild( this.container );
				}
			}

			this.container = null;
			this.button = null;
			this.status = null;
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedRevisionControl = PageOwnedRevisionControl;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedRevisionControl;
	}
}() );
