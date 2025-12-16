/**
 * Layer List Renderer
 * Handles DOM creation and updates for layer items in the layer panel
 *
 * Extracted from LayerPanel.js for better separation of concerns
 */
( function () {
	'use strict';

	// Import dependencies (available from Layers namespace or legacy global)
	const IconFactory = ( window.Layers && window.Layers.UI && window.Layers.UI.IconFactory ) ||
		window.IconFactory;

	/**
	 * LayerListRenderer class
	 * Manages rendering of layer items in the layer panel
	 */
	class LayerListRenderer {
		/**
		 * Create a LayerListRenderer instance
		 *
		 * @param {Object} config Configuration object
		 * @param {HTMLElement} config.layerList The layer list container element
		 * @param {Function} config.msg Message getter function for i18n
		 * @param {Function} config.getSelectedLayerId Function to get currently selected layer ID
		 * @param {Function} config.getLayers Function to get current layers array
		 * @param {Function} [config.onMoveLayer] Callback for keyboard layer reordering
		 */
		constructor( config ) {
			this.layerList = config.layerList;
			this.msg = config.msg || ( ( key, fallback ) => fallback || key );
			this.getSelectedLayerId = config.getSelectedLayerId || ( () => null );
			this.getLayers = config.getLayers || ( () => [] );
			this.onMoveLayer = config.onMoveLayer || null;
		}

		/**
		 * Render the layer list
		 */
		render() {
			const layers = this.getLayers();
			const listContainer = this.layerList;

			if ( !listContainer ) {
				return;
			}

			// Map existing DOM items by ID
			const existingItems = {};
			const domItems = listContainer.querySelectorAll( '.layer-item' );
			for ( let i = 0; i < domItems.length; i++ ) {
				existingItems[ domItems[ i ].dataset.layerId ] = domItems[ i ];
			}

			if ( layers.length === 0 ) {
				// Handle empty state
				while ( listContainer.firstChild ) {
					listContainer.removeChild( listContainer.firstChild );
				}
				const empty = document.createElement( 'div' );
				empty.className = 'layers-empty';
				empty.textContent = this.msg( 'layers-empty', 'No layers yet. Choose a tool to begin.' );
				listContainer.appendChild( empty );
				return;
			}

			// Remove empty message if present
			const emptyMsg = listContainer.querySelector( '.layers-empty' );
			if ( emptyMsg ) {
				listContainer.removeChild( emptyMsg );
			}

			// First pass: Remove items that are no longer in the layer list
			const newLayerIds = layers.map( ( l ) => String( l.id ) );
			for ( const id in existingItems ) {
				if ( newLayerIds.indexOf( id ) === -1 ) {
					listContainer.removeChild( existingItems[ id ] );
				}
			}

			// Second pass: Create or update items and ensure order
			let previousSibling = null;
			layers.forEach( ( layer, index ) => {
				const layerId = String( layer.id );
				let item = existingItems[ layerId ];

				if ( !item ) {
					// Create new
					item = this.createLayerItem( layer, index );
					existingItems[ layerId ] = item; // Add to map
				} else {
					// Update existing
					this.updateLayerItem( item, layer, index );
				}

				// Ensure position
				if ( index === 0 ) {
					if ( listContainer.firstChild !== item ) {
						listContainer.insertBefore( item, listContainer.firstChild );
					}
				} else {
					if ( previousSibling.nextSibling !== item ) {
						listContainer.insertBefore( item, previousSibling.nextSibling );
					}
				}
				previousSibling = item;
			} );
		}

		/**
		 * Create a layer item DOM element
		 *
		 * @param {Object} layer Layer object
		 * @param {number} index Layer index
		 * @return {HTMLElement} Layer item element
		 */
		createLayerItem( layer, index ) {
			const t = this.msg;
			const item = document.createElement( 'div' );
			item.className = 'layer-item';
			item.dataset.layerId = layer.id;
			item.dataset.index = index;
			item.draggable = true;

			// ARIA attributes for listbox option
			item.setAttribute( 'role', 'option' );
			item.setAttribute( 'aria-selected', layer.id === this.getSelectedLayerId() ? 'true' : 'false' );
			const layerName = layer.name || this.getDefaultLayerName( layer );
			item.setAttribute( 'aria-label', layerName );

			if ( layer.id === this.getSelectedLayerId() ) {
				item.classList.add( 'selected' );
			}

			// Grab area - also serves as the focusable element for keyboard navigation
			const grabArea = this._createGrabArea( layer, layerName, t );

			// Visibility toggle
			const visibilityBtn = this._createVisibilityButton( layer, t );

			// Name (editable)
			const name = document.createElement( 'span' );
			name.className = 'layer-name';
			name.textContent = layerName;
			name.contentEditable = true;
			name.setAttribute( 'role', 'textbox' );
			name.setAttribute( 'aria-label', t( 'layers-layer-name', 'Layer Name' ) );

			// Lock toggle
			const lockBtn = this._createLockButton( layer, t );

			// Delete button
			const deleteBtn = this._createDeleteButton( t );

			item.appendChild( grabArea );
			item.appendChild( visibilityBtn );
			item.appendChild( name );
			item.appendChild( lockBtn );
			item.appendChild( deleteBtn );

			return item;
		}

		/**
		 * Create grab area element
		 *
		 * @param {Object} layer Layer object
		 * @param {string} layerName Layer display name
		 * @param {Function} t Message getter
		 * @return {HTMLElement} Grab area element
		 * @private
		 */
		_createGrabArea( layer, layerName, t ) {
			const grabArea = document.createElement( 'div' );
			grabArea.className = 'layer-grab-area';
			grabArea.title = t( 'layers-grab-area', 'Drag to move/select' ) + ' (' + t( 'layers-keyboard-nav-hint', 'Use arrow keys to navigate, Enter to select' ) + ')';
			grabArea.setAttribute( 'tabindex', '0' );
			grabArea.setAttribute( 'role', 'button' );
			grabArea.setAttribute( 'aria-label', layerName + ' - ' + t( 'layers-grab-area', 'Drag to move/select' ) );
			grabArea.style.width = '36px';
			grabArea.style.height = '36px';
			grabArea.style.display = 'flex';
			grabArea.style.alignItems = 'center';
			grabArea.style.justifyContent = 'center';
			grabArea.style.cursor = 'grab';

			// Keyboard reordering
			if ( this.onMoveLayer ) {
				grabArea.addEventListener( 'keydown', ( e ) => {
					if ( e.key === 'ArrowUp' || e.key === 'ArrowDown' ) {
						e.preventDefault();
						const direction = e.key === 'ArrowUp' ? -1 : 1;
						this.onMoveLayer( layer.id, direction );
					}
				} );
			}

			// Build grab icon via DOM to avoid innerHTML
			const grabSvg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			grabSvg.setAttribute( 'width', '24' );
			grabSvg.setAttribute( 'height', '24' );
			grabSvg.setAttribute( 'viewBox', '0 0 24 24' );
			grabSvg.setAttribute( 'aria-hidden', 'true' );

			const mkCircle = ( cx, cy ) => {
				const c = document.createElementNS( 'http://www.w3.org/2000/svg', 'circle' );
				c.setAttribute( 'cx', String( cx ) );
				c.setAttribute( 'cy', String( cy ) );
				c.setAttribute( 'r', '2.5' );
				c.setAttribute( 'fill', '#bbb' );
				return c;
			};

			grabSvg.appendChild( mkCircle( 7, 7 ) );
			grabSvg.appendChild( mkCircle( 17, 7 ) );
			grabSvg.appendChild( mkCircle( 7, 17 ) );
			grabSvg.appendChild( mkCircle( 17, 17 ) );
			grabArea.appendChild( grabSvg );

			return grabArea;
		}

		/**
		 * Create visibility toggle button
		 *
		 * @param {Object} layer Layer object
		 * @param {Function} t Message getter
		 * @return {HTMLElement} Visibility button element
		 * @private
		 */
		_createVisibilityButton( layer, t ) {
			const visibilityBtn = document.createElement( 'button' );
			visibilityBtn.className = 'layer-visibility';
			visibilityBtn.appendChild( this._createEyeIcon( layer.visible !== false ) );
			visibilityBtn.title = t( 'layers-toggle-visibility', 'Toggle visibility' );
			visibilityBtn.type = 'button';
			visibilityBtn.setAttribute( 'aria-label', t( 'layers-toggle-visibility', 'Toggle visibility' ) );
			visibilityBtn.style.width = '36px';
			visibilityBtn.style.height = '36px';
			return visibilityBtn;
		}

		/**
		 * Create lock toggle button
		 *
		 * @param {Object} layer Layer object
		 * @param {Function} t Message getter
		 * @return {HTMLElement} Lock button element
		 * @private
		 */
		_createLockButton( layer, t ) {
			const lockBtn = document.createElement( 'button' );
			lockBtn.className = 'layer-lock';
			lockBtn.appendChild( this._createLockIcon( !!layer.locked ) );
			lockBtn.title = t( 'layers-toggle-lock', 'Toggle lock' );
			lockBtn.type = 'button';
			lockBtn.setAttribute( 'aria-label', t( 'layers-toggle-lock', 'Toggle lock' ) );
			lockBtn.style.width = '36px';
			lockBtn.style.height = '36px';
			return lockBtn;
		}

		/**
		 * Create delete button
		 *
		 * @param {Function} t Message getter
		 * @return {HTMLElement} Delete button element
		 * @private
		 */
		_createDeleteButton( t ) {
			const deleteBtn = document.createElement( 'button' );
			deleteBtn.className = 'layer-delete';
			deleteBtn.appendChild( this._createDeleteIcon() );
			deleteBtn.title = t( 'layers-delete-layer-button', 'Delete layer' );
			deleteBtn.type = 'button';
			deleteBtn.setAttribute( 'aria-label', t( 'layers-delete-layer-button', 'Delete layer' ) );
			deleteBtn.style.width = '36px';
			deleteBtn.style.height = '36px';
			return deleteBtn;
		}

		/**
		 * Update an existing layer item DOM element
		 *
		 * @param {HTMLElement} item Layer item element
		 * @param {Object} layer Layer object
		 * @param {number} index Layer index
		 */
		updateLayerItem( item, layer, index ) {
			const t = this.msg;

			// Update attributes
			item.dataset.layerId = layer.id;
			item.dataset.index = index;

			// Update ARIA attributes
			const isSelected = layer.id === this.getSelectedLayerId();
			item.setAttribute( 'aria-selected', isSelected ? 'true' : 'false' );
			const layerName = layer.name || this.getDefaultLayerName( layer );
			item.setAttribute( 'aria-label', layerName );

			// Update selection state
			if ( isSelected ) {
				item.classList.add( 'selected' );
			} else {
				item.classList.remove( 'selected' );
			}

			// Update grab area aria-label
			const grabArea = item.querySelector( '.layer-grab-area' );
			if ( grabArea ) {
				grabArea.setAttribute( 'aria-label', layerName + ' - ' + t( 'layers-grab-area', 'Drag to move/select' ) );
			}

			// Update visibility icon
			const visibilityBtn = item.querySelector( '.layer-visibility' );
			if ( visibilityBtn ) {
				// Clear existing icon
				while ( visibilityBtn.firstChild ) {
					visibilityBtn.removeChild( visibilityBtn.firstChild );
				}
				visibilityBtn.appendChild( this._createEyeIcon( layer.visible !== false ) );
			}

			// Update name (only if not currently being edited)
			const nameEl = item.querySelector( '.layer-name' );
			if ( nameEl && document.activeElement !== nameEl ) {
				const newName = layer.name || this.getDefaultLayerName( layer );
				if ( nameEl.textContent !== newName ) {
					nameEl.textContent = newName;
				}
			}

			// Update lock icon
			const lockBtn = item.querySelector( '.layer-lock' );
			if ( lockBtn ) {
				// Clear existing icon
				while ( lockBtn.firstChild ) {
					lockBtn.removeChild( lockBtn.firstChild );
				}
				lockBtn.appendChild( this._createLockIcon( !!layer.locked ) );
			}
		}

		/**
		 * Get the default name for a layer based on its type
		 *
		 * @param {Object} layer Layer object
		 * @return {string} Default layer name
		 */
		getDefaultLayerName( layer ) {
			const t = this.msg;
			const LayersConstants = ( window.Layers && window.Layers.Constants ) || {};
			const LAYER_TYPES = LayersConstants.LAYER_TYPES || {};

			switch ( layer.type ) {
				case ( LAYER_TYPES.TEXT || 'text' ): {
					const prefix = t( 'layers-default-text-prefix', 'Text: ' );
					const emptyText = t( 'layers-default-empty', 'Empty' );
					return prefix + ( ( layer.text || emptyText ).slice( 0, 20 ) );
				}
				case ( LAYER_TYPES.RECTANGLE || 'rectangle' ):
					return t( 'layers-type-rectangle', 'Rectangle' );
				case ( LAYER_TYPES.BLUR || 'blur' ):
					return t( 'layers-type-blur', 'Blur/Redaction' );
				case ( LAYER_TYPES.CIRCLE || 'circle' ):
					return t( 'layers-type-circle', 'Circle' );
				case ( LAYER_TYPES.ELLIPSE || 'ellipse' ):
					return t( 'layers-type-ellipse', 'Ellipse' );
				case ( LAYER_TYPES.POLYGON || 'polygon' ):
					return t( 'layers-type-polygon', 'Polygon' );
				case ( LAYER_TYPES.STAR || 'star' ):
					return t( 'layers-type-star', 'Star' );
				case ( LAYER_TYPES.ARROW || 'arrow' ):
					return t( 'layers-type-arrow', 'Arrow' );
				case ( LAYER_TYPES.LINE || 'line' ):
					return t( 'layers-type-line', 'Line' );
				case ( LAYER_TYPES.PATH || 'path' ):
					return t( 'layers-type-path', 'Drawing' );
				default:
					return t( 'layers-type-layer', 'Layer' );
			}
		}

		/**
		 * Create eye icon for visibility toggle
		 *
		 * @param {boolean} visible Whether the layer is visible
		 * @return {Element} Eye icon element
		 * @private
		 */
		_createEyeIcon( visible ) {
			return IconFactory ? IconFactory.createEyeIcon( visible ) : document.createElement( 'span' );
		}

		/**
		 * Create lock icon for lock toggle
		 *
		 * @param {boolean} locked Whether the layer is locked
		 * @return {Element} Lock icon element
		 * @private
		 */
		_createLockIcon( locked ) {
			return IconFactory ? IconFactory.createLockIcon( locked ) : document.createElement( 'span' );
		}

		/**
		 * Create delete icon
		 *
		 * @return {Element} Delete icon element
		 * @private
		 */
		_createDeleteIcon() {
			return IconFactory ? IconFactory.createDeleteIcon() : document.createElement( 'span' );
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.LayerListRenderer = LayerListRenderer;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { LayerListRenderer };
	}
}() );
