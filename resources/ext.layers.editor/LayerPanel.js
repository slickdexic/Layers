/**
 * Layer Panel for Layers Editor
 * Manages the layer list, visibility, ordering, and layer properties
 */
( function () {
	'use strict';

	// Import UI components (available as globals from ResourceLoader)
	const IconFactory = window.IconFactory;
	const ColorPickerDialog = window.ColorPickerDialog;
	const ConfirmDialog = window.ConfirmDialog;
	const PropertiesForm = window.PropertiesForm;

	/**
	 * @class LayerPanel
	 * @param {Object} config
	 * @param {HTMLElement} config.container The container element for the panel
	 * @param {window.LayersEditor} config.editor A reference to the main editor instance
	 * @param {HTMLElement} [config.inspectorContainer] Optional inspector container
	 */
	function LayerPanel( config ) {
		this.config = config || {};
		this.container = this.config.container;
		this.editor = this.config.editor;
		this.inspectorContainer = this.config.inspectorContainer || null;
		// REMOVED: this.layers = []; - Now use StateManager
		// REMOVED: this.selectedLayerId = null; - Now use StateManager
		this.stateSubscriptions = []; // Track subscriptions for cleanup
		this.dialogCleanups = [];

		// Initialize EventTracker for memory-safe event listener management
		this.eventTracker = window.EventTracker ? new window.EventTracker() : null;

		this.createInterface();
		this.setupEventHandlers();
		this.subscribeToState();
		}

		/**
		 * Get layers from StateManager (single source of truth)
		 * @return {Array} Current layers array
		 */
		LayerPanel.prototype.getLayers = function () {
			if ( this.editor && this.editor.stateManager ) {
				return this.editor.stateManager.get( 'layers' ) || [];
			}
			return [];
		};

		/**
		 * Get selected layer ID from StateManager
		 * @return {string|null} Currently selected layer ID
		 */
		LayerPanel.prototype.getSelectedLayerId = function () {
			if ( this.editor && this.editor.stateManager ) {
				const selectedIds = this.editor.stateManager.get( 'selectedLayerIds' ) || [];
				return selectedIds.length > 0 ? selectedIds[ selectedIds.length - 1 ] : null;
			}
			return null;
		};

		/**
		 * Subscribe to StateManager changes for reactive updates
		 */
		LayerPanel.prototype.subscribeToState = function () {
			const self = this;
			if ( !this.editor || !this.editor.stateManager ) {
				return;
			}

			// Subscribe to layers changes
			const unsubLayers = this.editor.stateManager.subscribe( 'layers', function () {
				self.renderLayerList();
				self.updateCodePanel();
			} );
			this.stateSubscriptions.push( unsubLayers );

			// Subscribe to selection changes
			const unsubSelection = this.editor.stateManager.subscribe( 'selectedLayerIds', function ( newIds ) {
				const selectedId = newIds && newIds.length > 0 ? newIds[ newIds.length - 1 ] : null;
				self.renderLayerList();
				self.updatePropertiesPanel( selectedId );
			} );
			this.stateSubscriptions.push( unsubSelection );
		};

		LayerPanel.prototype.isDebugEnabled = function () {
			return !!( window.mw && window.mw.config && window.mw.config.get( 'wgLayersDebug' ) );
		};

		LayerPanel.prototype.logDebug = function () {
			if ( this.isDebugEnabled() && window.mw && window.mw.log ) {
				const args = Array.prototype.slice.call( arguments );
				args.unshift( '[LayerPanel]' );
				window.mw.log.apply( window.mw, args );
			}
		};

		LayerPanel.prototype.logWarn = function () {
			if ( window.mw && window.mw.log && typeof window.mw.log.warn === 'function' ) {
				const args = Array.prototype.slice.call( arguments );
				args.unshift( '[LayerPanel]' );
				window.mw.log.warn.apply( window.mw.log, args );
			}
		};

		LayerPanel.prototype.logError = function () {
			if ( window.mw && window.mw.log && typeof window.mw.log.error === 'function' ) {
				const args = Array.prototype.slice.call( arguments );
				args.unshift( '[LayerPanel]' );
				window.mw.log.error.apply( window.mw.log, args );
			}
		};

		LayerPanel.prototype.addDocumentListener = function ( event, handler, options ) {
			if ( !event || typeof handler !== 'function' ) {
				return;
			}
			if ( this.eventTracker ) {
				this.eventTracker.add( document, event, handler, options );
			} else {
				// Fallback if EventTracker not available
				document.addEventListener( event, handler, options );
			}
		};

		/**
		 * Add event listener to a specific element with automatic tracking
		 * @param {Element} target Target element
		 * @param {string} event Event type
		 * @param {Function} handler Event handler
		 * @param {Object} [options] Event listener options
		 */
		LayerPanel.prototype.addTargetListener = function ( target, event, handler, options ) {
			if ( !target || typeof target.addEventListener !== 'function' || typeof handler !== 'function' ) {
				return;
			}
			if ( this.eventTracker ) {
				this.eventTracker.add( target, event, handler, options );
			} else {
				// Fallback if EventTracker not available
				target.addEventListener( event, handler, options );
			}
		};

		/**
		 * Remove all document event listeners tracked by EventTracker
		 */
		LayerPanel.prototype.removeDocumentListeners = function () {
			if ( this.eventTracker ) {
				this.eventTracker.removeAllForElement( document );
			}
		};

		/**
		 * Remove all element event listeners tracked by EventTracker (except document)
		 */
		LayerPanel.prototype.removeTargetListeners = function () {
			// EventTracker's destroy() handles all at once; this is kept for compatibility
			// If needed, could iterate non-document elements, but destroy() is cleaner
		};

		/**
		 * Remove all event listeners
		 */
		LayerPanel.prototype.removeAllListeners = function () {
			if ( this.eventTracker ) {
				this.eventTracker.destroy();
			}
		};

		LayerPanel.prototype.registerDialogCleanup = function ( cleanupFn ) {
			if ( typeof cleanupFn === 'function' ) {
				this.dialogCleanups.push( cleanupFn );
			}
		};

		LayerPanel.prototype.runDialogCleanups = function () {
			while ( this.dialogCleanups && this.dialogCleanups.length ) {
				const cleanup = this.dialogCleanups.pop();
				try {
					cleanup();
				} catch ( err ) {
					// Log cleanup errors but don't propagate to avoid cascading failures
					if ( window.layersErrorHandler ) {
						window.layersErrorHandler.handleError( err, 'LayerPanel.runDialogCleanups', 'canvas', { severity: 'low' } );
					}
				}
			}
			this.dialogCleanups = [];
		};

		LayerPanel.prototype.destroy = function () {
			// Unsubscribe from state changes
			if ( this.stateSubscriptions && this.stateSubscriptions.length > 0 ) {
				this.stateSubscriptions.forEach( function ( unsubscribe ) {
					if ( typeof unsubscribe === 'function' ) {
						unsubscribe();
					}
				} );
				this.stateSubscriptions = [];
			}
			this.runDialogCleanups();
			this.removeAllListeners();
			document.body.classList.remove( 'layers-resize-cursor' );
			this.dialogCleanups = [];
			this.eventTracker = null;
		};

	/**
	 * Get localized message with fallback
	 * Delegates to centralized MessageHelper for consistent i18n handling.
	 * @param {string} key Message key
	 * @param {string} fallback Fallback text
	 * @return {string}
	 */
	LayerPanel.prototype.msg = function ( key, fallback ) {
		// Try centralized MessageHelper first
		if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
			return window.layersMessages.get( key, fallback );
		}
		// Fall back to direct mw.message if MessageHelper unavailable
		if ( window.mw && window.mw.message ) {
			try {
				return mw.message( key ).text();
			} catch ( e ) {
				// Fall through to return fallback
			}
		}
		return fallback || '';
	};

	// Helper function to set multiple attributes on an element
	LayerPanel.prototype.setAttributes = function ( element, attributes ) {
		for ( const key in attributes ) {
			if ( Object.prototype.hasOwnProperty.call( attributes, key ) ) {
				element.setAttribute( key, attributes[ key ] );
			}
		}
	};

	// SVG Helper Functions - delegate to IconFactory
	LayerPanel.prototype.createSVGElement = function ( tag, attributes ) {
		return IconFactory ? IconFactory.createSVGElement( tag, attributes ) : null;
	};

	LayerPanel.prototype.createEyeIcon = function ( visible ) {
		return IconFactory ? IconFactory.createEyeIcon( visible ) : document.createElement( 'span' );
	};

	LayerPanel.prototype.createLockIcon = function ( locked ) {
		return IconFactory ? IconFactory.createLockIcon( locked ) : document.createElement( 'span' );
	};

	LayerPanel.prototype.createDeleteIcon = function () {
		return IconFactory ? IconFactory.createDeleteIcon() : document.createElement( 'span' );
	};

	// No-op kept for backward compatibility
	LayerPanel.prototype.updateCodePanel = function () {};

	LayerPanel.prototype.createInterface = function () {
		const self = this;
		// Clear container safely without innerHTML
		while ( this.container.firstChild ) {
			this.container.removeChild( this.container.firstChild );
		}
		this.container.setAttribute( 'role', 'region' );
		this.container.setAttribute( 'aria-label', this.msg( 'layers-panel-title', 'Layers' ) );

		// Header
		const header = document.createElement( 'div' );
		header.className = 'layers-panel-header';
		const title = document.createElement( 'h3' );
		title.className = 'layers-panel-title';
		title.textContent = this.msg( 'layers-panel-title', 'Layers' );
		header.appendChild( title );
		const subtitle = document.createElement( 'div' );
		subtitle.className = 'layers-panel-subtitle';
		subtitle.textContent = this.msg( 'layers-panel-subtitle', 'Drag to reorder • Click name to rename' );
		header.appendChild( subtitle );
		this.container.appendChild( header );

		// Inner flex container to prevent underlap and allow resizing
		const sidebarInner = document.createElement( 'div' );
		sidebarInner.className = 'layers-panel-inner layers-flex-layout';

		// Layer list
		this.layerList = document.createElement( 'div' );
		this.layerList.className = 'layers-list';
		this.layerList.setAttribute( 'role', 'listbox' );
		this.layerList.setAttribute( 'aria-label', this.msg( 'layers-panel-title', 'Layers' ) );
		const emptyState = document.createElement( 'div' );
		emptyState.className = 'layers-empty';
		emptyState.textContent = this.msg( 'layers-empty', 'No layers yet. Choose a tool to begin.' );
		this.layerList.appendChild( emptyState );

		// Divider (resizer)
		const divider = document.createElement( 'div' );
		divider.className = 'layers-panel-divider';
		divider.setAttribute( 'tabindex', '0' );
		divider.setAttribute( 'role', 'separator' );
		divider.setAttribute( 'aria-orientation', 'horizontal' );
		divider.title = this.msg( 'layers-panel-divider', 'Drag to resize panels' );

		// Properties panel
		this.propertiesPanel = document.createElement( 'div' );
		this.propertiesPanel.className = 'layers-properties';
		this.propertiesPanel.setAttribute( 'role', 'region' );
		this.propertiesPanel.setAttribute( 'aria-label', this.msg( 'layers-properties-title', 'Properties' ) );
		// Build properties panel header/content without innerHTML
		while ( this.propertiesPanel.firstChild ) {
			this.propertiesPanel.removeChild( this.propertiesPanel.firstChild );
		}
		const propsHeader = document.createElement( 'h4' );
		propsHeader.textContent = this.msg( 'layers-properties-title', 'Properties' );
		const propsContent = document.createElement( 'div' );
		propsContent.className = 'properties-content';
		this.propertiesPanel.appendChild( propsHeader );
		this.propertiesPanel.appendChild( propsContent );

		sidebarInner.appendChild( this.layerList );
		sidebarInner.appendChild( divider );
		sidebarInner.appendChild( this.propertiesPanel );
		this.container.appendChild( sidebarInner );


		// Resizable divider logic
		let isDragging = false;
		const minListHeight = 60;
		const minPropsHeight = 80;
		this.addTargetListener( divider, 'mousedown', function () {
			isDragging = true;
			document.body.classList.add( 'layers-resize-cursor' );
		} );
		const handleMouseMove = function ( e ) {
			if ( !isDragging ) {
				return;
			}
			const rect = sidebarInner.getBoundingClientRect();
			const offset = e.clientY - rect.top;
			const totalHeight = sidebarInner.offsetHeight;
			const dividerHeight = divider.offsetHeight;
			const maxListHeight = totalHeight - dividerHeight - minPropsHeight;
			const newListHeight = Math.max( minListHeight, Math.min( offset, maxListHeight ) );
			const newPropsHeight = totalHeight - newListHeight - dividerHeight;
			if ( self.layerList && self.layerList.classList ) {
				self.layerList.classList.add( 'layers-fixed-height' );
				self.layerList.style.height = newListHeight + 'px';
			}
			if ( self.propertiesPanel && self.propertiesPanel.classList ) {
				self.propertiesPanel.classList.add( 'layers-fixed-height' );
				self.propertiesPanel.style.height = newPropsHeight + 'px';
			}
		};
		this.addDocumentListener( 'mousemove', handleMouseMove );
		const handleMouseUp = function () {
			if ( isDragging ) {
				isDragging = false;
				document.body.classList.remove( 'layers-resize-cursor' );
			}
		};
		this.addDocumentListener( 'mouseup', handleMouseUp );

		// Touch support
		this.addTargetListener( divider, 'touchstart', function () {
			isDragging = true;
			document.body.classList.add( 'layers-resize-cursor' );
		} );
		const handleTouchMove = function ( e ) {
			if ( !isDragging ) {
				return;
			}
			const rect = sidebarInner.getBoundingClientRect();
			const offset = e.touches[ 0 ].clientY - rect.top;
			const totalHeight = sidebarInner.offsetHeight;
			const dividerHeight = divider.offsetHeight;
			const maxListHeight = totalHeight - dividerHeight - minPropsHeight;
			const newListHeight = Math.max( minListHeight, Math.min( offset, maxListHeight ) );
			const newPropsHeight = totalHeight - newListHeight - dividerHeight;
			if ( self.layerList && self.layerList.classList ) {
				self.layerList.classList.add( 'layers-fixed-height' );
				self.layerList.style.height = newListHeight + 'px';
			}
			if ( self.propertiesPanel && self.propertiesPanel.classList ) {
				self.propertiesPanel.classList.add( 'layers-fixed-height' );
				self.propertiesPanel.style.height = newPropsHeight + 'px';
			}
		};
		this.addDocumentListener( 'touchmove', handleTouchMove, { passive: false } );
		const handleTouchEnd = function () {
			if ( isDragging ) {
				isDragging = false;
				document.body.classList.remove( 'layers-resize-cursor' );
			}
		};
		this.addDocumentListener( 'touchend', handleTouchEnd );
	};

	LayerPanel.prototype.setupEventHandlers = function () {
		const self = this;
		// Clicks in the list
		if ( this.layerList ) {
			this.addTargetListener( this.layerList, 'click', function ( e ) {
				self.handleLayerListClick( e );
			} );
		}
		// Drag and drop reordering
		this.setupDragAndDrop();
		// Live transform sync from CanvasManager during manipulation
		try {
			const target = ( this.editor && this.editor.container ) || document;
			this.addTargetListener( target, 'layers:transforming', function ( e ) {
				const detail = e && e.detail || {};
				if ( !detail || !detail.id ) {
					return;
				}
				if ( String( detail.id ) !== String( self.getSelectedLayerId() ) ) {
					return;
				}
				self.syncPropertiesFromLayer( detail.layer || detail );
			} );
		} catch ( err ) {
			if ( window.layersErrorHandler ) {
				window.layersErrorHandler.handleError( err, 'LayerPanel.setupPropertiesSync', 'canvas' );
			}
		}
	};

	LayerPanel.prototype.updateLayers = function ( layers ) {
		// State is managed by StateManager - just trigger a re-render
		// The actual layers array is stored in editor.stateManager
		if ( layers && this.editor && this.editor.stateManager ) {
			this.editor.stateManager.set( 'layers', layers );
		}
		// renderLayerList will be called by the state subscription
	};

	LayerPanel.prototype.renderLayerList = function () {
		const self = this;
		const layers = this.getLayers();
		const listContainer = this.layerList;

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
		const newLayerIds = layers.map( function ( l ) {
			return String( l.id );
		} );
		for ( const id in existingItems ) {
			if ( newLayerIds.indexOf( id ) === -1 ) {
				listContainer.removeChild( existingItems[ id ] );
			}
		}

		// Second pass: Create or update items and ensure order
		let previousSibling = null;
		layers.forEach( function ( layer, index ) {
			const layerId = String( layer.id );
			let item = existingItems[ layerId ];

			if ( !item ) {
				// Create new
				item = self.createLayerItem( layer, index );
				existingItems[ layerId ] = item; // Add to map
			} else {
				// Update existing
				self.updateLayerItem( item, layer, index );
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
	};

	LayerPanel.prototype.moveLayer = function ( layerId, direction ) {
		const layers = this.getLayers().slice(); // Make a copy to modify
		let index = -1;
		for ( let i = 0; i < layers.length; i++ ) {
			if ( layers[ i ].id === layerId ) {
				index = i;
				break;
			}
		}
		if ( index === -1 ) {
			return;
		}
		const newIndex = index + direction;
		if ( newIndex < 0 || newIndex >= layers.length ) {
			return;
		}

		// Swap
		const temp = layers[ index ];
		layers[ index ] = layers[ newIndex ];
		layers[ newIndex ] = temp;

		if ( this.editor.stateManager ) {
			this.editor.stateManager.set( 'layers', layers );
		}
		if ( this.editor.canvasManager ) {
			this.editor.canvasManager.redraw();
		}
		this.renderLayerList();
		this.editor.saveState( 'Reorder Layers' );

		// Restore focus
		const newItem = this.layerList.querySelector( '.layer-item[data-layer-id="' + layerId + '"] .layer-grab-area' );
		if ( newItem ) {
			newItem.focus();
		}
	};

	LayerPanel.prototype.createLayerItem = function ( layer, index ) {
		const t = this.msg.bind( this );
		const item = document.createElement( 'div' );
		item.className = 'layer-item';
		item.dataset.layerId = layer.id;
		item.dataset.index = index;
		item.draggable = true;
		if ( layer.id === this.getSelectedLayerId() ) {
			item.classList.add( 'selected' );
		}

		// Grab area
		const grabArea = document.createElement( 'div' );
		grabArea.className = 'layer-grab-area';
		grabArea.title = t( 'layers-grab-area', 'Drag to move/select' );
		grabArea.setAttribute( 'tabindex', '0' );
		grabArea.setAttribute( 'role', 'button' );
		grabArea.setAttribute( 'aria-label', t( 'layers-grab-area', 'Drag to move/select' ) );
		grabArea.style.width = '36px';
		grabArea.style.height = '36px';
		grabArea.style.display = 'flex';
		grabArea.style.alignItems = 'center';
		grabArea.style.justifyContent = 'center';
		grabArea.style.cursor = 'grab';
		
		// Keyboard reordering
		const self = this;
		grabArea.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'ArrowUp' || e.key === 'ArrowDown' ) {
				e.preventDefault();
				const direction = e.key === 'ArrowUp' ? -1 : 1;
				self.moveLayer( layer.id, direction );
			}
		} );

		// Build grab icon via DOM to avoid innerHTML
		const grabSvg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		grabSvg.setAttribute( 'width', '24' );
		grabSvg.setAttribute( 'height', '24' );
		grabSvg.setAttribute( 'viewBox', '0 0 24 24' );
		grabSvg.setAttribute( 'aria-hidden', 'true' );
		const mkCircle = function ( cx, cy ) {
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
		visibilityBtn.style.width = '36px';
		visibilityBtn.style.height = '36px';

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
		lockBtn.style.width = '36px';
		lockBtn.style.height = '36px';

		// Delete button
		const deleteBtn = document.createElement( 'button' );
		deleteBtn.className = 'layer-delete';
		deleteBtn.appendChild( this.createDeleteIcon() );
		deleteBtn.title = t( 'layers-delete-layer-button', 'Delete layer' );
		deleteBtn.type = 'button';
		deleteBtn.setAttribute( 'aria-label', t( 'layers-delete-layer-button', 'Delete layer' ) );
		deleteBtn.style.width = '36px';
		deleteBtn.style.height = '36px';

		item.appendChild( grabArea );
		item.appendChild( visibilityBtn );
		item.appendChild( name );
		item.appendChild( lockBtn );
		item.appendChild( deleteBtn );
		return item;
	};

	LayerPanel.prototype.updateLayerItem = function ( item, layer, index ) {
		// eslint-disable-next-line no-unused-vars
		const _t = this.msg.bind( this );
		
		// Update attributes
		item.dataset.layerId = layer.id;
		item.dataset.index = index;
		
		// Update selection state
		if ( layer.id === this.getSelectedLayerId() ) {
			item.classList.add( 'selected' );
		} else {
			item.classList.remove( 'selected' );
		}
		
		// Update visibility icon
		const visibilityBtn = item.querySelector( '.layer-visibility' );
		if ( visibilityBtn ) {
			// Clear existing icon
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
			// Clear existing icon
			while ( lockBtn.firstChild ) {
				lockBtn.removeChild( lockBtn.firstChild );
			}
			lockBtn.appendChild( this.createLockIcon( !!layer.locked ) );
		}
	};

	LayerPanel.prototype.getDefaultLayerName = function ( layer ) {
		const t = this.msg.bind( this );
		const LAYER_TYPES = window.LayersConstants ? window.LayersConstants.LAYER_TYPES : {};
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
			case ( LAYER_TYPES.HIGHLIGHT || 'highlight' ):
				return t( 'layers-type-highlight', 'Highlight' );
			default:
				return t( 'layers-type-layer', 'Layer' );
		}
	};

	LayerPanel.prototype.handleLayerListClick = function ( e ) {
		const target = e.target;
		const layerItem = target.closest( '.layer-item' );
		if ( !layerItem ) {
			return;
		}
		const layerId = layerItem.dataset.layerId;
		const layer = this.editor.getLayerById( layerId );
		if ( !layer ) {
			return;
		}
		const visibilityBtn = target.closest( '.layer-visibility' );
		const lockBtn = target.closest( '.layer-lock' );
		const deleteBtn = target.closest( '.layer-delete' );
		const nameEl = target.closest( '.layer-name' );
		if ( visibilityBtn ) {
			this.toggleLayerVisibility( layerId );
		} else if ( lockBtn ) {
			this.toggleLayerLock( layerId );
		} else if ( deleteBtn ) {
			this.deleteLayer( layerId );
		} else if ( nameEl ) {
			this.editLayerName( layerId, nameEl );
		} else {
			this.selectLayer( layerId );
		}
	};

	LayerPanel.prototype.selectLayer = function ( layerId, fromCanvas ) {
		// Update selection through StateManager (single source of truth)
		if ( this.editor && this.editor.stateManager ) {
			this.editor.stateManager.set( 'selectedLayerIds', layerId ? [ layerId ] : [] );
		}
		// Note: renderLayerList and updatePropertiesPanel are called by state subscription
		if ( !fromCanvas && this.editor.canvasManager ) {
			this.editor.canvasManager.selectLayer( layerId, true );
		}
	};

	LayerPanel.prototype.toggleLayerVisibility = function ( layerId ) {
		const layer = this.editor.getLayerById( layerId );
		if ( layer ) {
			layer.visible = !( layer.visible !== false );
			if ( this.editor.canvasManager ) {
				const layers = this.editor.stateManager ? this.editor.stateManager.get( 'layers' ) || [] : [];
				this.editor.canvasManager.renderLayers( layers );
			}
			this.renderLayerList();
			this.updateCodePanel();
			this.editor.saveState( layer.visible ? 'Show Layer' : 'Hide Layer' );
		}
	};

	LayerPanel.prototype.toggleLayerLock = function ( layerId ) {
		const layer = this.editor.getLayerById( layerId );
		if ( layer ) {
			layer.locked = !layer.locked;
			this.renderLayerList();
			this.editor.saveState( layer.locked ? 'Lock Layer' : 'Unlock Layer' );
		}
	};

	LayerPanel.prototype.deleteLayer = function ( layerId ) {
		const self = this;
		const t = this.msg.bind( this );
		const confirmMessage = t( 'layers-delete-confirm', 'Are you sure you want to delete this layer?' );

		const performDelete = function () {
			self.editor.removeLayer( layerId );
			self.renderLayerList();
			self.updateCodePanel();
			if ( self.getSelectedLayerId() === layerId ) {
				// Clear selection through StateManager
				if ( self.editor && self.editor.stateManager ) {
					self.editor.stateManager.set( 'selectedLayerIds', [] );
				}
				self.updatePropertiesPanel( null );
			}
			self.editor.saveState( 'Delete Layer' );
		};

		// Always use custom dialog - OOUI dialogs have z-index issues with the fixed editor container
		this.createConfirmDialog( confirmMessage, performDelete );
	};

	LayerPanel.prototype.editLayerName = function ( layerId, nameElement ) {
		const self = this;
		const originalName = nameElement.textContent;
		const maxLength = 100;
		nameElement.addEventListener( 'input', function () {
			const currentText = nameElement.textContent;
			if ( currentText.length > maxLength ) {
				nameElement.textContent = currentText.slice( 0, maxLength );
				const range = document.createRange();
				const sel = window.getSelection();
				range.selectNodeContents( nameElement );
				range.collapse( false );
				sel.removeAllRanges();
				sel.addRange( range );
			}
		} );
		nameElement.addEventListener( 'blur', function () {
			const newName = nameElement.textContent.trim();
			if ( newName && newName !== originalName ) {
				self.editor.updateLayer( layerId, { name: newName } );
				self.editor.saveState( 'Rename Layer' );
			}
		} );
		nameElement.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'Enter' ) {
				nameElement.blur();
			} else if ( e.key === 'Escape' ) {
				nameElement.textContent = originalName;
				nameElement.blur();
			}
		} );
	};

	LayerPanel.prototype.updatePropertiesPanel = function ( layerId ) {
		const contentDiv = this.propertiesPanel.querySelector( '.properties-content' );
		const t = this.msg.bind( this );
		if ( !layerId ) {
			while ( contentDiv.firstChild ) {
				contentDiv.removeChild( contentDiv.firstChild );
			}
			const p1 = document.createElement( 'p' );
			p1.textContent = t( 'layers-no-layer-selected', 'No layer selected' );
			contentDiv.appendChild( p1 );
			return;
		}
		const layer = this.editor.getLayerById( layerId );
		if ( !layer ) {
			while ( contentDiv.firstChild ) {
				contentDiv.removeChild( contentDiv.firstChild );
			}
			const p2 = document.createElement( 'p' );
			p2.textContent = t( 'layers-layer-not-found', 'Layer not found' );
			contentDiv.appendChild( p2 );
			return;
		}
		const form = this.createPropertiesForm( layer );
		while ( contentDiv.firstChild ) {
			contentDiv.removeChild( contentDiv.firstChild );
		}
		contentDiv.appendChild( form );
	};

	// Build properties form with sections; delegate to extracted PropertiesForm component
	LayerPanel.prototype.createPropertiesForm = function ( layer ) {
		const self = this;

		// Use extracted PropertiesForm component if available
		if ( PropertiesForm && typeof PropertiesForm.create === 'function' ) {
			return PropertiesForm.create( layer, this.editor, function ( cleanup ) {
				self.registerDialogCleanup( cleanup );
			} );
		}

		// Fallback: create basic form with minimal fields
		const form = document.createElement( 'form' );
		form.className = 'layer-properties-form';
		const p = document.createElement( 'p' );
		p.textContent = this.msg( 'layers-properties-unavailable', 'Properties form unavailable' );
		form.appendChild( p );
		return form;
	};

	// Live sync selected layer's transform props into current form inputs
	LayerPanel.prototype.syncPropertiesFromLayer = function ( layer ) {
		if ( !layer || !this.propertiesPanel ) {
			return;
		}
		const root = this.propertiesPanel.querySelector( '.layer-properties-form' ) || this.propertiesPanel;
		const inputs = root.querySelectorAll( 'input[data-prop]' );
		const formatOne = function ( n, decimalsAttr ) {
			if ( typeof n !== 'number' || isNaN( n ) ) {
				return '';
			}
			if ( String( decimalsAttr ) === '1' ) { const r = Math.round( n * 10 ) / 10; const isInt = Math.abs( r - Math.round( r ) ) < 1e-9; return isInt ? String( Math.round( r ) ) : r.toFixed( 1 ); }
			return String( n );
		};
		inputs.forEach( function ( input ) {
			const prop = input.getAttribute( 'data-prop' );
			if ( !prop ) {
				return;
			}
			if ( document.activeElement === input ) {
				return;
			}
			let val;
			if ( prop === 'width' && ( layer.type === 'ellipse' ) ) { val = ( layer.width != null ) ? layer.width : ( ( layer.radiusX || 0 ) * 2 ); }
			else if ( prop === 'height' && ( layer.type === 'ellipse' ) ) { val = ( layer.height != null ) ? layer.height : ( ( layer.radiusY || 0 ) * 2 ); }
			else { val = layer[ prop ]; }
			if ( typeof val === 'number' ) { const formatted = formatOne( val, input.getAttribute( 'data-decimals' ) ); if ( input.value !== formatted ) { input.value = formatted; } }
		} );
	};

	LayerPanel.prototype.setupDragAndDrop = function () {
		const self = this;
		if ( !this.layerList ) {
			return;
		}
		this.addTargetListener( this.layerList, 'dragstart', function ( e ) {
			const li = e.target.closest( '.layer-item' );
			if ( li ) { e.dataTransfer.setData( 'text/plain', li.dataset.layerId ); li.classList.add( 'dragging' ); }
		} );
		this.addTargetListener( this.layerList, 'dragend', function ( e ) { const li = e.target.closest( '.layer-item' ); if ( li ) { li.classList.remove( 'dragging' ); } } );
		this.addTargetListener( this.layerList, 'dragover', function ( e ) { e.preventDefault(); } );
		this.addTargetListener( this.layerList, 'drop', function ( e ) {
			e.preventDefault();
			const draggedId = e.dataTransfer.getData( 'text/plain' );
			const targetItem = e.target.closest( '.layer-item' );
			if ( targetItem && draggedId && draggedId !== targetItem.dataset.layerId ) { self.reorderLayers( draggedId, targetItem.dataset.layerId ); }
		} );
	};

	LayerPanel.prototype.reorderLayers = function ( draggedId, targetId ) {
		// Use StateManager's reorderLayer method if available
		if ( this.editor.stateManager && this.editor.stateManager.reorderLayer ) {
			const result = this.editor.stateManager.reorderLayer( draggedId, targetId );
			if ( result ) {
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.redraw();
				}
				this.renderLayerList();
			}
			return;
		}

		// Fallback for legacy support (when StateManager doesn't have reorderLayer)
		const layers = this.getLayers().slice(); // Make a copy to modify
		let draggedIndex = -1;
		let targetIndex = -1;
		let i;
		for ( i = 0; i < layers.length; i++ ) {
			if ( layers[ i ].id === draggedId ) {
				draggedIndex = i;
				break;
			}
		}
		for ( i = 0; i < layers.length; i++ ) {
			if ( layers[ i ].id === targetId ) {
				targetIndex = i;
				break;
			}
		}
		if ( draggedIndex !== -1 && targetIndex !== -1 ) {
			const draggedLayer = layers.splice( draggedIndex, 1 )[ 0 ];
			layers.splice( targetIndex, 0, draggedLayer );
			if ( this.editor.stateManager ) {
				this.editor.stateManager.set( 'layers', layers );
			}
			if ( this.editor.canvasManager ) {
				this.editor.canvasManager.redraw();
			}
			this.renderLayerList();
			this.editor.saveState( 'Reorder Layers' );
		}
	};

	LayerPanel.prototype.createConfirmDialog = function ( message, onConfirm ) {
		const self = this;
		const t = this.msg.bind( this );

		// Use extracted ConfirmDialog component if available
		if ( ConfirmDialog ) {
			ConfirmDialog.show( {
				message: message,
				onConfirm: onConfirm,
				strings: {
					title: t( 'layers-confirm-title', 'Confirmation' ),
					cancel: t( 'layers-cancel', 'Cancel' ),
					confirm: t( 'layers-confirm', 'Confirm' )
				},
				registerCleanup: function ( cleanup ) {
					self.registerDialogCleanup( cleanup );
				}
			} );
			return;
		}

		// Fallback: inline dialog implementation
		const overlay = document.createElement( 'div' );
		overlay.className = 'layers-modal-overlay';
		overlay.setAttribute( 'role', 'presentation' );
		
		const dialog = document.createElement( 'div' );
		dialog.className = 'layers-modal-dialog';
		dialog.setAttribute( 'role', 'alertdialog' );
		dialog.setAttribute( 'aria-modal', 'true' );
		dialog.setAttribute( 'aria-label', t( 'layers-confirm-title', 'Confirmation' ) );
		
		const text = document.createElement( 'p' );
		text.textContent = message;
		dialog.appendChild( text );
		
		const buttons = document.createElement( 'div' );
		buttons.className = 'layers-modal-buttons';
		
		const cancelBtn = document.createElement( 'button' );
		cancelBtn.textContent = t( 'layers-cancel', 'Cancel' );
		cancelBtn.className = 'layers-btn layers-btn-secondary';
		
		const confirmBtn = document.createElement( 'button' );
		confirmBtn.textContent = t( 'layers-confirm', 'Confirm' );
		confirmBtn.className = 'layers-btn layers-btn-danger';
		
		buttons.appendChild( cancelBtn );
		buttons.appendChild( confirmBtn );
		dialog.appendChild( buttons );
		
		document.body.appendChild( overlay );
		document.body.appendChild( dialog );
		
		const cleanup = function () {
			if ( overlay.parentNode ) {
				overlay.parentNode.removeChild( overlay );
			}
			if ( dialog.parentNode ) {
				dialog.parentNode.removeChild( dialog );
			}
			document.removeEventListener( 'keydown', handleKey );
		};
		
		const handleKey = function ( e ) {
			if ( e.key === 'Escape' ) {
				cleanup();
			} else if ( e.key === 'Tab' ) {
				const focusable = dialog.querySelectorAll( 'button' );
				if ( focusable.length ) {
					const first = focusable[ 0 ];
					const last = focusable[ focusable.length - 1 ];
					if ( e.shiftKey && document.activeElement === first ) {
						e.preventDefault();
						last.focus();
					} else if ( !e.shiftKey && document.activeElement === last ) {
						e.preventDefault();
						first.focus();
					}
				}
			}
		};
		document.addEventListener( 'keydown', handleKey );
		
		cancelBtn.addEventListener( 'click', cleanup );
		confirmBtn.addEventListener( 'click', function () {
			cleanup();
			onConfirm();
		} );
		
		confirmBtn.focus();
	};

	/**
	 * Simple confirmation dialog fallback
	 * @param {string} message - The confirmation message
	 * @return {boolean} - User's choice
	 */
	LayerPanel.prototype.simpleConfirm = function ( message ) {
		// Use extracted ConfirmDialog static method if available
		if ( ConfirmDialog && typeof ConfirmDialog.simpleConfirm === 'function' ) {
			return ConfirmDialog.simpleConfirm( message, this.logWarn.bind( this ) );
		}
		// Fallback
		if ( typeof window !== 'undefined' && typeof window.confirm === 'function' ) {
			return window.confirm( message );
		}
		if ( typeof this.logWarn === 'function' ) {
			this.logWarn( 'Confirmation dialog unavailable; auto-confirming action', message );
		}
		return true;
	};

	// Pure renderer for Wikitext code so LayersEditor can embed it in the footer
	LayerPanel.prototype.renderCodeSnippet = function ( layers ) {
		const t = this.msg.bind( this );
		const list = Array.isArray( layers ) ? layers : this.getLayers();
		const visibleLayers = list.filter( function ( layer ) { return layer.visible !== false; } );
		const filename = this.editor && this.editor.filename ? this.editor.filename : 'YourImage.jpg';
		let codeHtml = '';
		if ( visibleLayers.length === 0 ) {
			codeHtml = '<p><strong>' + t( 'layers-code-none', 'No layers visible.' ) + '</strong> ' + t( 'layers-code-enable', 'Enable layers to see the code.' ) + '</p>';
		} else if ( visibleLayers.length === list.length ) {
			codeHtml = '<p><strong>' + t( 'layers-code-all-visible', 'All layers visible:' ) + '</strong></p>' +
				'<code class="layers-code">[[File:' + filename + '|500px|layers=all|' + t( 'layers-code-caption', 'Your caption' ) + ']]</code>' +
				'<button class="copy-btn" data-code="layers=all">' + t( 'layers-code-copy', 'Copy' ) + '</button>';
		} else {
			const layerIds = visibleLayers.map( function ( layer ) { return layer.id || ( 'layer_' + Math.random().toString( 36 ).slice( 2, 6 ) ); } );
			const layersParam = layerIds.join( ',' );
			codeHtml = '<p><strong>' + t( 'layers-code-selected-visible', 'Selected layers visible:' ) + '</strong></p>' +
				'<code class="layers-code">[[File:' + filename + '|500px|layers=' + layersParam + '|' + t( 'layers-code-caption', 'Your caption' ) + ']]</code>' +
				'<button class="copy-btn" data-code="layers=' + layersParam + '">' + t( 'layers-code-copy', 'Copy' ) + '</button>';
		}
		return codeHtml;
	};

	// Export LayerPanel
	window.LayerPanel = LayerPanel;
}());
