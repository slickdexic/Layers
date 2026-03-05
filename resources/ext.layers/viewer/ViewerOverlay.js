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
	 * SVG namespace for creating icons inline (fallback when IconFactory not available)
	 * @constant {string}
	 */
	const SVG_NS = 'http://www.w3.org/2000/svg';

	/**
	 * ViewerOverlay class - manages hover overlay for layered images
	 */
	class ViewerOverlay {
		/**
		 * Create a ViewerOverlay instance
		 * @param {Object} config Configuration options
		 * @param {HTMLElement} config.container The container element (positioned wrapper around image)
		 * @param {HTMLImageElement} config.imageElement The image element
		 * @param {string} config.filename The file name (for edit URL)
		 * @param {string} [config.setname='default'] The layer set name
		 * @param {boolean} [config.canEdit=false] Whether user has edit permission
		 * @param {boolean} [config.debug=false] Enable debug logging
		 */
		constructor( config ) {
			this.container = config.container;
			this.imageElement = config.imageElement;
			// Sanitize filename - strip any wikitext brackets that might have leaked through
			this.filename = ( config.filename || '' ).replace( /[\x5B\x5D]/g, '' );
			this.setname = config.setname || 'default';
			this.canEdit = config.canEdit !== false && this._checkEditPermission();
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
			if ( !this.container || !this.imageElement ) {
				this.debugLog( 'Missing container or image element' );
				return;
			}

			// Don't add overlay if no filename
			if ( !this.filename ) {
				this.debugLog( 'No filename provided, skipping overlay' );
				return;
			}

			this.createOverlay();
			this.attachEventListeners();

			this.debugLog( 'Overlay initialized for', this.filename, 'canEdit:', this.canEdit );
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
					() => this._handleEditClick()
				);
				editBtn.appendChild( this._createPencilIcon() );
				this.overlay.appendChild( editBtn );
			}

			// Add view/expand button (always visible)
			const viewBtn = this._createButton(
				'view',
				this._msg( 'layers-viewer-view', 'View full size' ),
				() => this._handleViewClick()
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
			btn.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				e.stopPropagation();
				onClick();
			} );
			// Prevent overlay from hiding when hovering over buttons
			btn.addEventListener( 'mouseenter', ( e ) => {
				e.stopPropagation();
			} );
			return btn;
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
				if ( !this.container.contains( e.relatedTarget ) ) {
					this._hideOverlay();
				}
			};

			this.container.addEventListener( 'mouseenter', this.boundMouseEnter );
			this.container.addEventListener( 'mouseleave', this.boundMouseLeave );
			this.container.addEventListener( 'touchstart', this.boundTouchStart, { passive: true } );

			// Keyboard accessibility - show on focus within
			this.container.addEventListener( 'focusin', this.boundMouseEnter );
			this.container.addEventListener( 'focusout', this.boundFocusOut );
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
		 */
		_hideOverlay() {
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
		 */
		_handleEditClick() {
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
			if ( typeof mw === 'undefined' || !mw.util ) {
				// Fallback URL construction
				let url = '/wiki/File:' + encodeURIComponent( this.filename ) +
					'?action=editlayers&setname=' + encodeURIComponent( this.setname );
				if ( this.autoCreate ) {
					url += '&autocreate=1';
				}
				return url;
			}

			const params = new URLSearchParams( {
				action: 'editlayers'
			} );
			if ( this.setname && this.setname !== 'default' ) {
				params.set( 'setname', this.setname );
			}
			// Include autocreate flag for non-existent sets
			if ( this.autoCreate ) {
				params.set( 'autocreate', '1' );
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
		 */
		_handleViewClick() {
			this.debugLog( 'View clicked for', this.filename );

			// Use the singleton lightbox instance (avoids leaking DOM/listeners)
			if ( typeof window !== 'undefined' && window.Layers &&
				window.Layers.lightbox ) {
				window.Layers.lightbox.open( {
					filename: this.filename,
					setName: this.setname,
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
		 * Clean up the overlay and event listeners
		 */
		destroy() {
			if ( this.touchTimeout ) {
				clearTimeout( this.touchTimeout );
				this.touchTimeout = null;
			}

			if ( this.container && this.boundMouseEnter ) {
				this.container.removeEventListener( 'mouseenter', this.boundMouseEnter );
				this.container.removeEventListener( 'mouseleave', this.boundMouseLeave );
				this.container.removeEventListener( 'touchstart', this.boundTouchStart );
				this.container.removeEventListener( 'focusin', this.boundMouseEnter );
				this.container.removeEventListener( 'focusout', this.boundFocusOut );
			}

			if ( this.overlay && this.overlay.parentNode ) {
				this.overlay.parentNode.removeChild( this.overlay );
			}

			this.overlay = null;
			this.boundMouseEnter = null;
			this.boundMouseLeave = null;
			this.boundTouchStart = null;
			this.boundFocusOut = null;
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
