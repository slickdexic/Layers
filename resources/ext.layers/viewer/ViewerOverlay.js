/**
 * Viewer Overlay - Hover action buttons for layered images
 *
 * Adds edit (pencil) and view (expand) icons that appear on hover
 * over images with layer annotations. Respects user permissions.
 *
 * @module viewer/ViewerOverlay
 */
( function () {
	'use strict';

	/**
	 * Whether a set reference names a specific layer set rather than a generic
	 * wikitext intent such as 'on'. Prefers the shared rules in
	 * ext.layers.shared/SetNameUtil.js and falls back to an equivalent local
	 * check. Set names are user-defined and nothing is reserved.
	 *
	 * @param {*} value Raw set reference
	 * @return {boolean}
	 */
	function isSpecificSetName( value ) {
		const util = window.Layers && window.Layers.SetNameUtil;
		if ( util && typeof util.isSpecificName === 'function' ) {
			return util.isSpecificName( value );
		}
		// Equivalent local rules, so a load-order surprise can never silently
		// drop a user-defined set name from a request.
		if ( typeof value !== 'string' ) {
			return false;
		}
		const normalized = value.trim().toLowerCase();
		return normalized !== '' && [
			'on', 'true', 'all', '1', 'off', 'none', 'false', '0'
		].indexOf( normalized ) === -1;
	}

	/**
	 * SVG namespace for creating icons inline (fallback when IconFactory not available)
	 * @constant {string}
	 */
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const hostOverlays = new WeakMap();

	/**
	 * ViewerOverlay class - manages hover overlay for layered images
	 */
	class ViewerOverlay {
		/**
		 * Create a ViewerOverlay instance
		 * @param {Object} config Configuration options
		 * @param {HTMLElement} config.container The container element (positioned wrapper around image)
		 * @param {HTMLImageElement} [config.imageElement] Image element, required for legacy routes
		 * @param {string} [config.filename] File name, required for legacy routes
		 * @param {string} [config.setname] The layer set name; omit for an unnamed set
		 * @param {boolean} [config.canEdit=false] Whether user has edit permission
		 * @param {Function} [config.onEdit] Admitted edit callback, receiving the opener button
		 * @param {Function} [config.onView] View callback, receiving the opener button
		 * @param {boolean} [config.debug=false] Enable debug logging
		 */
		constructor( config ) {
			this.container = config.container;
			this.imageElement = config.imageElement;
			this.callbackMode = Object.prototype.hasOwnProperty.call( config, 'onEdit' ) ||
				Object.prototype.hasOwnProperty.call( config, 'onView' );
			this.onEdit = config.onEdit;
			this.onView = config.onView;
			this.destroyed = false;
			this.listeners = [];
			this.addedTabIndex = false;
			this.originalTabIndex = null;
			// Sanitize filename - strip any wikitext brackets that might have leaked through
			this.filename = ( config.filename || '' ).replace( /[\x5B\x5D]/g, '' );
			this.setname = config.setname || '';
			// Multi-page (PDF) support: which page this overlay's image represents
			this.page = parseInt( config.page, 10 );
			if ( !( this.page > 1 ) && this.imageElement ) {
				this.page = parseInt( this.imageElement.getAttribute( 'data-page' ), 10 );
			}
			if ( !( this.page > 1 ) ) {
				this.page = 1;
			}
			this.canEdit = this.callbackMode ? config.canEdit === true && typeof this.onEdit === 'function' :
				config.canEdit !== false && this._checkEditPermission();
			this.debug = config.debug || false;
			// Check if this is for a non-existent set that needs auto-creation
			this.autoCreate = config.autoCreate ||
				( this.imageElement && this.imageElement.getAttribute( 'data-layer-autocreate' ) === '1' );

			/** @type {HTMLElement|null} */
			this.overlay = null;
			/** @type {Function|null} */
			this.boundMouseEnter = null;
			/** @type {Function|null} */
			this.boundMouseLeave = null;
			/** @type {Function|null} */
			this.boundTouchStart = null;
			/** @type {number|null} */
			this.touchTimeout = null;

			this.init();
		}

		/**
		 * Log debug message if debug mode enabled
		 * @private
		 * @param {...any} args Log arguments
		 */
		debugLog( ...args ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
				mw.log( '[ViewerOverlay]', ...args );
			}
		}

		/**
		 * Check if current user has edit permission
		 * @private
		 * @return {boolean} True if user can edit layers
		 */
		_checkEditPermission() {
			if ( typeof mw === 'undefined' || !mw.config ) {
				return false;
			}
			// First check the dedicated config var exposed by Layers extension
			const canEdit = mw.config.get( 'wgLayersCanEdit' );
			if ( canEdit !== null && canEdit !== undefined ) {
				return !!canEdit;
			}
			// Fallback: check wgUserRights if available (not always exposed)
			const rights = mw.config.get( 'wgUserRights' );
			if ( rights && Array.isArray( rights ) ) {
				return rights.includes( 'editlayers' );
			}
			return false;
		}

		/**
		 * Get localized message with fallback
		 * @private
		 * @param {string} key Message key
		 * @param {string} fallback Fallback text
		 * @return {string} Message text
		 */
		_msg( key, fallback ) {
			if ( typeof mw !== 'undefined' && mw.message ) {
				const msg = mw.message( key );
				if ( msg.exists() ) {
					return msg.text();
				}
			}
			return fallback;
		}

		/**
		 * Initialize the overlay
		 */
		init() {
			if ( this.destroyed || this.overlay ) {
				return;
			}
			if ( !this.container || ( !this.callbackMode && !this.imageElement ) ) {
				this.debugLog( 'Missing container or image element' );
				return;
			}

			// Don't add overlay if no filename
			if ( !this.callbackMode && !this.filename ) {
				this.debugLog( 'No filename provided, skipping overlay' );
				return;
			}

			const previous = hostOverlays.get( this.container );
			if ( previous && previous !== this ) {
				previous.destroy();
			}
			hostOverlays.set( this.container, this );
			if ( this.container.tabIndex < 0 ) {
				this.originalTabIndex = this.container.getAttribute( 'tabindex' );
				this.container.setAttribute( 'tabindex', '0' );
				this.addedTabIndex = true;
			}
			this.createOverlay();
			this.attachEventListeners();
			this._attachPdfClickInterception();
			if ( this.container.contains( document.activeElement ) ) {
				this._showOverlay();
			}

			this.debugLog( 'Overlay initialized for', this.filename, 'canEdit:', this.canEdit );
		}

		/**
		 * For PDF files, intercept clicks on the thumbnail (or its wrapping
		 * anchor) so the marked-up page opens in the in-wiki lightbox viewer
		 * instead of navigating away to the browser's PDF view, where the layer
		 * overlay would not exist.
		 * @private
		 */
		_attachPdfClickInterception() {
			if ( this.callbackMode || !/\.pdf$/i.test( this.filename ) ) {
				return;
			}
			this._pdfClickTarget = this._findClickTarget();
			if ( !this._pdfClickTarget ) {
				return;
			}
			this._boundPdfClick = ( e ) => {
				// Respect modified clicks (open in new tab, etc.) and any handler
				// that already acted on the event.
				if ( e.defaultPrevented || e.button !== 0 || e.ctrlKey ||
					e.metaKey || e.shiftKey || e.altKey ) {
					return;
				}
				e.preventDefault();
				e.stopPropagation();
				this._handleViewClick();
			};
			this._listen( this._pdfClickTarget, 'click', this._boundPdfClick );
		}

		/**
		 * Resolve the element whose clicks should open the viewer: the anchor
		 * MediaWiki wraps around the thumbnail if present, else the image itself.
		 * @private
		 * @return {HTMLElement|null} Click target
		 */
		_findClickTarget() {
			if ( this.imageElement && typeof this.imageElement.closest === 'function' ) {
				const anchor = this.imageElement.closest( 'a' );
				if ( anchor ) {
					return anchor;
				}
			}
			return this.imageElement || null;
		}

		/**
		 * Create the overlay DOM structure
		 * @private
		 */
		createOverlay() {
			// Create overlay container
			this.overlay = document.createElement( 'div' );
			this.overlay.className = 'layers-viewer-overlay';
			this.overlay.setAttribute( 'role', 'toolbar' );
			this.overlay.setAttribute( 'aria-label', this._msg( 'layers-viewer-overlay-label', 'Layer actions' ) );

			// Add edit button if user has permission
			if ( this.canEdit ) {
				const editBtn = this._createButton(
					'edit',
					this._msg( 'layers-viewer-edit', 'Edit layers' ),
					( opener ) => this._handleEditClick( opener )
				);
				editBtn.appendChild( this._createPencilIcon() );
				this.overlay.appendChild( editBtn );
			}

			// Add view/expand button (always visible)
			const viewBtn = this._createButton(
				'view',
				this._msg( 'layers-viewer-view', 'View full size' ),
				( opener ) => this._handleViewClick( opener )
			);
			viewBtn.appendChild( this._createExpandIcon() );
			this.overlay.appendChild( viewBtn );

			// Add to container
			this.container.appendChild( this.overlay );
		}

		/**
		 * Create an action button
		 * @private
		 * @param {string} type Button type identifier
		 * @param {string} label Accessible label/tooltip
		 * @param {Function} onClick Click handler
		 * @return {HTMLButtonElement} Button element
		 */
		_createButton( type, label, onClick ) {
			const btn = document.createElement( 'button' );
			btn.className = 'layers-viewer-overlay-btn layers-viewer-overlay-btn--' + type;
			btn.setAttribute( 'type', 'button' );
			btn.setAttribute( 'title', label );
			btn.setAttribute( 'aria-label', label );
			this._listen( btn, 'click', ( e ) => {
				e.preventDefault();
				e.stopPropagation();
				onClick( e.currentTarget );
			} );
			// Prevent overlay from hiding when hovering over buttons
			this._listen( btn, 'mouseenter', ( e ) => {
				e.stopPropagation();
			} );
			return btn;
		}

		/**
		 * @private
		 * @param {HTMLElement} element Listener target
		 * @param {string} type Event type
		 * @param {Function} handler Listener
		 * @param {Object} [options] Listener options
		 */
		_listen( element, type, handler, options ) {
			element.addEventListener( type, handler, options );
			this.listeners.push( { element, type, handler, options } );
		}

		/**
		 * Create pencil icon SVG
		 * @private
		 * @return {SVGElement} Pencil icon
		 */
		/**
		 * Create pencil icon SVG for edit button.
		 * Delegates to shared ViewerIcons utility.
		 * @private
		 * @return {SVGElement} Pencil icon
		 */
		_createPencilIcon() {
			if ( window.Layers && window.Layers.ViewerIcons ) {
				return window.Layers.ViewerIcons.createPencilIcon( { size: 16, color: '#fff' } );
			}
			return document.createElementNS( SVG_NS, 'svg' );
		}

		/**
		 * Create expand/fullscreen icon SVG.
		 * Delegates to shared ViewerIcons utility.
		 * @private
		 * @return {SVGElement} Expand icon
		 */
		_createExpandIcon() {
			if ( window.Layers && window.Layers.ViewerIcons ) {
				return window.Layers.ViewerIcons.createExpandIcon( { size: 16, color: '#fff' } );
			}
			return document.createElementNS( SVG_NS, 'svg' );
		}

		/**
		 * Attach mouse/touch event listeners for show/hide
		 * @private
		 */
		attachEventListeners() {
			this.boundMouseEnter = () => this._showOverlay();
			this.boundMouseLeave = () => this._hideOverlay();
			this.boundTouchStart = ( e ) => this._handleTouchStart( e );
			this.boundFocusOut = ( e ) => {
				// Only hide if focus moves outside container
				if ( this.container && !this.container.contains( e.relatedTarget ) ) {
					this._hideOverlay( true );
				}
			};

			this._listen( this.container, 'mouseenter', this.boundMouseEnter );
			this._listen( this.container, 'mouseleave', this.boundMouseLeave );
			this._listen( this.container, 'touchstart', this.boundTouchStart, { passive: true } );

			// Keyboard accessibility - show on focus within
			this._listen( this.container, 'focusin', this.boundMouseEnter );
			this._listen( this.container, 'focusout', this.boundFocusOut );
		}

		/**
		 * Show the overlay
		 * @private
		 */
		_showOverlay() {
			if ( this.overlay ) {
				this.overlay.classList.add( 'layers-viewer-overlay--visible' );
			}
		}

		/**
		 * Hide the overlay
		 * @private
		 * @param {boolean} [force=false] Focus is leaving the host
		 */
		_hideOverlay( force = false ) {
			if ( !force && this.container && this.container.contains( document.activeElement ) ) {
				return;
			}
			if ( this.overlay ) {
				this.overlay.classList.remove( 'layers-viewer-overlay--visible' );
			}
		}

		/**
		 * Handle touch start for mobile
		 * @private
		 * @param {TouchEvent} _e Touch event (unused but required for event handler signature)
		 */
		_handleTouchStart( _e ) {
			if ( this.destroyed ) {
				return;
			}
			// Show overlay on touch
			this._showOverlay();

			// Clear existing timeout
			if ( this.touchTimeout ) {
				clearTimeout( this.touchTimeout );
			}

			// Auto-hide after 3 seconds
			this.touchTimeout = setTimeout( () => {
				this._hideOverlay();
				this.touchTimeout = null;
			}, 3000 );
		}

		/**
		 * Handle edit button click
		 * @private
		 * @param {HTMLElement} [opener] Activating control
		 */
		_handleEditClick( opener ) {
			if ( this.destroyed ) {
				return;
			}
			if ( this.callbackMode ) {
				return this.canEdit ? this._dispatchCallback( this.onEdit, opener ) : undefined;
			}
			this.debugLog( 'Edit clicked for', this.filename, 'autoCreate:', this.autoCreate );

			// Check if modal editor is available and preferred
			const useModal = this._shouldUseModal();

			if ( useModal && typeof window !== 'undefined' && window.Layers &&
				window.Layers.Modal && window.Layers.Modal.LayersEditorModal ) {
				// Open in modal - build URL with autocreate flag included
				const modal = new window.Layers.Modal.LayersEditorModal();
				const editorUrl = this._buildEditUrl() + '&modal=1';
				modal.open( this.filename, this.setname, editorUrl ).then( ( result ) => {
					if ( result && result.saved ) {
						// Refresh viewers when modal closes after save
						if ( typeof mw !== 'undefined' && mw.layers && mw.layers.viewerManager ) {
							mw.layers.viewerManager.refreshAllViewers();
						}
					}
				} );
			} else {
				// Navigate to editor page
				const editUrl = this._buildEditUrl();
				window.location.href = editUrl;
			}
		}

		/**
		 * Check if modal editor should be used
		 * @private
		 * @return {boolean} True if modal should be used
		 */
		_shouldUseModal() {
			// Use modal if we're not already on the File: page
			// This prevents disrupting user context
			if ( typeof mw === 'undefined' || !mw.config ) {
				return false;
			}

			const canonNs = mw.config.get( 'wgCanonicalNamespace' ) || '';

			// Don't use modal on the File: page itself (user can use the tab)
			if ( canonNs === 'File' ) {
				return false;
			}

			// Check if modal module is available
			return !!( typeof window !== 'undefined' && window.Layers &&
				window.Layers.Modal && window.Layers.Modal.LayersEditorModal );
		}

		/**
		 * Build the editor URL
		 * @private
		 * @return {string} Editor URL
		 */
		_buildEditUrl() {
			// Full-page editing returns to the embedding page; File-page entry keeps its own fallback.
			const returnTitle = typeof mw !== 'undefined' && mw.config &&
				typeof mw.config.get === 'function' && mw.config.get( 'wgCanonicalNamespace' ) !== 'File' ?
				mw.config.get( 'wgPageName' ) : null;
			const hasReturnTitle = typeof returnTitle === 'string' && returnTitle.length > 0;
			if ( typeof mw === 'undefined' || !mw.util ) {
				// Fallback URL construction
				let url = '/wiki/File:' + encodeURIComponent( this.filename ) +
					'?action=editlayers&setname=' + encodeURIComponent( this.setname );
				if ( this.page > 1 ) {
					url += '&page=' + encodeURIComponent( this.page );
				}
				if ( this.autoCreate ) {
					url += '&autocreate=1';
				}
				if ( hasReturnTitle ) {
					url += '&returnto=' + encodeURIComponent( returnTitle );
				}
				return url;
			}

			const params = new URLSearchParams( {
				action: 'editlayers'
			} );
			if ( isSpecificSetName( this.setname ) ) {
				params.set( 'setname', this.setname );
			}
			if ( this.page > 1 ) {
				params.set( 'page', String( this.page ) );
			}
			// Include autocreate flag for non-existent sets
			if ( this.autoCreate ) {
				params.set( 'autocreate', '1' );
			}

			if ( hasReturnTitle ) {
				params.set( 'returnto', returnTitle );
			}

			// mw.util.getUrl may return URL with query string (e.g., index.php?title=...)
			// so we need to use & if ? already exists
			const baseUrl = mw.util.getUrl( 'File:' + this.filename );
			const separator = baseUrl.includes( '?' ) ? '&' : '?';
			return baseUrl + separator + params.toString();
		}

		/**
		 * Handle view/expand button click
		 * @private
		 * @param {HTMLElement} [opener] Activating control
		 */
		_handleViewClick( opener ) {
			if ( this.destroyed ) {
				return;
			}
			if ( this.callbackMode ) {
				return this._dispatchCallback( this.onView, opener );
			}
			this.debugLog( 'View clicked for', this.filename );

			// Use the singleton lightbox instance (avoids leaking DOM/listeners)
			if ( typeof window !== 'undefined' && window.Layers &&
				window.Layers.lightbox ) {
				window.Layers.lightbox.open( {
					filename: this.filename,
					setName: this.setname,
					page: this.page,
					imageUrl: this.imageElement.src
				} );
				return;
			}

			// Fallback: open image in new tab/File page
			if ( typeof mw !== 'undefined' && mw.util ) {
				const fileUrl = mw.util.getUrl( 'File:' + this.filename ) + '?layers=on';
				window.open( fileUrl, '_blank', 'noopener,noreferrer' );
			} else {
				// Basic fallback
				window.open( this.imageElement.src, '_blank', 'noopener,noreferrer' );
			}
		}

		/**
		 * @private
		 * @param {Function} callback Caller-owned route
		 * @param {HTMLElement} opener Activating control
		 * @return {Promise|undefined} Settled callback, without legacy fallback
		 */
		_dispatchCallback( callback, opener ) {
			if ( typeof callback !== 'function' ) {
				return;
			}
			try {
				return Promise.resolve( callback( opener ) ).catch( ( error ) => {
					this.debugLog( 'Overlay callback failed', error );
				} );
			} catch ( error ) {
				this.debugLog( 'Overlay callback failed', error );
			}
		}

		/**
		 * Clean up the overlay and event listeners
		 */
		destroy() {
			this.destroyed = true;
			if ( this.touchTimeout ) {
				clearTimeout( this.touchTimeout );
				this.touchTimeout = null;
			}

			for ( const { element, type, handler, options } of this.listeners ) {
				element.removeEventListener( type, handler, options );
			}
			this.listeners = [];

			if ( this.overlay && this.overlay.parentNode ) {
				this.overlay.parentNode.removeChild( this.overlay );
			}

			if ( this.container ) {
				if ( this.addedTabIndex && this.container.getAttribute( 'tabindex' ) === '0' ) {
					if ( this.originalTabIndex === null ) {
						this.container.removeAttribute( 'tabindex' );
					} else {
						this.container.setAttribute( 'tabindex', this.originalTabIndex );
					}
				}
				if ( hostOverlays.get( this.container ) === this ) {
					hostOverlays.delete( this.container );
				}
			}
			this._pdfClickTarget = null;
			this._boundPdfClick = null;

			this.overlay = null;
			this.boundMouseEnter = null;
			this.boundMouseLeave = null;
			this.boundTouchStart = null;
			this.boundFocusOut = null;
			this.container = null;
			this.imageElement = null;
			this.onEdit = null;
			this.onView = null;
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};
		window.Layers.Viewer.Overlay = ViewerOverlay;
	}

	// CommonJS export for Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ViewerOverlay;
	}

}() );
