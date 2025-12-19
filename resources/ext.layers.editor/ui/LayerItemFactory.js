/**
 * LayerItemFactory - Creates and updates layer list item DOM elements
 * Extracted from LayerPanel.js for single responsibility
 */
( function () {
	'use strict';

	/**
	 * Helper to get a class from namespace or global fallback
	 *
	 * @param {string} namespacePath - Path under window.Layers
	 * @param {string} globalName - Global fallback name
	 * @return {Function|Object|null} The class/object or null if not found
	 */
	function getClass( namespacePath, globalName ) {
		const parts = namespacePath.split( '.' );
		let obj = window.Layers;
		for ( const part of parts ) {
			obj = obj && obj[ part ];
		}
		return obj || window[ globalName ] || null;
	}

	/**
	 * Factory for creating layer list item DOM elements
	 */
	class LayerItemFactory {
		/**
		 * Create a LayerItemFactory instance
		 *
		 * @param {Object} config Configuration object
		 * @param {Function} config.msg Message function for i18n
		 * @param {Function} config.getSelectedLayerId Function to get selected layer ID
		 * @param {Function} config.getSelectedLayerIds Function to get all selected layer IDs
		 * @param {Function} config.addTargetListener Function to add event listeners with cleanup
		 * @param {Function} config.onMoveLayer Callback when layer should be moved
		 */
		constructor( config ) {
			this.config = config || {};
			this.msg = config.msg || ( ( key, fallback ) => fallback );
			this.getSelectedLayerId = config.getSelectedLayerId || ( () => null );
			this.getSelectedLayerIds = config.getSelectedLayerIds || ( () => [] );
			this.addTargetListener = config.addTargetListener || ( () => {} );
			this.onMoveLayer = config.onMoveLayer || ( () => {} );
		}

		/**
		 * Create eye icon for visibility toggle
		 *
		 * @param {boolean} visible Whether the layer is visible
		 * @return {Element} Eye icon element
		 */
		createEyeIcon( visible ) {
			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
			return IconFactory ? IconFactory.createEyeIcon( visible ) : document.createElement( 'span' );
		}

		/**
		 * Create lock icon for lock toggle
		 *
		 * @param {boolean} locked Whether the layer is locked
		 * @return {Element} Lock icon element
		 */
		createLockIcon( locked ) {
			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
			return IconFactory ? IconFactory.createLockIcon( locked ) : document.createElement( 'span' );
		}

		/**
		 * Create delete icon
		 *
		 * @return {Element} Delete icon element
		 */
		createDeleteIcon() {
			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
			return IconFactory ? IconFactory.createDeleteIcon() : document.createElement( 'span' );
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
		 * Create a layer list item DOM element
		 *
		 * @param {Object} layer Layer object
		 * @param {number} index Layer index in the list
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
			const selectedIds = this.getSelectedLayerIds();
			const isSelected = selectedIds.includes( layer.id );
			item.setAttribute( 'aria-selected', isSelected ? 'true' : 'false' );
			const layerName = layer.name || this.getDefaultLayerName( layer );
			item.setAttribute( 'aria-label', layerName );

			if ( isSelected ) {
				item.classList.add( 'selected' );
			}

			// Grab area - serves as the focusable element for keyboard navigation
			const grabArea = document.createElement( 'div' );
			grabArea.className = 'layer-grab-area';
			grabArea.title = t( 'layers-grab-area', 'Drag to move/select' ) + ' (' +
				t( 'layers-keyboard-nav-hint', 'Use arrow keys to navigate, Enter to select' ) + ')';
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
			this.addTargetListener( grabArea, 'keydown', ( e ) => {
				if ( e.key === 'ArrowUp' || e.key === 'ArrowDown' ) {
					e.preventDefault();
					const direction = e.key === 'ArrowUp' ? -1 : 1;
					this.onMoveLayer( layer.id, direction );
				}
			} );

			// Build grab icon via DOM
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

			// Visibility toggle
			const visibilityBtn = document.createElement( 'button' );
			visibilityBtn.className = 'layer-visibility';
			visibilityBtn.appendChild( this.createEyeIcon( layer.visible !== false ) );
			visibilityBtn.title = t( 'layers-toggle-visibility', 'Toggle visibility' );
			visibilityBtn.type = 'button';
			visibilityBtn.setAttribute( 'aria-label', t( 'layers-toggle-visibility', 'Toggle visibility' ) );

			// Name (editable)
			const name = document.createElement( 'span' );
			name.className = 'layer-name';
			name.textContent = layer.name || this.getDefaultLayerName( layer );
			name.contentEditable = true;
			name.setAttribute( 'role', 'textbox' );
			name.setAttribute( 'aria-label', t( 'layers-layer-name', 'Layer Name' ) );

			// Lock toggle
			const lockBtn = document.createElement( 'button' );
			lockBtn.className = 'layer-lock';
			lockBtn.appendChild( this.createLockIcon( !!layer.locked ) );
			lockBtn.title = t( 'layers-toggle-lock', 'Toggle lock' );
			lockBtn.type = 'button';
			lockBtn.setAttribute( 'aria-label', t( 'layers-toggle-lock', 'Toggle lock' ) );

			// Delete button
			const deleteBtn = document.createElement( 'button' );
			deleteBtn.className = 'layer-delete';
			deleteBtn.appendChild( this.createDeleteIcon() );
			deleteBtn.title = t( 'layers-delete-layer-button', 'Delete layer' );
			deleteBtn.type = 'button';
			deleteBtn.setAttribute( 'aria-label', t( 'layers-delete-layer-button', 'Delete layer' ) );

			item.appendChild( grabArea );
			item.appendChild( visibilityBtn );
			item.appendChild( name );
			item.appendChild( lockBtn );
			item.appendChild( deleteBtn );
			return item;
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
			const selectedIds = this.getSelectedLayerIds();
			const isSelected = selectedIds.includes( layer.id );
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
				while ( visibilityBtn.firstChild ) {
					visibilityBtn.removeChild( visibilityBtn.firstChild );
				}
				visibilityBtn.appendChild( this.createEyeIcon( layer.visible !== false ) );
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
				while ( lockBtn.firstChild ) {
					lockBtn.removeChild( lockBtn.firstChild );
				}
				lockBtn.appendChild( this.createLockIcon( !!layer.locked ) );
			}
		}
	}

	// Register in namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.LayerItemFactory = LayerItemFactory;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = LayerItemFactory;
	}
}() );
