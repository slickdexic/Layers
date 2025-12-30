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
	 * Indentation in pixels per nesting level for child layers
	 * @constant {number}
	 */
	const INDENT_PER_LEVEL = 20;

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
		 * @param {Function} [config.onToggleGroupExpand] Callback when group expand/collapse is toggled
		 * @param {Function} [config.getLayerDepth] Function to get nesting depth of a layer
		 */
		constructor( config ) {
			this.config = config || {};
			this.msg = config.msg || ( ( key, fallback ) => fallback );
			this.getSelectedLayerId = config.getSelectedLayerId || ( () => null );
			this.getSelectedLayerIds = config.getSelectedLayerIds || ( () => [] );
			this.addTargetListener = config.addTargetListener || ( () => {} );
			this.onMoveLayer = config.onMoveLayer || ( () => {} );
			this.onToggleGroupExpand = config.onToggleGroupExpand || ( () => {} );
			this.getLayerDepth = config.getLayerDepth || ( () => 0 );
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
		 * Create folder icon fallback when IconFactory is not available
		 *
		 * @param {boolean} expanded Whether the folder is expanded
		 * @return {SVGElement} Folder icon SVG element
		 */
		createFolderIconFallback( expanded ) {
			const SVG_NS = 'http://www.w3.org/2000/svg';
			const size = 18;
			const color = '#f39c12';

			const svg = document.createElementNS( SVG_NS, 'svg' );
			svg.setAttribute( 'width', String( size ) );
			svg.setAttribute( 'height', String( size ) );
			svg.setAttribute( 'viewBox', '0 0 24 24' );
			svg.setAttribute( 'aria-hidden', 'true' );

			// Folder path - same for both open and closed
			const path = document.createElementNS( SVG_NS, 'path' );
			path.setAttribute( 'd', 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z' );
			path.setAttribute( 'fill', color );
			path.setAttribute( 'stroke', color );
			path.setAttribute( 'stroke-width', '1.5' );
			path.setAttribute( 'stroke-linecap', 'round' );
			path.setAttribute( 'stroke-linejoin', 'round' );
			svg.appendChild( path );

			if ( expanded ) {
				// Add open folder flap indicator
				const flap = document.createElementNS( SVG_NS, 'path' );
				flap.setAttribute( 'd', 'M2 10l2.5-2h17l-2.5 2' );
				flap.setAttribute( 'fill', 'none' );
				flap.setAttribute( 'stroke', '#fff' );
				flap.setAttribute( 'stroke-width', '1' );
				flap.setAttribute( 'stroke-linecap', 'round' );
				flap.setAttribute( 'stroke-linejoin', 'round' );
				flap.setAttribute( 'opacity', '0.5' );
				svg.appendChild( flap );
			}

			return svg;
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
				case ( LAYER_TYPES.GROUP || 'group' ):
					return t( 'layers-type-folder', 'Folder' );
				case ( LAYER_TYPES.TEXT || 'text' ): {
					const prefix = t( 'layers-default-text-prefix', 'Text: ' );
					const emptyText = t( 'layers-default-empty', 'Empty' );
					return prefix + ( ( layer.text || emptyText ).slice( 0, 20 ) );
				}
				case ( LAYER_TYPES.RECTANGLE || 'rectangle' ):
					return t( 'layers-type-rectangle', 'Rectangle' );
				case ( LAYER_TYPES.BLUR || 'blur' ):
						return t( 'layers-type-blur', 'Blur Effect' );
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
			const isGroup = layer.type === 'group';
			const isExpanded = isGroup && layer.expanded !== false;
			const isEmpty = isGroup && ( !layer.children || layer.children.length === 0 );
			const depth = this.getLayerDepth( layer.id );

			const item = document.createElement( 'div' );
			item.className = 'layer-item' + ( isGroup ? ' layer-item-group' : '' );
			if ( isEmpty ) {
				item.classList.add( 'folder-empty' );
			}
			item.dataset.layerId = layer.id;
			item.dataset.index = index;
			item.dataset.depth = depth;
			item.draggable = true;

			// Apply indentation based on nesting depth
			if ( depth > 0 ) {
				item.style.paddingLeft = ( depth * INDENT_PER_LEVEL ) + 'px';
				item.classList.add( 'layer-item-child' );
			}

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

			// Expand/collapse toggle for groups (before grab area)
			if ( isGroup ) {
				const expandToggle = this.createExpandToggle( layer, isExpanded );
				item.appendChild( expandToggle );
			}

			// Grab area - serves as the focusable element for keyboard navigation
			const grabArea = document.createElement( 'div' );
			grabArea.className = 'layer-grab-area';
			const grabTitle = isGroup ?
				t( 'layers-folder-grab', 'Drag to reorder folder' ) :
				t( 'layers-grab-area', 'Drag to move/select' );
			grabArea.title = grabTitle + ' (' +
				t( 'layers-keyboard-nav-hint', 'Use arrow keys to navigate, Enter to select' ) + ')';
			grabArea.setAttribute( 'tabindex', '0' );
			grabArea.setAttribute( 'role', 'button' );
			grabArea.setAttribute( 'aria-label', layerName + ' - ' + grabTitle );
			// Size is controlled by CSS - no inline styles needed

			// Keyboard reordering
			this.addTargetListener( grabArea, 'keydown', ( e ) => {
				if ( e.key === 'ArrowUp' || e.key === 'ArrowDown' ) {
					e.preventDefault();
					const direction = e.key === 'ArrowUp' ? -1 : 1;
					this.onMoveLayer( layer.id, direction );
				}
			} );

			// Use folder icon for groups, grab dots for regular layers
			if ( isGroup ) {
				const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
				if ( IconFactory && IconFactory.createFolderIcon ) {
					const folderIcon = IconFactory.createFolderIcon( isExpanded );
					grabArea.appendChild( folderIcon );
				} else {
					// Fallback: create inline folder icon if IconFactory not available
					const folderIcon = this.createFolderIconFallback( isExpanded );
					grabArea.appendChild( folderIcon );
				}
			} else {
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
			}

			// Visibility toggle
			const visibilityBtn = document.createElement( 'button' );
			visibilityBtn.className = 'layer-visibility';
			visibilityBtn.appendChild( this.createEyeIcon( layer.visible !== false ) );
			visibilityBtn.title = t( 'layers-toggle-visibility', 'Toggle visibility' );
			visibilityBtn.type = 'button';
			visibilityBtn.setAttribute( 'aria-label', t( 'layers-toggle-visibility', 'Toggle visibility' ) );

			// Name - NOT editable by default (only becomes editable on double-click when layer is selected)
			const name = document.createElement( 'span' );
			name.className = 'layer-name';
			name.textContent = layer.name || this.getDefaultLayerName( layer );
			name.contentEditable = 'false';
			name.style.cursor = 'pointer';
			name.setAttribute( 'role', 'button' );
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
		 * Create expand/collapse toggle button for group layers
		 *
		 * @param {Object} layer Group layer object
		 * @param {boolean} isExpanded Whether the group is expanded
		 * @return {HTMLElement} Toggle button element
		 */
		createExpandToggle( layer, isExpanded ) {
			const t = this.msg;
			const toggle = document.createElement( 'button' );
			toggle.className = 'layer-expand-toggle';
			toggle.type = 'button';
			toggle.title = isExpanded ?
				t( 'layers-collapse-group', 'Collapse group' ) :
				t( 'layers-expand-group', 'Expand group' );
			toggle.setAttribute( 'aria-label', toggle.title );
			toggle.setAttribute( 'aria-expanded', isExpanded ? 'true' : 'false' );

			// Add expand icon
			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
			if ( IconFactory && IconFactory.createExpandIcon ) {
				toggle.appendChild( IconFactory.createExpandIcon( isExpanded ) );
			} else {
				// Fallback: simple text arrow
				toggle.textContent = isExpanded ? '▼' : '▶';
			}

			// Click handler
			this.addTargetListener( toggle, 'click', ( e ) => {
				e.stopPropagation();
				this.onToggleGroupExpand( layer.id );
			} );

			return toggle;
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
			const isGroup = layer.type === 'group';
			const isExpanded = isGroup && layer.expanded !== false;
			const depth = this.getLayerDepth( layer.id );

			// Update attributes
			item.dataset.layerId = layer.id;
			item.dataset.index = index;
			item.dataset.depth = depth;

			// Update group-specific classes
			if ( isGroup ) {
				item.classList.add( 'layer-item-group' );
			} else {
				item.classList.remove( 'layer-item-group' );
			}

			// Update child indentation
			if ( depth > 0 ) {
				item.style.paddingLeft = ( depth * INDENT_PER_LEVEL ) + 'px';
				item.classList.add( 'layer-item-child' );
			} else {
				item.style.paddingLeft = '';
				item.classList.remove( 'layer-item-child' );
			}

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

			// Update expand toggle for groups
			const existingToggle = item.querySelector( '.layer-expand-toggle' );
			if ( isGroup ) {
				if ( existingToggle ) {
					// Update existing toggle
					existingToggle.title = isExpanded ?
						t( 'layers-collapse-group', 'Collapse group' ) :
						t( 'layers-expand-group', 'Expand group' );
					existingToggle.setAttribute( 'aria-label', existingToggle.title );
					existingToggle.setAttribute( 'aria-expanded', isExpanded ? 'true' : 'false' );

					// Update icon
					while ( existingToggle.firstChild ) {
						existingToggle.removeChild( existingToggle.firstChild );
					}
					const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
					if ( IconFactory && IconFactory.createExpandIcon ) {
						existingToggle.appendChild( IconFactory.createExpandIcon( isExpanded ) );
					} else {
						existingToggle.textContent = isExpanded ? '▼' : '▶';
					}
				} else {
					// Create new toggle and insert at beginning
					const toggle = this.createExpandToggle( layer, isExpanded );
					item.insertBefore( toggle, item.firstChild );
				}
			} else if ( existingToggle ) {
				// Remove toggle from non-group layers
				existingToggle.parentNode.removeChild( existingToggle );
			}

			// Update grab area icon for groups
			const grabArea = item.querySelector( '.layer-grab-area' );
			if ( grabArea ) {
				grabArea.setAttribute( 'aria-label', layerName + ' - ' + t( 'layers-grab-area', 'Drag to move/select' ) );

				// Update icon based on layer type
				if ( isGroup ) {
					while ( grabArea.firstChild ) {
						grabArea.removeChild( grabArea.firstChild );
					}
					const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
					if ( IconFactory && IconFactory.createFolderIcon ) {
						grabArea.appendChild( IconFactory.createFolderIcon( isExpanded ) );
					}
				}
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
