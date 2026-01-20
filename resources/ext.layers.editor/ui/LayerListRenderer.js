/**
 * Layer List Renderer
 * Handles DOM creation and updates for layer items in the layer panel
 *
 * Extracted from LayerPanel.js for better separation of concerns
 * Supports virtual scrolling for large layer counts (30+) via VirtualLayerList
 */
( function () {
	'use strict';

	// Import dependencies (available from Layers namespace or legacy global)
	const IconFactory = ( window.Layers && window.Layers.UI && window.Layers.UI.IconFactory ) ||
		window.IconFactory;

	/**
	 * Get VirtualLayerList class from namespace
	 *
	 * @return {Function|null} VirtualLayerList class or null
	 */
	function getVirtualLayerList() {
		return ( window.Layers && window.Layers.UI && window.Layers.UI.VirtualLayerList ) || null;
	}

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
		 * @param {HTMLElement} [config.scrollContainer] Scrollable container for virtualization
		 */
		constructor( config ) {
			this.layerList = config.layerList;
			this.msg = config.msg || ( ( key, fallback ) => fallback || key );
			this.getSelectedLayerId = config.getSelectedLayerId || ( () => null );
			this.getSelectedLayerIds = config.getSelectedLayerIds || ( () => [] );
			this.getLayers = config.getLayers || ( () => [] );
			this.onMoveLayer = config.onMoveLayer || null;
			this.onToggleGroupExpand = config.onToggleGroupExpand || null;
			this.scrollContainer = config.scrollContainer || null;

			// Indentation per nesting level in pixels
			this.indentPerLevel = 20;

			// Virtual list for large layer counts
			this._virtualList = null;
			this._initVirtualList();
		}

		/**
		 * Initialize virtual list if available and container is provided
		 *
		 * @private
		 */
		_initVirtualList() {
			const VirtualLayerList = getVirtualLayerList();
			const container = this.scrollContainer || this._findScrollContainer();

			if ( VirtualLayerList && container && this.layerList ) {
				this._virtualList = new VirtualLayerList( {
					container: container,
					listElement: this.layerList,
					getLayers: this.getLayers,
					createItem: this.createLayerItem.bind( this ),
					updateItem: this.updateLayerItem.bind( this ),
					itemHeight: 44,
					overscan: 5,
					threshold: 30
				} );
			}
		}

		/**
		 * Find the scroll container (parent with overflow)
		 *
		 * @return {HTMLElement|null} Scroll container or null
		 * @private
		 */
		_findScrollContainer() {
			let el = this.layerList;
			while ( el && el.parentElement ) {
				el = el.parentElement;
				const style = window.getComputedStyle( el );
				if ( style.overflowY === 'auto' || style.overflowY === 'scroll' ) {
					return el;
				}
			}
			return null;
		}

		/**
		 * Get the nesting depth of a layer (0 = top level)
		 *
		 * @param {string} layerId Layer ID
		 * @return {number} Nesting depth
		 */
		getLayerDepth( layerId ) {
			const layers = this.getLayers();
			let depth = 0;
			let currentId = layerId;
			let iterations = 0;
			const maxIterations = 10; // Prevent infinite loops

			while ( iterations < maxIterations ) {
				const layer = layers.find( ( l ) => l.id === currentId );
				if ( !layer || !layer.parentGroup ) {
					break;
				}
				depth++;
				currentId = layer.parentGroup;
				iterations++;
			}

			return depth;
		}

		/**
		 * Render the layer list
		 * Uses virtual scrolling for large layer counts (30+) to prevent UI slowdowns
		 */
		render() {
			const layers = this.getLayers();
			const listContainer = this.layerList;

			if ( !listContainer ) {
				return;
			}

			// Handle empty state
			if ( layers.length === 0 ) {
				// Disable virtualization if active
				if ( this._virtualList ) {
					this._virtualList.disable();
				}
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

			// Try virtual rendering for large layer counts
			if ( this._virtualList && this._virtualList.render() ) {
				// Virtualization handled the render
				return;
			}

			// Standard rendering for smaller layer counts
			this._renderStandard( layers, listContainer );
		}

		/**
		 * Standard (non-virtual) rendering for smaller layer counts
		 *
		 * @param {Array} layers Array of layer objects
		 * @param {HTMLElement} listContainer Layer list container
		 * @private
		 */
		_renderStandard( layers, listContainer ) {
			// Map existing DOM items by ID (exclude background layer item)
			const existingItems = {};
			const domItems = listContainer.querySelectorAll( '.layer-item:not(.background-layer-item)' );
			for ( let i = 0; i < domItems.length; i++ ) {
				existingItems[ domItems[ i ].dataset.layerId ] = domItems[ i ];
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

			// Apply indentation for nested layers
			if ( depth > 0 ) {
				item.style.paddingLeft = ( depth * this.indentPerLevel ) + 'px';
				item.classList.add( 'layer-item-child' );
			}

			// ARIA attributes for listbox option
			item.setAttribute( 'role', 'option' );
			const selectedIds = this.getSelectedLayerIds();
			const isSelected = selectedIds.includes( String( layer.id ) ) ||
				selectedIds.includes( layer.id );
			item.setAttribute( 'aria-selected', isSelected ? 'true' : 'false' );
			const layerName = layer.name || this.getDefaultLayerName( layer );
			item.setAttribute( 'aria-label', layerName );

			if ( isSelected ) {
				item.classList.add( 'selected' );
			}

			// Expand/collapse toggle for groups (before grab area)
			if ( isGroup ) {
				const expandToggle = this._createExpandToggle( layer, isExpanded, t );
				item.appendChild( expandToggle );
			}

			// Grab area - also serves as the focusable element for keyboard navigation
			const grabArea = this._createGrabArea( layer, layerName, t, isGroup, isExpanded );

			// Visibility toggle
			const visibilityBtn = this._createVisibilityButton( layer, t );

			// Name - NOT editable by default (only becomes editable when clicking on already-selected layer)
			const name = document.createElement( 'span' );
			name.className = 'layer-name';
			name.textContent = layerName;
			name.contentEditable = 'false';
			name.style.cursor = 'pointer';
			name.setAttribute( 'role', 'button' );
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
		 * @param {boolean} [isGroup=false] Whether this is a group layer
		 * @param {boolean} [isExpanded=true] Whether the group is expanded
		 * @return {HTMLElement} Grab area element
		 * @private
		 */
		_createGrabArea( layer, layerName, t, isGroup, isExpanded ) {
			const grabArea = document.createElement( 'div' );
			grabArea.className = 'layer-grab-area';
			const grabTitle = isGroup ?
				t( 'layers-folder-grab', 'Drag to reorder folder' ) :
				t( 'layers-grab-area', 'Drag to move/select' );
			grabArea.title = grabTitle + ' (' + t( 'layers-keyboard-nav-hint', 'Use arrow keys to navigate, Enter to select' ) + ')';
			grabArea.setAttribute( 'tabindex', '0' );
			grabArea.setAttribute( 'role', 'button' );
			grabArea.setAttribute( 'aria-label', layerName + ' - ' + grabTitle );
			// Size is controlled by CSS - no inline styles needed

			// NOTE: Keyboard reordering is now handled via event delegation in LayerItemEvents.
			// Arrow key events on .layer-grab-area elements trigger onMoveLayer callback.
			// This avoids listener accumulation when layer items are recreated.

			// Use folder icon for groups, grab dots for regular layers
			if ( isGroup ) {
				if ( IconFactory && IconFactory.createFolderIcon ) {
					const folderIcon = IconFactory.createFolderIcon( isExpanded );
					grabArea.appendChild( folderIcon );
				} else {
					// Fallback folder icon
					const folderIcon = this._createFolderIconFallback( isExpanded );
					grabArea.appendChild( folderIcon );
				}
			} else {
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
			}

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
			const isGroup = layer.type === 'group';
			const isEmpty = isGroup && ( !layer.children || layer.children.length === 0 );
			const depth = this.getLayerDepth( layer.id );

			// Update attributes
			item.dataset.layerId = layer.id;
			item.dataset.index = index;
			item.dataset.depth = depth;

			// Update indentation
			if ( depth > 0 ) {
				item.style.paddingLeft = ( depth * this.indentPerLevel ) + 'px';
				item.classList.add( 'layer-item-child' );
			} else {
				item.style.paddingLeft = '';
				item.classList.remove( 'layer-item-child' );
			}

			// Update group class
			if ( isGroup ) {
				item.classList.add( 'layer-item-group' );
			} else {
				item.classList.remove( 'layer-item-group' );
			}

			// Update empty folder state
			if ( isEmpty ) {
				item.classList.add( 'folder-empty' );
			} else {
				item.classList.remove( 'folder-empty' );
			}

			// Update ARIA attributes
			const selectedIds = this.getSelectedLayerIds();
			const isSelected = selectedIds.includes( String( layer.id ) ) ||
				selectedIds.includes( layer.id );
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
				const grabTitle = isGroup ?
					t( 'layers-folder-grab', 'Drag to reorder folder' ) :
					t( 'layers-grab-area', 'Drag to move/select' );
				grabArea.setAttribute( 'aria-label', layerName + ' - ' + grabTitle );
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
				case ( LAYER_TYPES.GROUP || 'group' ):
					return t( 'layers-type-folder', 'Folder' );
				case ( LAYER_TYPES.TEXT || 'text' ): {
					const prefix = t( 'layers-default-text-prefix', 'Text: ' );
					const emptyText = t( 'layers-default-empty', 'Empty' );
					return prefix + ( ( layer.text || emptyText ).slice( 0, 20 ) );
				}
				case ( LAYER_TYPES.RECTANGLE || 'rectangle' ):
					return t( 'layers-type-rectangle', 'Rectangle' );
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

		/**
		 * Create expand/collapse toggle for group layers
		 *
		 * @param {Object} layer Layer object
		 * @param {boolean} isExpanded Whether the group is expanded
		 * @param {Function} t Message getter
		 * @return {HTMLElement} Expand toggle element
		 * @private
		 */
		_createExpandToggle( layer, isExpanded, t ) {
			const toggle = document.createElement( 'button' );
			toggle.className = 'layer-expand-toggle';
			toggle.type = 'button';
			toggle.setAttribute( 'aria-expanded', isExpanded ? 'true' : 'false' );
			toggle.setAttribute( 'aria-label', isExpanded ?
				t( 'layers-folder-collapse', 'Collapse folder' ) :
				t( 'layers-folder-expand', 'Expand folder' ) );
			toggle.title = isExpanded ?
				t( 'layers-folder-collapse', 'Collapse folder' ) :
				t( 'layers-folder-expand', 'Expand folder' );

			// Create triangle icon
			if ( IconFactory && IconFactory.createExpandIcon ) {
				toggle.appendChild( IconFactory.createExpandIcon( isExpanded ) );
			} else {
				// Fallback text indicator
				toggle.textContent = isExpanded ? '▼' : '▶';
				toggle.style.fontSize = '10px';
				toggle.style.width = '20px';
			}

			// NOTE: Click handler for expand/collapse is now handled via event delegation
			// in LayerItemEvents. Clicks on .layer-expand-toggle trigger onToggleGroupExpand.
			// This avoids listener accumulation when layer items are recreated.

			return toggle;
		}

		/**
		 * Create folder icon fallback when IconFactory is not available
		 *
		 * @param {boolean} expanded Whether the folder is expanded
		 * @return {SVGElement} Folder icon SVG element
		 * @private
		 */
		_createFolderIconFallback( expanded ) {
			const SVG_NS = 'http://www.w3.org/2000/svg';
			const size = 18;
			const color = '#f39c12';

			const svg = document.createElementNS( SVG_NS, 'svg' );
			svg.setAttribute( 'width', String( size ) );
			svg.setAttribute( 'height', String( size ) );
			svg.setAttribute( 'viewBox', '0 0 24 24' );
			svg.setAttribute( 'aria-hidden', 'true' );

			// Folder path
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
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.LayerListRenderer = LayerListRenderer;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = LayerListRenderer;
	}
}() );
