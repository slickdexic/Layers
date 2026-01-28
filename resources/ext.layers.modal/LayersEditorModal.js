/**
 * LayersEditorModal - Opens the Layers Editor in a modal overlay
 *
 * This module enables inline editing of layers without navigating away from
 * the current page. Particularly useful for Page Forms workflows where
 * navigation would lose unsaved form data.
 *
 * @module LayersEditorModal
 */
( function () {
	'use strict';

	/**
	 * Get message from MediaWiki i18n
	 * @param {string} key Message key
	 * @param {string} fallback Fallback text
	 * @return {string} Message text
	 */
	function getMessage( key, fallback ) {
		if ( window.mw && mw.message ) {
			const msg = mw.message( key );
			if ( msg.exists() ) {
				return msg.text();
			}
		}
		return fallback;
	}

	/**
	 * LayersEditorModal class - manages modal overlay for layers editor
	 */
	class LayersEditorModal {
		constructor() {
			/** @type {HTMLElement|null} Modal overlay element */
			this.overlay = null;
			/** @type {HTMLIFrameElement|null} Editor iframe */
			this.iframe = null;
			/** @type {number} Original scroll position before modal */
			this.originalScrollPos = 0;
			/** @type {Function|null} Escape key handler */
			this.escapeHandler = null;
			/** @type {Function|null} PostMessage handler */
			this.messageHandler = null;
			/** @type {Function|null} Resolve function for promise */
			this.resolvePromise = null;
		}

		/**
		 * Open the editor in a modal overlay
		 * @param {string} filename - The file name (without File: namespace)
		 * @param {string} setname - The layer set name
		 * @param {string} [editorUrl] - Optional pre-built editor URL
		 * @return {Promise<{saved: boolean}>} Resolves when modal closes
		 */
		open( filename, setname, editorUrl ) {
			return new Promise( ( resolve ) => {
				this.resolvePromise = resolve;

				// Prevent body scroll
				this.originalScrollPos = window.scrollY;
				document.body.style.overflow = 'hidden';
				document.body.classList.add( 'layers-modal-open' );

				// Create modal overlay
				this.overlay = document.createElement( 'div' );
				this.overlay.className = 'layers-editor-modal-overlay';
				this.overlay.setAttribute( 'role', 'dialog' );
				this.overlay.setAttribute( 'aria-modal', 'true' );
				this.overlay.setAttribute( 'aria-label', getMessage( 'layers-editor-modal-title', 'Edit layers' ) );

				// Create header with close button
				const header = document.createElement( 'div' );
				header.className = 'layers-editor-modal-header';

				const title = document.createElement( 'span' );
				title.className = 'layers-editor-modal-title';
				title.textContent = getMessage( 'layers-editor-modal-title', 'Edit layers' ) + ': ' + filename;
				header.appendChild( title );

				const closeBtn = document.createElement( 'button' );
				closeBtn.className = 'layers-editor-modal-close';
				closeBtn.setAttribute( 'aria-label', getMessage( 'layers-editor-modal-close', 'Close editor' ) );
				closeBtn.innerHTML = '&times;';
				closeBtn.addEventListener( 'click', () => this.close( false ) );
				header.appendChild( closeBtn );

				this.overlay.appendChild( header );

				// Build editor URL if not provided
				if ( !editorUrl ) {
					const params = new URLSearchParams( {
						action: 'editlayers',
						setname: setname || '',
						modal: '1'
					} );
					// mw.util.getUrl may return URL with query string (e.g., index.php?title=...)
					// so we need to use & if ? already exists
					const baseUrl = mw.util.getUrl( 'File:' + filename );
					const separator = baseUrl.includes( '?' ) ? '&' : '?';
					editorUrl = baseUrl + separator + params.toString();
				}

				// Create iframe
				this.iframe = document.createElement( 'iframe' );
				this.iframe.className = 'layers-editor-modal-iframe';
				this.iframe.src = editorUrl;
				this.iframe.setAttribute( 'title', 'Layers Editor' );

				// Handle iframe load - hide modal header since editor has its own
				this.iframe.addEventListener( 'load', () => {
					this.setupMessageListener();
					// Hide the modal's header bar - the editor has its own close button
					// This avoids the confusing "two X buttons" UX
					if ( header && header.parentNode ) {
						header.style.display = 'none';
					}
					// Focus the iframe for keyboard accessibility
					this.iframe.focus();
				} );

				this.overlay.appendChild( this.iframe );

				// Handle Escape key
				this.escapeHandler = ( e ) => {
					if ( e.key === 'Escape' ) {
						this.close( false );
					}
				};
				document.addEventListener( 'keydown', this.escapeHandler );

				// Add to document
				document.body.appendChild( this.overlay );

				// Announce to screen readers
				if ( window.layersAnnouncer ) {
					window.layersAnnouncer.announce(
						getMessage( 'layers-editor-modal-title', 'Edit layers' ) + ' opened'
					);
				}
			} );
		}

		/**
		 * Setup postMessage listener for editor communication
		 * @private
		 */
		setupMessageListener() {
			this.messageHandler = ( event ) => {
				// Security: verify origin
				if ( event.origin !== window.location.origin ) {
					return;
				}

				const data = event.data;
				if ( !data || typeof data.type !== 'string' ) {
					return;
				}

				if ( data.type === 'layers-editor-close' ) {
					this.close( data.saved );
				} else if ( data.type === 'layers-editor-save' ) {
					// Notify host page of save
					this.onSave( data );
				}
			};
			window.addEventListener( 'message', this.messageHandler );
		}

		/**
		 * Close the modal
		 * @param {boolean} saved - Whether changes were saved
		 */
		close( saved ) {
			if ( this.overlay ) {
				this.overlay.remove();
				this.overlay = null;
			}

			// Restore body scroll
			document.body.style.overflow = '';
			document.body.classList.remove( 'layers-modal-open' );
			window.scrollTo( 0, this.originalScrollPos );

			// Clean up listeners
			if ( this.escapeHandler ) {
				document.removeEventListener( 'keydown', this.escapeHandler );
				this.escapeHandler = null;
			}
			if ( this.messageHandler ) {
				window.removeEventListener( 'message', this.messageHandler );
				this.messageHandler = null;
			}

			// Announce to screen readers
			if ( window.layersAnnouncer ) {
				window.layersAnnouncer.announce(
					getMessage( 'layers-editor-modal-close', 'Editor closed' )
				);
			}

			// Resolve the promise
			if ( this.resolvePromise ) {
				this.resolvePromise( { saved: !!saved } );
				this.resolvePromise = null;
			}

			// Dispatch custom event for page to handle
			const closeEvent = new CustomEvent( 'layers-modal-closed', {
				detail: { saved: !!saved }
			} );
			document.dispatchEvent( closeEvent );
		}

		/**
		 * Handle save event from editor
		 * @param {Object} data - Save event data
		 * @private
		 */
		onSave( data ) {
			// Dispatch custom event for page to react to save
			const event = new CustomEvent( 'layers-saved', { detail: data } );
			document.dispatchEvent( event );

			// Could refresh the layered image on the host page without full page reload
			if ( window.mw && mw.notify ) {
				mw.notify(
					getMessage( 'layers-editor-modal-saved', 'Layers saved' ),
					{ type: 'success' }
				);
			}
		}
	}

	/**
	 * Initialize click handlers for modal trigger links
	 * @param {jQuery|HTMLElement} $content - Content container
	 */
	function initModalTriggers( $content ) {
		const container = $content instanceof jQuery ? $content[ 0 ] : $content;
		if ( !container ) {
			return;
		}

		const triggers = container.querySelectorAll( '.layers-editor-modal-trigger, a[data-layers-modal]' );
		triggers.forEach( ( trigger ) => {
			// Skip if already initialized
			if ( trigger.dataset.layersModalInit ) {
				return;
			}
			trigger.dataset.layersModalInit = '1';

			trigger.addEventListener( 'click', ( e ) => {
				e.preventDefault();

				const filename = trigger.dataset.layersFilename;
				const setname = trigger.dataset.layersSetname || '';
				const editorUrl = trigger.dataset.layersEditorUrl;

				if ( !filename ) {
					if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
						mw.log.warn( '[LayersModal] Missing data-layers-filename attribute' );
					}
					return;
				}

				const modal = new LayersEditorModal();
				modal.open( filename, setname, editorUrl );
			} );
		} );
	}

	// Initialize on page load
	if ( typeof mw !== 'undefined' && mw.hook ) {
		mw.hook( 'wikipage.content' ).add( initModalTriggers );
	}

	// Export to namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Modal = window.Layers.Modal || {};
		window.Layers.Modal.LayersEditorModal = LayersEditorModal;
		window.Layers.Modal.initModalTriggers = initModalTriggers;
	}
}() );
