/**
 * Layer Panel for Layers Editor
 * Manages the layer list, visibility, ordering, and layer properties
 */
( function () {
	'use strict';

	/**
	 * Get INTEGER_EPSILON from MathUtils namespace (with fallback)
	 * @return {number}
	 */
	function getIntegerEpsilon() {
		if ( window.Layers && window.Layers.MathUtils && window.Layers.MathUtils.MATH ) {
			return window.Layers.MathUtils.MATH.INTEGER_EPSILON;
		}
		// Fallback if MathUtils not loaded
		return 1e-9;
	}

	/**
	 * Helper to get a class from namespace or global fallback (lazy evaluation)
	 * Prefers window.Layers.* namespace, falls back to window.* for compatibility
	 *
	 * @param {string} namespacePath - Path under window.Layers (e.g., 'Utils.EventTracker')
	 * @param {string} globalName - Global fallback name (e.g., 'EventTracker')
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
	 * LayerPanel class
	 * Manages the layer list, visibility, ordering, and layer properties
	 */
	class LayerPanel {
		/**
		 * Create a LayerPanel instance
		 *
		 * @param {Object} config Configuration object
		 * @param {HTMLElement} config.container The container element for the panel
		 * @param {window.LayersEditor} config.editor A reference to the main editor instance
		 * @param {HTMLElement} [config.inspectorContainer] Optional inspector container
		 */
		constructor( config ) {
			this.config = config || {};
			this.container = this.config.container;
			this.editor = this.config.editor;
			this.inspectorContainer = this.config.inspectorContainer || null;
			// REMOVED: this.layers = []; - Now use StateManager
			// REMOVED: this.selectedLayerId = null; - Now use StateManager
			this.stateSubscriptions = []; // Track subscriptions for cleanup
			this.dialogCleanups = [];

			// Layer search/filter state
			this.searchFilter = '';
			this.searchInput = null;

			// Initialize EventTracker for memory-safe event listener management
			const EventTracker = getClass( 'Utils.EventTracker', 'EventTracker' );
			this.eventTracker = EventTracker ? new EventTracker() : null;

			// Initialize LayerItemFactory for layer item creation
			this.initLayerItemFactory();

			// Initialize BackgroundLayerController (will be fully configured after createInterface)
			this.backgroundLayerController = null;

			// Initialize FolderOperationsController for folder/group operations
			this.initFolderOperationsController();

			// Initialize ContextMenuController for right-click menus
			this.initContextMenuController();

			this.createInterface();
			this.setupEventHandlers();
			this.subscribeToState();
		}

		/**
		 * Initialize the FolderOperationsController for folder/group operations
		 */
		initFolderOperationsController() {
			const FolderOperationsController = getClass( 'UI.FolderOperationsController', 'FolderOperationsController' );
			if ( FolderOperationsController ) {
				this.folderController = new FolderOperationsController( {
					editor: this.editor,
					msg: this.msg.bind( this ),
					getSelectedLayerIds: this.getSelectedLayerIds.bind( this ),
					renderLayerList: this.renderLayerList.bind( this ),
					updateCodePanel: this.updateCodePanel.bind( this ),
					updatePropertiesPanel: this.updatePropertiesPanel.bind( this ),
					registerDialogCleanup: this.registerDialogCleanup.bind( this )
				} );
			}
		}

		/**
		 * Initialize the ContextMenuController for right-click context menus
		 */
		initContextMenuController() {
			const ContextMenuController = getClass( 'UI.ContextMenuController', 'ContextMenuController' );
			if ( ContextMenuController ) {
				this.contextMenuController = new ContextMenuController( {
					editor: this.editor,
					msg: this.msg.bind( this ),
					getSelectedLayerIds: this.getSelectedLayerIds.bind( this ),
					selectLayer: this.selectLayer.bind( this ),
					createGroupFromSelection: this.createGroupFromSelection.bind( this ),
					ungroupLayer: this.ungroupLayer.bind( this ),
					deleteLayer: this.deleteLayer.bind( this ),
					editLayerName: this.editLayerName.bind( this )
				} );
			}
		}

		/**
		 * Show canvas properties in the properties panel (for slides)
		 * Called when the Canvas layer is selected
		 */
		showCanvasProperties() {
		if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log( '[LayerPanel] showCanvasProperties called' );
		}

		if ( !this.propertiesPanel ) {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[LayerPanel] showCanvasProperties: propertiesPanel is null' );
			}
			return;
		}

		const contentDiv = this.propertiesPanel.querySelector( '.properties-content' );
		if ( !contentDiv ) {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[LayerPanel] showCanvasProperties: contentDiv not found' );
			}
			return;
		}

		// Clear existing content
		while ( contentDiv.firstChild ) {
			contentDiv.removeChild( contentDiv.firstChild );
		}

		const t = this.msg.bind( this );
		const form = document.createElement( 'form' );
		form.className = 'canvas-properties-form';

		// Title
		const title = document.createElement( 'h4' );
		title.textContent = t( 'layers-slide-canvas-layer', 'Canvas' );
		title.style.cssText = 'margin: 0 0 12px 0; font-size: 14px;';
		form.appendChild( title );

		// Size controls
		const sizeGroup = document.createElement( 'div' );
		sizeGroup.className = 'canvas-size-group';
		sizeGroup.style.cssText = 'margin-bottom: 12px;';

		const sizeLabel = document.createElement( 'label' );
		sizeLabel.textContent = t( 'layers-slide-canvas-size', 'Canvas size' );
		sizeLabel.style.cssText = 'display: block; margin-bottom: 4px; font-weight: 600;';
		sizeGroup.appendChild( sizeLabel );

		const sizeRow = document.createElement( 'div' );
		sizeRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';

		// Width
		const widthInput = this.createCanvasSizeInput( 'width', t );
		sizeRow.appendChild( widthInput );

		const separator = document.createElement( 'span' );
		separator.textContent = '×';
		sizeRow.appendChild( separator );

		// Height
		const heightInput = this.createCanvasSizeInput( 'height', t );
		sizeRow.appendChild( heightInput );

		sizeGroup.appendChild( sizeRow );
		form.appendChild( sizeGroup );

		// Background color
		const colorGroup = document.createElement( 'div' );
		colorGroup.className = 'canvas-color-group';
		colorGroup.style.cssText = 'margin-bottom: 12px;';

		const colorLabel = document.createElement( 'label' );
		colorLabel.textContent = t( 'layers-slide-background-color', 'Background color' );
		colorLabel.style.cssText = 'display: block; margin-bottom: 4px; font-weight: 600;';
		colorGroup.appendChild( colorLabel );

		const colorRow = document.createElement( 'div' );
		colorRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';

		const colorSwatch = this.createCanvasColorSwatch( t );
		colorRow.appendChild( colorSwatch );

		colorGroup.appendChild( colorRow );
		form.appendChild( colorGroup );

		contentDiv.appendChild( form );

		if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log( '[LayerPanel] showCanvasProperties: form created and appended' );
		}
	}

	/**
	 * Create a size input for canvas properties
	 *
	 * @param {string} dimension 'width' or 'height'
	 * @param {Function} t Translation function
	 * @return {HTMLElement} Input element
	 */
	createCanvasSizeInput( dimension, t ) {
			const group = document.createElement( 'div' );
			group.style.cssText = 'display: flex; align-items: center; gap: 4px;';

			const label = document.createElement( 'span' );
			label.textContent = dimension === 'width' ? 'W:' : 'H:';
			label.style.cssText = 'font-size: 11px; color: #666;';

			const input = document.createElement( 'input' );
			input.type = 'number';
			input.min = '100';
			input.max = '4000';
			input.step = '10';
			input.style.cssText = 'width: 60px; padding: 4px 6px;';
			input.setAttribute( 'aria-label', dimension === 'width' ?
				t( 'layers-slide-canvas-width', 'Width' ) :
				t( 'layers-slide-canvas-height', 'Height' ) );

			// Get current value
			const stateKey = dimension === 'width' ? 'slideCanvasWidth' : 'slideCanvasHeight';
			const defaultVal = dimension === 'width' ? 800 : 600;
			if ( this.editor && this.editor.stateManager ) {
				input.value = String( this.editor.stateManager.get( stateKey ) || defaultVal );
			} else {
				input.value = String( defaultVal );
			}

			// Handle changes
			const self = this;
			const handler = function () {
				const value = parseInt( input.value, 10 );
				if ( !isNaN( value ) && value >= 100 && value <= 4000 ) {
					if ( self.backgroundLayerController && self.backgroundLayerController.setCanvasDimension ) {
						self.backgroundLayerController.setCanvasDimension( dimension, value );
					}
				}
			};

			this.addTargetListener( input, 'change', handler );
			this.addTargetListener( input, 'blur', handler );

			group.appendChild( label );
			group.appendChild( input );

			return group;
		}

		/**
		 * Create a color swatch button for canvas background
		 *
		 * @param {Function} t Translation function
		 * @return {HTMLElement} Color swatch button
		 */
		createCanvasColorSwatch( t ) {
			const color = this.editor && this.editor.stateManager ?
				this.editor.stateManager.get( 'slideBackgroundColor' ) || '#ffffff' :
				'#ffffff';

			const swatch = document.createElement( 'button' );
			swatch.type = 'button';
			swatch.className = 'canvas-color-swatch';
			swatch.title = t( 'layers-slide-change-color', 'Change background color' );
			swatch.setAttribute( 'aria-label', t( 'layers-slide-change-color', 'Change background color' ) );

			// Apply initial color using shared helper
			this.updateSwatchColor( swatch, color );

			const self = this;
			const clickHandler = function () {
				if ( self.backgroundLayerController && self.backgroundLayerController.openColorPicker ) {
					self.backgroundLayerController.openColorPicker( swatch );
				}
			};

			this.addTargetListener( swatch, 'click', clickHandler );

			// Store reference for updates
			this.canvasColorSwatch = swatch;

			return swatch;
		}

		/**
		 * Update a color swatch's appearance
		 * Uses consistent transparency pattern matching ColorPickerDialog
		 *
		 * @param {HTMLElement} swatch The swatch element
		 * @param {string} color The color value
		 */
		updateSwatchColor( swatch, color ) {
			if ( !swatch ) {
				return;
			}

			const isTransparent = !color || color === 'transparent' || color === 'none';

			// Base styles always applied
			const baseStyles = 'width: 32px; height: 32px; border: 2px solid #ccc; border-radius: 4px; cursor: pointer;';

			if ( isTransparent ) {
				// Red diagonal stripe pattern - matches ColorPickerDialog exactly
				swatch.style.cssText = baseStyles + ' background: repeating-linear-gradient(45deg, #ff0000 0, #ff0000 4px, transparent 4px, transparent 8px);';
			} else {
				swatch.style.cssText = baseStyles + ' background-color: ' + color + ';';
			}
		}

		/**
		 * Update canvas color swatch when background color changes
		 *
		 * @param {string} color The new background color
		 */
		updateCanvasColorSwatch( color ) {
			this.updateSwatchColor( this.canvasColorSwatch, color );
		}

		/**
		 * Initialize the LayerItemFactory with appropriate callbacks
		 */
		initLayerItemFactory() {
			const LayerItemFactory = getClass( 'UI.LayerItemFactory', 'LayerItemFactory' );
			if ( LayerItemFactory ) {
				this.layerItemFactory = new LayerItemFactory( {
					msg: this.msg.bind( this ),
					getSelectedLayerId: this.getSelectedLayerId.bind( this ),
					getSelectedLayerIds: this.getSelectedLayerIds.bind( this ),
					addTargetListener: this.addTargetListener.bind( this ),
					onMoveLayer: this.moveLayer.bind( this ),
					onToggleGroupExpand: this.toggleGroupExpand.bind( this ),
					getLayerDepth: this.getLayerDepth.bind( this )
				} );
			}
		}

		/**
		 * Get the nesting depth of a layer
		 *
		 * @param {string} layerId Layer ID
		 * @return {number} Nesting depth (0 for top-level)
		 */
		getLayerDepth( layerId ) {
			// Use GroupManager if available
			if ( this.editor && this.editor.groupManager ) {
				return this.editor.groupManager.getLayerDepth( layerId );
			}
			// Fallback: calculate from parentGroup chain
			const layers = this.getLayers();
			let depth = 0;
			const currentId = layerId;

			const findLayer = ( id ) => layers.find( ( l ) => l.id === id );
			let layer = findLayer( currentId );

			while ( layer && layer.parentGroup ) {
				depth++;
				layer = findLayer( layer.parentGroup );
				// Prevent infinite loops
				if ( depth > 10 ) {
					break;
				}
			}

			return depth;
		}

		/**
		 * Toggle expand/collapse state of a group layer
		 *
		 * @param {string} groupId Group layer ID
		 */
		toggleGroupExpand( groupId ) {
			// Use GroupManager if available
			if ( this.editor && this.editor.groupManager ) {
				this.editor.groupManager.toggleExpanded( groupId );
				return;
			}

			// Fallback: update layer directly
			const layer = this.editor.getLayerById( groupId );
			if ( layer && layer.type === 'group' ) {
				layer.expanded = layer.expanded === false;
				this.renderLayerList();
			}
		}

		/**
		 * Get layers from StateManager (single source of truth)
		 *
		 * @return {Array} Current layers array
		 */
		getLayers() {
			if ( this.editor && this.editor.stateManager ) {
				return this.editor.stateManager.get( 'layers' ) || [];
			}
			return [];
		}

		/**
		 * Get layers visible in the layer panel (excludes children of collapsed groups)
		 *
		 * @return {Array} Layers that should be displayed in the layer panel
		 */
		getVisibleLayers() {
			const allLayers = this.getLayers();
			if ( allLayers.length === 0 ) {
				return [];
			}

			// Build a map of collapsed groups
			const collapsedGroupIds = new Set();
			for ( const layer of allLayers ) {
				if ( layer.type === 'group' && layer.expanded === false ) {
					collapsedGroupIds.add( layer.id );
				}
			}

			// Apply search filter if active
			const searchTerm = this.searchFilter || '';
			const hasSearch = searchTerm.length > 0;

			// Filter layers
			return allLayers.filter( ( layer ) => {
				// Check search filter first (if active)
				if ( hasSearch ) {
					const layerName = ( layer.name || layer.type || '' ).toLowerCase();
					const layerText = ( layer.text || '' ).toLowerCase();
					const matchesSearch = layerName.indexOf( searchTerm ) !== -1 ||
						layerText.indexOf( searchTerm ) !== -1;
					if ( !matchesSearch ) {
						return false;
					}
				}

				// Check if any ancestor group is collapsed (skip if searching)
				if ( !hasSearch && collapsedGroupIds.size > 0 ) {
					let parentId = layer.parentGroup;
					while ( parentId ) {
						if ( collapsedGroupIds.has( parentId ) ) {
							return false; // Hide this layer - its parent is collapsed
						}
						// Find the parent layer to check its parent
						const parent = allLayers.find( ( l ) => l.id === parentId );
						parentId = parent ? parent.parentGroup : null;
					}
				}
				return true;
			} );
		}

		/**
		 * Update the search result count display
		 */
		updateSearchResultCount() {
			if ( !this.searchResultCount ) {
				return;
			}

			const allLayers = this.getLayers();
			const visibleLayers = this.getVisibleLayers();

			if ( this.searchFilter ) {
				this.searchResultCount.textContent = this.msg(
					'layers-search-results',
					'Showing $1 of $2 layers'
				).replace( '$1', visibleLayers.length ).replace( '$2', allLayers.length );
				this.searchResultCount.style.display = 'block';
			} else {
				this.searchResultCount.style.display = 'none';
			}
		}

		/**
		 * Get selected layer ID from StateManager
		 *
		 * @return {string|null} Currently selected layer ID
		 */
		getSelectedLayerId() {
			if ( this.editor && this.editor.stateManager ) {
				const selectedIds = this.editor.stateManager.get( 'selectedLayerIds' ) || [];
				return selectedIds.length > 0 ? selectedIds[ selectedIds.length - 1 ] : null;
			}
			return null;
		}

		/**
		 * Get all selected layer IDs from StateManager
		 *
		 * @return {Array} Array of selected layer IDs
		 */
		getSelectedLayerIds() {
			if ( this.editor && this.editor.stateManager ) {
				return this.editor.stateManager.get( 'selectedLayerIds' ) || [];
			}
			return [];
		}

		/**
		 * Create a folder (group) - can be empty or include selected layers
		 * Delegates to FolderOperationsController
		 */
		createFolder() {
			if ( this.folderController ) {
				this.folderController.createFolder();
			}
		}

		/**
		 * @deprecated since 1.4.0 - Use createFolder() instead. Will be removed in v2.0.
		 * Create a group from currently selected layers (legacy method)
		 */
		createGroupFromSelection() {
			this.createFolder();
		}

		/**
		 * Subscribe to StateManager changes for reactive updates
		 */
		subscribeToState() {
			if ( !this.editor || !this.editor.stateManager ) {
				return;
			}

			// Track previous layer count for accessibility announcements
			let previousLayerCount = ( this.editor.stateManager.get( 'layers' ) || [] ).length;

			// Subscribe to layers changes
			const unsubLayers = this.editor.stateManager.subscribe( 'layers', ( newLayers ) => {
				const currentCount = ( newLayers || [] ).length;

				// LOW-8 FIX: Announce layer count changes to screen readers
				if ( currentCount !== previousLayerCount ) {
					if ( currentCount > previousLayerCount ) {
						this.announceToScreenReader(
							this.msg( 'layers-aria-layer-added', 'Layer added. ' ) +
							this.msg( 'layers-aria-layer-count', '$1 layers total', currentCount )
						);
					} else if ( currentCount < previousLayerCount ) {
						this.announceToScreenReader(
							this.msg( 'layers-aria-layer-removed', 'Layer removed. ' ) +
							this.msg( 'layers-aria-layer-count', '$1 layers total', currentCount )
						);
					}
					previousLayerCount = currentCount;
				}

				this.renderLayerList();
				this.updateCodePanel();
			} );
			this.stateSubscriptions.push( unsubLayers );

			// Subscribe to selection changes
			const unsubSelection = this.editor.stateManager.subscribe( 'selectedLayerIds', ( newIds ) => {
				const selectedId = newIds && newIds.length > 0 ? newIds[ newIds.length - 1 ] : null;
				// Clear canvas layer selection when a regular layer is selected
				if ( selectedId && this.editor.stateManager.get( 'canvasLayerSelected' ) ) {
					this.editor.stateManager.set( 'canvasLayerSelected', false );
					// Remove selection from canvas layer item
					const canvasItem = this.layerList && this.layerList.querySelector( '.background-layer-item' );
					if ( canvasItem ) {
						canvasItem.classList.remove( 'selected' );
						canvasItem.setAttribute( 'aria-selected', 'false' );
					}
				}
				this.renderLayerList();
				// Don't update properties panel if canvas layer is selected (handled separately)
				if ( !this.editor.stateManager.get( 'canvasLayerSelected' ) ) {
					this.updatePropertiesPanel( selectedId );
				}
			} );
			this.stateSubscriptions.push( unsubSelection );
		}

		/**
		 * Announce a message to screen readers via aria-live region
		 * LOW-8 FIX: Accessibility improvement for layer list updates
		 *
		 * @param {string} message The message to announce
		 */
		announceToScreenReader( message ) {
			if ( this.ariaLiveRegion && message ) {
				// Clear first to ensure re-announcement of same message
				this.ariaLiveRegion.textContent = '';
				// Use setTimeout to ensure the clear is processed first
				setTimeout( () => {
					if ( this.ariaLiveRegion ) {
						this.ariaLiveRegion.textContent = message;
					}
				}, 50 );
			}
		}

		/**
		 * Check if debug mode is enabled
		 *
		 * @return {boolean} True if debug mode is enabled
		 */
		isDebugEnabled() {
			return !!( window.mw && window.mw.config && window.mw.config.get( 'wgLayersDebug' ) );
		}

		/**
		 * Log debug message
		 *
		 * @param {...*} args Arguments to log
		 */
		logDebug( ...args ) {
			if ( this.isDebugEnabled() && window.mw && window.mw.log ) {
				window.mw.log( '[LayerPanel]', ...args );
			}
		}

		/**
		 * Log warning message
		 *
		 * @param {...*} args Arguments to log
		 */
		logWarn( ...args ) {
			if ( window.mw && window.mw.log && typeof window.mw.log.warn === 'function' ) {
				window.mw.log.warn( '[LayerPanel]', ...args );
			}
		}

		/**
		 * Log error message
		 *
		 * @param {...*} args Arguments to log
		 */
		logError( ...args ) {
			if ( window.mw && window.mw.log && typeof window.mw.log.error === 'function' ) {
				window.mw.log.error( '[LayerPanel]', ...args );
			}
		}

		/**
		 * Add document event listener with automatic tracking
		 *
		 * @param {string} event Event type
		 * @param {Function} handler Event handler
		 * @param {Object} [options] Event listener options
		 */
		addDocumentListener( event, handler, options ) {
			if ( !event || typeof handler !== 'function' ) {
				return;
			}
			if ( this.eventTracker ) {
				this.eventTracker.add( document, event, handler, options );
			} else {
				// Fallback if EventTracker not available
				document.addEventListener( event, handler, options );
			}
		}

		/**
		 * Add event listener to a specific element with automatic tracking
		 *
		 * @param {Element} target Target element
		 * @param {string} event Event type
		 * @param {Function} handler Event handler
		 * @param {Object} [options] Event listener options
		 */
		addTargetListener( target, event, handler, options ) {
			if ( !target || typeof target.addEventListener !== 'function' || typeof handler !== 'function' ) {
				return;
			}
			if ( this.eventTracker ) {
				this.eventTracker.add( target, event, handler, options );
			} else {
				// Fallback if EventTracker not available
				target.addEventListener( event, handler, options );
			}
		}

		/**
		 * Remove all document event listeners tracked by EventTracker
		 */
		removeDocumentListeners() {
			if ( this.eventTracker ) {
				this.eventTracker.removeAllForElement( document );
			}
		}

		/**
		 * Remove all element event listeners tracked by EventTracker (except document)
		 */
		removeTargetListeners() {
			// EventTracker's destroy() handles all at once; this is kept for compatibility
			// If needed, could iterate non-document elements, but destroy() is cleaner
		}

		/**
		 * Remove all event listeners
		 */
		removeAllListeners() {
			if ( this.eventTracker ) {
				this.eventTracker.destroy();
			}
		}

		/**
		 * Register a cleanup function for dialog cleanup
		 *
		 * @param {Function} cleanupFn Cleanup function to register
		 */
		registerDialogCleanup( cleanupFn ) {
			if ( typeof cleanupFn === 'function' ) {
				this.dialogCleanups.push( cleanupFn );
			}
		}

		/**
		 * Run all dialog cleanup functions
		 */
		runDialogCleanups() {
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
		}

		/**
		 * Clean up resources and destroy the panel
		 */
		destroy() {
			// Unsubscribe from state changes
			if ( this.stateSubscriptions && this.stateSubscriptions.length > 0 ) {
				this.stateSubscriptions.forEach( ( unsubscribe ) => {
					if ( typeof unsubscribe === 'function' ) {
						unsubscribe();
					}
				} );
				this.stateSubscriptions = [];
			}
			// Clean up BackgroundLayerController
			if ( this.backgroundLayerController && typeof this.backgroundLayerController.destroy === 'function' ) {
				this.backgroundLayerController.destroy();
				this.backgroundLayerController = null;
			}
			// Clean up LayerItemEvents controller
			if ( this.itemEventsController && typeof this.itemEventsController.destroy === 'function' ) {
				this.itemEventsController.destroy();
				this.itemEventsController = null;
			}
			this.runDialogCleanups();
			this.removeAllListeners();
			document.body.classList.remove( 'layers-resize-cursor' );
			this.dialogCleanups = [];
			this.eventTracker = null;
		}

		/**
		 * Get localized message with fallback
		 * Delegates to centralized MessageHelper for consistent i18n handling.
		 *
		 * @param {string} key Message key
		 * @param {string} fallback Fallback text
		 * @return {string}
		 */
		msg( key, fallback ) {
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
		}

		/**
		 * Toggle the mobile collapsed state of the panel
		 * Only effective when viewport is at mobile width (768px or less)
		 */
		toggleMobileCollapse() {
			const isCollapsed = this.container.classList.toggle( 'layers-panel-collapsed' );
			if ( this.collapseBtn ) {
				const icon = this.collapseBtn.querySelector( '.collapse-icon' );
				if ( icon ) {
					icon.textContent = isCollapsed ? '▲' : '▼';
				}
				this.collapseBtn.setAttribute( 'aria-expanded', String( !isCollapsed ) );
				this.collapseBtn.setAttribute(
					'aria-label',
					isCollapsed ?
						this.msg( 'layers-panel-expand', 'Expand panel' ) :
						this.msg( 'layers-panel-collapse', 'Collapse panel' )
				);
			}
		}

		/**
		 * Helper function to set multiple attributes on an element
		 *
		 * @param {Element} element Target element
		 * @param {Object} attributes Attributes to set
		 */
		setAttributes( element, attributes ) {
			for ( const key in attributes ) {
				if ( Object.prototype.hasOwnProperty.call( attributes, key ) ) {
					element.setAttribute( key, attributes[ key ] );
				}
			}
		}

		/**
		 * Create SVG element - delegate to IconFactory
		 *
		 * @param {string} tag SVG tag name
		 * @param {Object} attributes Attributes to set
		 * @return {Element|null} SVG element or null
		 */
		createSVGElement( tag, attributes ) {
			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
			return IconFactory ? IconFactory.createSVGElement( tag, attributes ) : null;
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
		 * No-op kept for backward compatibility.
		 * Code panel functionality was removed; this stub prevents errors from old callers.
		 *
		 * @deprecated since 1.5.0 - Code panel moved to UIManager. Will be removed in v2.0.
		 * @return {void}
		 */
		updateCodePanel() {}

		/**
		 * Create the panel interface
		 */
		createInterface() {
			// Clear container safely without innerHTML
			while ( this.container.firstChild ) {
				this.container.removeChild( this.container.firstChild );
			}
			this.container.setAttribute( 'role', 'region' );
			this.container.setAttribute( 'aria-label', this.msg( 'layers-panel-title', 'Layers' ) );

			// Header
			const header = document.createElement( 'div' );
			header.className = 'layers-panel-header';

			// Main header row: logo+folder on left, search on right
			const headerRow = document.createElement( 'div' );
			headerRow.className = 'layers-panel-header-row';

			// Left side: logo with add folder button beside it
			const leftGroup = document.createElement( 'div' );
			leftGroup.className = 'layers-panel-header-left';

			// Full Layers logo (external SVG file for exact rendering)
			const logoImg = document.createElement( 'img' );
			const assetsPath = ( typeof mw !== 'undefined' && mw.config && mw.config.get ) ?
				mw.config.get( 'wgExtensionAssetsPath' ) : '/extensions';
			logoImg.src = assetsPath + '/Layers/resources/ext.layers.editor/images/Layers_Logo.svg';
			logoImg.alt = this.msg( 'layers-panel-title', 'Layers' );
			logoImg.className = 'layers-panel-logo';
			leftGroup.appendChild( logoImg );

			// Create Folder button (beside logo)
			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
			const createGroupBtn = document.createElement( 'button' );
			createGroupBtn.className = 'layers-btn layers-btn-icon layers-create-group-btn';
			createGroupBtn.type = 'button';
			createGroupBtn.title = this.msg( 'layers-add-folder', 'Add folder' );
			createGroupBtn.setAttribute( 'aria-label', this.msg( 'layers-add-folder', 'Add folder' ) );

			// Folder icon with plus badge for create folder
			if ( IconFactory && IconFactory.createAddFolderIcon ) {
				createGroupBtn.appendChild( IconFactory.createAddFolderIcon() );
			} else if ( IconFactory && IconFactory.createFolderIcon ) {
				createGroupBtn.appendChild( IconFactory.createFolderIcon( false ) );
			} else {
				createGroupBtn.textContent = '📁+';
			}

			this.addTargetListener( createGroupBtn, 'click', () => {
				this.createFolder();
			} );
			leftGroup.appendChild( createGroupBtn );

			headerRow.appendChild( leftGroup );

			// Right side: search bar
			const searchContainer = document.createElement( 'div' );
			searchContainer.className = 'layers-search-container';

			this.searchInput = document.createElement( 'input' );
			this.searchInput.type = 'text';
			this.searchInput.className = 'layers-search-input';
			this.searchInput.placeholder = this.msg( 'layers-search-placeholder', 'Search layers...' );
			this.searchInput.setAttribute( 'aria-label', this.msg( 'layers-search-placeholder', 'Search layers...' ) );

			const clearBtn = document.createElement( 'button' );
			clearBtn.type = 'button';
			clearBtn.className = 'layers-search-clear';
			clearBtn.textContent = '×';
			clearBtn.title = this.msg( 'layers-search-clear', 'Clear search' );
			clearBtn.setAttribute( 'aria-label', this.msg( 'layers-search-clear', 'Clear search' ) );
			clearBtn.style.display = 'none';

			this.addTargetListener( this.searchInput, 'input', () => {
				this.searchFilter = this.searchInput.value.toLowerCase().trim();
				clearBtn.style.display = this.searchFilter ? 'block' : 'none';
				this.updateSearchResultCount();
				this.renderLayerList();
			} );

			this.addTargetListener( clearBtn, 'click', () => {
				this.searchInput.value = '';
				this.searchFilter = '';
				clearBtn.style.display = 'none';
				this.searchResultCount.style.display = 'none';
				this.renderLayerList();
				this.searchInput.focus();
			} );

			searchContainer.appendChild( this.searchInput );
			searchContainer.appendChild( clearBtn );
			headerRow.appendChild( searchContainer );

			// Mobile collapse toggle button (only visible on mobile)
			const collapseBtn = document.createElement( 'button' );
			collapseBtn.className = 'layers-panel-collapse-btn';
			collapseBtn.type = 'button';
			collapseBtn.setAttribute( 'aria-label', this.msg( 'layers-panel-expand', 'Expand panel' ) );
			collapseBtn.setAttribute( 'aria-expanded', 'true' );
			const collapseIcon = document.createElement( 'span' );
			collapseIcon.className = 'collapse-icon';
			collapseIcon.textContent = '▼';
			collapseBtn.appendChild( collapseIcon );
			this.addTargetListener( collapseBtn, 'click', () => {
				this.toggleMobileCollapse();
			} );
			this.collapseBtn = collapseBtn;
			headerRow.appendChild( collapseBtn );

			header.appendChild( headerRow );

			// Search result count (below header row)
			this.searchResultCount = document.createElement( 'div' );
			this.searchResultCount.className = 'layers-search-count';
			this.searchResultCount.style.display = 'none';
			header.appendChild( this.searchResultCount );

			this.container.appendChild( header );

			// Inner flex container to prevent underlap and allow resizing
			const sidebarInner = document.createElement( 'div' );
			sidebarInner.className = 'layers-panel-inner layers-flex-layout';

			// Layer list
			this.layerList = document.createElement( 'div' );
			this.layerList.className = 'layers-list';
			this.layerList.setAttribute( 'role', 'listbox' );
			this.layerList.setAttribute( 'aria-label', this.msg( 'layers-panel-title', 'Layers' ) );

			// LOW-8 FIX: Add aria-live region for screen reader announcements
			this.ariaLiveRegion = document.createElement( 'div' );
			this.ariaLiveRegion.setAttribute( 'aria-live', 'polite' );
			this.ariaLiveRegion.setAttribute( 'aria-atomic', 'true' );
			this.ariaLiveRegion.className = 'layers-sr-only';
			// Visually hidden but accessible to screen readers
			this.ariaLiveRegion.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
			this.layerList.appendChild( this.ariaLiveRegion );

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
			let startMouseY = 0;
			let startListHeight = 0;
			const minListHeight = 60;
			const minPropsHeight = 80;

			this.addTargetListener( divider, 'mousedown', ( e ) => {
				isDragging = true;
				startMouseY = e.clientY;
				// Measure BEFORE adding class (to get current constrained height)
				startListHeight = this.layerList.getBoundingClientRect().height;
				// Now switch to fixed mode and immediately set the height to lock it in
				this.layerList.classList.add( 'layers-fixed-height' );
				this.layerList.style.height = startListHeight + 'px';
				document.body.classList.add( 'layers-resize-cursor' );
				e.preventDefault();
			} );

			const handleMouseMove = ( e ) => {
				if ( !isDragging ) {
					return;
				}
				const delta = e.clientY - startMouseY;
				const totalHeight = sidebarInner.offsetHeight;
				const dividerHeight = divider.offsetHeight;
				const maxListHeight = totalHeight - dividerHeight - minPropsHeight;
				const newListHeight = Math.max( minListHeight, Math.min( startListHeight + delta, maxListHeight ) );
				this.layerList.style.height = newListHeight + 'px';
			};
			this.addDocumentListener( 'mousemove', handleMouseMove );

			const handleMouseUp = () => {
				if ( isDragging ) {
					isDragging = false;
					document.body.classList.remove( 'layers-resize-cursor' );
				}
			};
			this.addDocumentListener( 'mouseup', handleMouseUp );

			// Touch support
			this.addTargetListener( divider, 'touchstart', ( e ) => {
				isDragging = true;
				startMouseY = e.touches[ 0 ].clientY;
				// Measure BEFORE adding class
				startListHeight = this.layerList.getBoundingClientRect().height;
				this.layerList.classList.add( 'layers-fixed-height' );
				this.layerList.style.height = startListHeight + 'px';
				document.body.classList.add( 'layers-resize-cursor' );
				e.preventDefault();
			} );

			const handleTouchMove = ( e ) => {
				if ( !isDragging ) {
					return;
				}
				const delta = e.touches[ 0 ].clientY - startMouseY;
				const totalHeight = sidebarInner.offsetHeight;
				const dividerHeight = divider.offsetHeight;
				const maxListHeight = totalHeight - dividerHeight - minPropsHeight;
				const newListHeight = Math.max( minListHeight, Math.min( startListHeight + delta, maxListHeight ) );
				this.layerList.style.height = newListHeight + 'px';
			};
			this.addDocumentListener( 'touchmove', handleTouchMove, { passive: false } );

			const handleTouchEnd = () => {
				if ( isDragging ) {
					isDragging = false;
					document.body.classList.remove( 'layers-resize-cursor' );
				}
			};
			this.addDocumentListener( 'touchend', handleTouchEnd );
		}

		/**
		 * Set up event handlers for the panel
		 */
		setupEventHandlers() {
			// Initialize BackgroundLayerController for background layer UI
			const BackgroundLayerController = getClass( 'UI.BackgroundLayerController', 'BackgroundLayerController' );
			if ( BackgroundLayerController && this.layerList ) {
				this.backgroundLayerController = new BackgroundLayerController( {
					editor: this.editor,
					layerList: this.layerList,
					msg: this.msg.bind( this ),
					addTargetListener: this.addTargetListener.bind( this )
				} );
			}

			// Use extracted LayerItemEvents if available
			const LayerItemEvents = getClass( 'UI.LayerItemEvents', 'LayerItemEvents' );
			if ( LayerItemEvents && this.layerList ) {
				this.itemEventsController = new LayerItemEvents( {
					layerList: this.layerList,
					getLayers: this.getLayers.bind( this ),
					getSelectedLayerId: this.getSelectedLayerId.bind( this ),
					callbacks: {
						onSelect: ( layerId ) => this.selectLayer( layerId ),
						onCtrlSelect: ( layerId ) => this.selectLayer( layerId, false, true ),
						onShiftSelect: ( layerId ) => this.selectLayerRange( layerId ),
						onToggleVisibility: ( layerId ) => this.toggleLayerVisibility( layerId ),
						onToggleLock: ( layerId ) => this.toggleLayerLock( layerId ),
						onDelete: ( layerId ) => this.deleteLayer( layerId ),
						onNameClick: ( layerId, nameEl ) => this.handleNameClick( layerId, nameEl ),
						onEditName: ( layerId, nameEl ) => this.editLayerName( layerId, nameEl ),
						onToggleGroupExpand: ( layerId ) => this.toggleGroupExpand( layerId ),
						onMoveLayer: ( layerId, direction ) => this.moveLayer( layerId, direction )
					},
					addTargetListener: this.addTargetListener.bind( this )
				} );
			} else {
				// Fallback: Clicks in the list
				if ( this.layerList ) {
					this.addTargetListener( this.layerList, 'click', ( e ) => {
						this.handleLayerListClick( e );
					} );
					// Double-click to edit layer name (industry standard)
					this.addTargetListener( this.layerList, 'dblclick', ( e ) => {
						this.handleLayerListDblClick( e );
					} );
					// Right-click context menu for layer actions
					this.addTargetListener( this.layerList, 'contextmenu', ( e ) => {
						this.handleLayerContextMenu( e );
					} );
					// Keyboard navigation for accessibility
					this.addTargetListener( this.layerList, 'keydown', ( e ) => {
						this.handleLayerListKeydown( e );
					} );
				}
			}

			// Drag and drop reordering
			this.setupDragAndDrop();
			// Live transform sync from CanvasManager during manipulation
			try {
				const target = ( this.editor && this.editor.container ) || document;
				this.addTargetListener( target, 'layers:transforming', ( e ) => {
					const detail = e && e.detail || {};
					if ( !detail || !detail.id ) {
						return;
					}
					if ( String( detail.id ) !== String( this.getSelectedLayerId() ) ) {
						return;
					}
					this.syncPropertiesFromLayer( detail.layer || detail );
				} );
			} catch ( err ) {
				if ( window.layersErrorHandler ) {
					window.layersErrorHandler.handleError( err, 'LayerPanel.setupPropertiesSync', 'canvas' );
				}
			}
		}

		/**
		 * Update layers (triggers re-render via StateManager)
		 *
		 * @param {Array} layers New layers array
		 */
		updateLayers( layers ) {
			// State is managed by StateManager - just trigger a re-render
			// The actual layers array is stored in editor.stateManager
			if ( layers && this.editor && this.editor.stateManager ) {
				this.editor.stateManager.set( 'layers', layers );
			}
			// renderLayerList will be called by the state subscription
		}

		/**
		 * Alias for updateLayers for backwards compatibility
		 *
		 * @param {Array} layers New layers array
		 */
		updateLayerList( layers ) {
			this.updateLayers( layers );
		}

		/**
		 * Render the layer list
		 */
		renderLayerList() {
			// Use extracted LayerListRenderer if available
			if ( this.layerListRenderer ) {
				this.layerListRenderer.render();
				// Always render background layer item at the bottom
				this.renderBackgroundLayerItem();
				return;
			}

			// Initialize renderer if LayerListRenderer is available
			const LayerListRenderer = getClass( 'UI.LayerListRenderer', 'LayerListRenderer' );
			if ( LayerListRenderer && !this.layerListRenderer ) {
				this.layerListRenderer = new LayerListRenderer( {
					layerList: this.layerList,
					msg: this.msg.bind( this ),
					getSelectedLayerId: this.getSelectedLayerId.bind( this ),
					getSelectedLayerIds: this.getSelectedLayerIds.bind( this ),
					getLayers: this.getVisibleLayers.bind( this ),
					onMoveLayer: this.moveLayer.bind( this ),
					onToggleGroupExpand: this.toggleGroupExpand.bind( this )
				} );
				this.layerListRenderer.render();
				// Always render background layer item at the bottom
				this.renderBackgroundLayerItem();
			}
		}

		/**
		 * Render or update the background layer item at the bottom of the layer list.
		 * The background layer cannot be moved, deleted, or unlocked - it just
		 * provides controls for background visibility and opacity.
		 */
		renderBackgroundLayerItem() {
			// Delegate to BackgroundLayerController
			if ( this.backgroundLayerController ) {
				this.backgroundLayerController.render();
			}
		}

		/**
		 * Get whether the background is visible
		 *
		 * @return {boolean} True if background is visible
		 */
		getBackgroundVisible() {
			// Delegate to controller if available
			if ( this.backgroundLayerController ) {
				return this.backgroundLayerController.getBackgroundVisible();
			}
			// Fallback
			if ( this.editor.stateManager ) {
				const visible = this.editor.stateManager.get( 'backgroundVisible' );
				// Handle both boolean false and integer 0 (from API serialization)
				return visible !== false && visible !== 0;
			}
			return true;
		}

		/**
		 * Get the background opacity value
		 *
		 * @return {number} Opacity value between 0 and 1
		 */
		getBackgroundOpacity() {
			// Delegate to controller if available
			if ( this.backgroundLayerController ) {
				return this.backgroundLayerController.getBackgroundOpacity();
			}
			// Fallback
			if ( this.editor.stateManager ) {
				const opacity = this.editor.stateManager.get( 'backgroundOpacity' );
				return typeof opacity === 'number' ? opacity : 1.0;
			}
			return 1.0;
		}

		/**
		 * Toggle background visibility
		 */
		toggleBackgroundVisibility() {
			// Delegate to controller if available
			if ( this.backgroundLayerController ) {
				this.backgroundLayerController.toggleBackgroundVisibility();
				return;
			}
			// Fallback
			if ( this.editor.stateManager ) {
				const current = this.getBackgroundVisible();
				this.editor.stateManager.set( 'backgroundVisible', !current );
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.redraw();
				}
				this.renderBackgroundLayerItem();
			}
		}

		/**
		 * Set background opacity
		 *
		 * @param {number} opacity Opacity value between 0 and 1
		 */
		setBackgroundOpacity( opacity ) {
			// Delegate to controller if available
			if ( this.backgroundLayerController ) {
				this.backgroundLayerController.setBackgroundOpacity( opacity );
				return;
			}
			// Fallback
			if ( this.editor.stateManager ) {
				this.editor.stateManager.set( 'backgroundOpacity', Math.max( 0, Math.min( 1, opacity ) ) );
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.redraw();
				}
			}
		}

		/**
		 * Move a layer up or down in the list
		 *
		 * @param {string} layerId Layer ID to move
		 * @param {number} direction Direction to move (-1 for up, 1 for down)
		 */
		moveLayer( layerId, direction ) {
			// Delegate to LayerDragDrop controller if available
			if ( this.dragDropController && typeof this.dragDropController.moveLayer === 'function' ) {
				this.dragDropController.moveLayer( layerId, direction, ( id ) => {
					// Restore focus callback
					const newItem = this.layerList.querySelector( '.layer-item[data-layer-id="' + id + '"] .layer-grab-area' );
					if ( newItem ) {
						newItem.focus();
					}
				} );
				return;
			}

			// Fallback: inline implementation
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
		}

		/**
		 * Create a layer item DOM element
		 *
		 * @param {Object} layer Layer object
		 * @param {number} index Layer index
		 * @return {HTMLElement} Layer item element
		 */
		createLayerItem( layer, index ) {
			// Delegate to LayerItemFactory
			if ( this.layerItemFactory ) {
				return this.layerItemFactory.createLayerItem( layer, index );
			}
			// Fallback: create minimal item if factory not available
			const item = document.createElement( 'div' );
			item.className = 'layer-item';
			item.dataset.layerId = layer.id;
			item.dataset.index = index;
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
			// Delegate to LayerItemFactory
			if ( this.layerItemFactory ) {
				this.layerItemFactory.updateLayerItem( item, layer, index );
				return;
			}
			// Fallback: basic update if factory not available
			item.dataset.layerId = layer.id;
			item.dataset.index = index;
		}

		/**
		 * Get the default name for a layer based on its type
		 *
		 * @param {Object} layer Layer object
		 * @return {string} Default layer name
		 */
		getDefaultLayerName( layer ) {
			// Delegate to LayerItemFactory
			if ( this.layerItemFactory ) {
				return this.layerItemFactory.getDefaultLayerName( layer );
			}
			// Fallback
			return layer.type || 'Layer';
		}

		/**
		 * Handle click events in the layer list
		 *
		 * @param {Event} e Click event
		 */
		handleLayerListClick( e ) {
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

			// Check for multi-select modifiers FIRST (industry standard)
			// Ctrl/Cmd + click or Shift + click should select, not edit
			const isCtrlClick = e.ctrlKey || e.metaKey;
			const isShiftClick = e.shiftKey;

			if ( isCtrlClick || isShiftClick ) {
				// Prevent text selection/editing during multi-select
				e.preventDefault();
				if ( isShiftClick ) {
					this.selectLayerRange( layerId );
				} else {
					this.selectLayer( layerId, false, true );
				}
				return;
			}

			// Check for button clicks
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
				// Check if this layer is already selected - if so, enter edit mode
				// Otherwise, just select the layer (industry standard: click to select, click again to edit)
				const selectedIds = this.getSelectedLayerIds();
				const isAlreadySelected = selectedIds.includes( layerId );
				if ( isAlreadySelected && selectedIds.length === 1 ) {
					// Layer is already the only selected layer - enter edit mode
					this.editLayerName( layerId, nameEl );
				} else {
					// Select the layer first
					this.selectLayer( layerId, false, false );
				}
			} else {
				// Click on other areas (grab handle, etc.) - select layer
				this.selectLayer( layerId, false, false );
			}
		}

		/**
		 * Handle click on a layer name - decides whether to select or enter edit mode
		 * Industry standard: first click selects, click on already-selected layer enters edit mode
		 *
		 * @param {string} layerId Layer ID
		 * @param {HTMLElement} nameEl Name element
		 */
		handleNameClick( layerId, nameEl ) {
			const selectedIds = this.getSelectedLayerIds();
			const isAlreadySelected = selectedIds.includes( layerId );

			if ( isAlreadySelected && selectedIds.length === 1 ) {
				// Layer is already the only selected layer - enter edit mode
				this.editLayerName( layerId, nameEl );
			} else {
				// Select the layer first
				this.selectLayer( layerId, false, false );
			}
		}

		/**
		 * Handle double-click on the layer list (for editing layer names)
		 * Industry standard: double-click to edit name, single click to select
		 *
		 * @param {MouseEvent} e Mouse event
		 */
		handleLayerListDblClick( e ) {
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

			// Double-click anywhere on the layer item enables name editing
			const nameEl = layerItem.querySelector( '.layer-name' );
			if ( nameEl ) {
				// First ensure the layer is selected
				this.selectLayer( layerId, false, false );
				// Then enter edit mode
				this.editLayerName( layerId, nameEl );
			}
		}

		/**
		 * Handle right-click context menu on the layer list
		 * Provides quick access to layer actions like Group, Ungroup, etc.
		 *
		 * @param {MouseEvent} e Mouse event
		 */
		handleLayerContextMenu( e ) {
			if ( this.contextMenuController ) {
				this.contextMenuController.handleLayerContextMenu( e );
			}
		}

		/**
		 * Close the active layer context menu if open
		 */
		closeLayerContextMenu() {
			if ( this.contextMenuController ) {
				this.contextMenuController.closeLayerContextMenu();
			}
		}

		/**
		 * Ungroup a group layer, moving its children to the parent level
		 *
		 * @param {string} groupId The ID of the group layer to ungroup
		 */
		ungroupLayer( groupId ) {
			this.folderController.ungroupLayer( groupId );
		}

		/**
		 * Handle keyboard navigation in the layer list
		 *
		 * @param {KeyboardEvent} e Keyboard event
		 */
		handleLayerListKeydown( e ) {
			const target = e.target;
			const layerItem = target.closest( '.layer-item' );

			// Only handle navigation keys when focused on a layer item
			if ( !layerItem ) {
				return;
			}

			const layers = this.getLayers();
			if ( layers.length === 0 ) {
				return;
			}

			const layerId = layerItem.dataset.layerId;
			let currentIndex = -1;
			for ( let i = 0; i < layers.length; i++ ) {
				if ( String( layers[ i ].id ) === String( layerId ) ) {
					currentIndex = i;
					break;
				}
			}

			switch ( e.key ) {
				case 'ArrowUp':
					e.preventDefault();
					if ( currentIndex > 0 ) {
						this.focusLayerAtIndex( currentIndex - 1 );
					}
					break;

				case 'ArrowDown':
					e.preventDefault();
					if ( currentIndex < layers.length - 1 ) {
						this.focusLayerAtIndex( currentIndex + 1 );
					}
					break;

				case 'Home':
					e.preventDefault();
					this.focusLayerAtIndex( 0 );
					break;

				case 'End':
					e.preventDefault();
					this.focusLayerAtIndex( layers.length - 1 );
					break;

				case 'Enter':
				case ' ':
					// Don't intercept if focused on a button or editable element
					if ( target.tagName === 'BUTTON' || target.contentEditable === 'true' ) {
						return;
					}
					e.preventDefault();
					this.selectLayer( layerId );
					break;

				case 'Delete':
				case 'Backspace':
					// Only handle if not focused on an editable element
					if ( target.contentEditable === 'true' ) {
						return;
					}
					e.preventDefault();
					this.deleteLayer( layerId );
					break;

				case 'v':
				case 'V':
					// Toggle visibility with V key
					if ( !e.ctrlKey && !e.metaKey && target.contentEditable !== 'true' ) {
						e.preventDefault();
						this.toggleLayerVisibility( layerId );
					}
					break;

				case 'l':
				case 'L':
					// Toggle lock with L key
					if ( !e.ctrlKey && !e.metaKey && target.contentEditable !== 'true' ) {
						e.preventDefault();
						this.toggleLayerLock( layerId );
					}
					break;
			}
		}

		/**
		 * Focus a layer item by index
		 *
		 * @param {number} index Layer index to focus
		 */
		focusLayerAtIndex( index ) {
			// Delegate to LayerItemEvents controller if available
			if ( this.itemEventsController && typeof this.itemEventsController.focusLayerAtIndex === 'function' ) {
				this.itemEventsController.focusLayerAtIndex( index );
				return;
			}

			// Fallback implementation
			const layers = this.getLayers();
			if ( index < 0 || index >= layers.length ) {
				return;
			}

			const layerId = layers[ index ].id;
			const layerItem = this.layerList.querySelector( '.layer-item[data-layer-id="' + layerId + '"]' );
			if ( layerItem ) {
				// Focus the grab area (which is the focusable element within the layer item)
				const grabArea = layerItem.querySelector( '.layer-grab-area' );
				if ( grabArea ) {
					grabArea.focus();
				}
			}
		}

		/**
		 * Select a layer by ID
		 *
		 * @param {string} layerId Layer ID to select
		 * @param {boolean} [fromCanvas] Whether the selection originated from canvas
		 * @param {boolean} [addToSelection] Whether to add to existing selection (Ctrl+click)
		 */
		selectLayer( layerId, fromCanvas, addToSelection ) {
			// When called from canvas, don't update StateManager - it's already set
			// Just let the state subscription handle the UI update
			if ( fromCanvas ) {
				return;
			}

			// If inline text editing is active, finish it first to capture the current content
			// This prevents text loss when clicking on the layer panel during editing
			const cm = this.editor && this.editor.canvasManager;
			if ( cm && cm.isTextEditing && cm.inlineTextEditor ) {
				cm.inlineTextEditor.finishEditing( true );
			}

			// Update selection through StateManager (single source of truth)
			if ( this.editor && this.editor.stateManager ) {
				if ( addToSelection && layerId ) {
					// Toggle selection: add if not selected, remove if selected
					const currentIds = this.editor.stateManager.get( 'selectedLayerIds' ) || [];
					const idx = currentIds.indexOf( layerId );
					let newIds;
					if ( idx === -1 ) {
						// Add to selection
						newIds = [ ...currentIds, layerId ];
					} else {
						// Remove from selection
						newIds = currentIds.filter( ( id ) => id !== layerId );
					}
					this.editor.stateManager.set( 'selectedLayerIds', newIds );
				} else {
					// Single selection - replace current selection
					this.editor.stateManager.set( 'selectedLayerIds', layerId ? [ layerId ] : [] );
				}
			}
			// Note: renderLayerList and updatePropertiesPanel are called by state subscription
			if ( this.editor.canvasManager ) {
				// Sync full selection to canvas
				const selectedIds = this.editor.stateManager ?
					this.editor.stateManager.get( 'selectedLayerIds' ) || [] : [];
				this.editor.canvasManager.setSelectedLayerIds( selectedIds );

				// Update lastSelectedId for key object alignment
				// When adding to selection, the clicked layer becomes the key object
				// When replacing selection, the selected layer is the key object
				if ( this.editor.canvasManager.selectionManager && layerId ) {
					const isStillSelected = selectedIds.indexOf( layerId ) !== -1;
					if ( isStillSelected ) {
						this.editor.canvasManager.selectionManager.lastSelectedId = layerId;
					} else if ( selectedIds.length > 0 ) {
						// If we deselected the clicked layer, set last selected to the most recent remaining
						this.editor.canvasManager.selectionManager.lastSelectedId = selectedIds[ selectedIds.length - 1 ];
					} else {
						this.editor.canvasManager.selectionManager.lastSelectedId = null;
					}
				}

				this.editor.canvasManager.renderLayers( this.editor.layers );
				this.editor.canvasManager.drawMultiSelectionIndicators();
			}
		}

		/**
		 * Select a range of layers (Shift+click behavior)
		 * Selects all layers between the last selected layer and the clicked layer
		 *
		 * @param {string} layerId Layer ID that was shift-clicked
		 */
		selectLayerRange( layerId ) {
			const layers = this.getLayers();
			if ( layers.length === 0 ) {
				return;
			}

			const currentIds = this.editor.stateManager ?
				this.editor.stateManager.get( 'selectedLayerIds' ) || [] : [];

			// If no current selection, just select the clicked layer
			if ( currentIds.length === 0 ) {
				this.selectLayer( layerId );
				return;
			}

			// Find indices
			const clickedIndex = layers.findIndex( ( l ) => String( l.id ) === String( layerId ) );
			const lastSelectedId = currentIds[ currentIds.length - 1 ];
			const lastSelectedIndex = layers.findIndex( ( l ) => String( l.id ) === String( lastSelectedId ) );

			if ( clickedIndex === -1 || lastSelectedIndex === -1 ) {
				this.selectLayer( layerId );
				return;
			}

			// Select range between last selected and clicked
			const startIndex = Math.min( clickedIndex, lastSelectedIndex );
			const endIndex = Math.max( clickedIndex, lastSelectedIndex );

			const rangeIds = [];
			for ( let i = startIndex; i <= endIndex; i++ ) {
				rangeIds.push( layers[ i ].id );
			}

			if ( this.editor && this.editor.stateManager ) {
				this.editor.stateManager.set( 'selectedLayerIds', rangeIds );
			}

			// Sync to canvas
			if ( this.editor.canvasManager ) {
				this.editor.canvasManager.setSelectedLayerIds( rangeIds );
				this.editor.canvasManager.renderLayers( this.editor.layers );
				this.editor.canvasManager.drawMultiSelectionIndicators();
			}
		}

		/**
		 * Toggle layer visibility
		 *
		 * @param {string} layerId Layer ID to toggle
		 */
		toggleLayerVisibility( layerId ) {
			this.folderController.toggleLayerVisibility( layerId );
		}

		/**
		 * Toggle layer lock
		 *
		 * @param {string} layerId Layer ID to toggle
		 */
		toggleLayerLock( layerId ) {
			const layer = this.editor.getLayerById( layerId );
			if ( layer ) {
				layer.locked = !layer.locked;
				this.renderLayerList();
				this.editor.saveState( layer.locked ? 'Lock Layer' : 'Unlock Layer' );
			}
		}

		/**
		 * Delete a layer
		 *
		 * @param {string} layerId Layer ID to delete
		 */
		deleteLayer( layerId ) {
			this.folderController.deleteLayer( layerId, this.createConfirmDialog.bind( this ) );
		}

		/**
		 * Edit a layer's name
		 *
		 * @param {string} layerId Layer ID to edit
		 * @param {HTMLElement} nameElement Name element to edit
		 */
		editLayerName( layerId, nameElement ) {
			// If already in edit mode, don't re-select all text
			// This allows the user to click within the text to place cursor
			if ( nameElement.contentEditable === 'true' ) {
				return;
			}

			// Enable contentEditable for editing
			nameElement.contentEditable = 'true';
			nameElement.style.cursor = 'text';
			nameElement.focus();

			// Select all text for easy replacement
			const selection = window.getSelection();
			const range = document.createRange();
			range.selectNodeContents( nameElement );
			selection.removeAllRanges();
			selection.addRange( range );

			// Prevent adding duplicate listeners
			if ( nameElement._hasEditListeners ) {
				return;
			}
			nameElement._hasEditListeners = true;

			const originalName = nameElement.textContent;
			const maxLength = 100;

			// Use EventTracker-aware addTargetListener for proper cleanup
			this.addTargetListener( nameElement, 'input', () => {
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
			this.addTargetListener( nameElement, 'blur', () => {
				const newName = nameElement.textContent.trim();
				if ( newName && newName !== originalName ) {
					this.editor.updateLayer( layerId, { name: newName } );
					this.editor.saveState( 'Rename Layer' );
				}
				// Disable contentEditable when done editing
				nameElement.contentEditable = 'false';
				nameElement.style.cursor = 'pointer';
				nameElement._hasEditListeners = false;
			} );
			this.addTargetListener( nameElement, 'keydown', ( e ) => {
				if ( e.key === 'Enter' ) {
					nameElement.blur();
				} else if ( e.key === 'Escape' ) {
					nameElement.textContent = originalName;
					nameElement.blur();
				}
			} );
		}

		/**
		 * Update the properties panel for a selected layer
		 *
		 * @param {string|null} layerId Layer ID to show properties for
		 */
		updatePropertiesPanel( layerId ) {
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
		}

		/**
		 * Create a properties form for a layer
		 *
		 * @param {Object} layer Layer object
		 * @return {HTMLElement} Properties form element
		 */
		createPropertiesForm( layer ) {
			// Use extracted PropertiesForm component if available
			const PropertiesForm = getClass( 'UI.PropertiesForm', 'PropertiesForm' );
			if ( PropertiesForm && typeof PropertiesForm.create === 'function' ) {
				return PropertiesForm.create( layer, this.editor, ( cleanup ) => {
					this.registerDialogCleanup( cleanup );
				} );
			}

			// Fallback: create basic form with minimal fields
			const form = document.createElement( 'form' );
			form.className = 'layer-properties-form';
			const p = document.createElement( 'p' );
			p.textContent = this.msg( 'layers-properties-unavailable', 'Properties form unavailable' );
			form.appendChild( p );
			return form;
		}

		/**
		 * Live sync selected layer's transform props into current form inputs
		 *
		 * @param {Object} layer Layer object with transform properties
		 */
		syncPropertiesFromLayer( layer ) {
			if ( !layer || !this.propertiesPanel ) {
				return;
			}
			const root = this.propertiesPanel.querySelector( '.layer-properties-form' ) || this.propertiesPanel;
			const inputs = root.querySelectorAll( 'input[data-prop]' );
			const formatOne = ( n, decimalsAttr ) => {
				if ( typeof n !== 'number' || isNaN( n ) ) {
					return '';
				}
				if ( String( decimalsAttr ) === '1' ) {
					const r = Math.round( n * 10 ) / 10;
					const isInt = Math.abs( r - Math.round( r ) ) < getIntegerEpsilon();
					return isInt ? String( Math.round( r ) ) : r.toFixed( 1 );
				}
				// Default: round to whole numbers for clean display
				return String( Math.round( n ) );
			};
			inputs.forEach( ( input ) => {
				const prop = input.getAttribute( 'data-prop' );
				if ( !prop ) {
					return;
				}
				if ( document.activeElement === input ) {
					return;
				}
				let val;
				if ( prop === 'width' && ( layer.type === 'ellipse' ) ) {
					val = ( layer.width != null ) ? layer.width : ( ( layer.radiusX || 0 ) * 2 );
				} else if ( prop === 'height' && ( layer.type === 'ellipse' ) ) {
					val = ( layer.height != null ) ? layer.height : ( ( layer.radiusY || 0 ) * 2 );
				} else {
					val = layer[ prop ];
				}
				if ( typeof val === 'number' ) {
					const formatted = formatOne( val, input.getAttribute( 'data-decimals' ) );
					if ( input.value !== formatted ) {
						input.value = formatted;
					}
				}
			} );
		}

		/**
		 * Set up drag and drop for layer reordering
		 */
		setupDragAndDrop() {
			if ( !this.layerList ) {
				return;
			}

			// Use extracted LayerDragDrop component
			const LayerDragDrop = getClass( 'UI.LayerDragDrop', 'LayerDragDrop' );
			if ( LayerDragDrop ) {
				this.dragDropController = new LayerDragDrop( {
					layerList: this.layerList,
					editor: this.editor,
					renderLayerList: this.renderLayerList.bind( this ),
					addTargetListener: this.addTargetListener.bind( this )
				} );
			}
		}

		/**
		 * Reorder layers by moving dragged layer to target position
		 *
		 * @param {string} draggedId Dragged layer ID
		 * @param {string} targetId Target layer ID
		 */
		reorderLayers( draggedId, targetId ) {
			// Delegate to LayerDragDrop controller if available
			if ( this.dragDropController && typeof this.dragDropController.reorderLayers === 'function' ) {
				this.dragDropController.reorderLayers( draggedId, targetId );
			}
		}

		/**
		 * Create and display a confirmation dialog
		 *
		 * @param {string} message Confirmation message
		 * @param {Function} onConfirm Callback when confirmed
		 */
		createConfirmDialog( message, onConfirm ) {
			const t = this.msg.bind( this );

			// Use extracted ConfirmDialog component
			const ConfirmDialog = getClass( 'UI.ConfirmDialog', 'ConfirmDialog' );
			if ( ConfirmDialog ) {
				ConfirmDialog.show( {
					message: message,
					onConfirm: onConfirm,
					strings: {
						title: t( 'layers-confirm-title', 'Confirmation' ),
						cancel: t( 'layers-cancel', 'Cancel' ),
						confirm: t( 'layers-confirm', 'Confirm' )
					},
					registerCleanup: ( cleanup ) => {
						this.registerDialogCleanup( cleanup );
					}
				} );
			}
		}

		/**
		 * Simple confirmation dialog fallback
		 *
		 * @param {string} message The confirmation message
		 * @return {boolean} User's choice
		 */
		simpleConfirm( message ) {
			// Use extracted ConfirmDialog static method if available
			const ConfirmDialog = getClass( 'UI.ConfirmDialog', 'ConfirmDialog' );
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
		}

		/**
		 * Pure renderer for Wikitext code so LayersEditor can embed it in the footer
		 *
		 * @param {Array} [layers] Layer array (defaults to current layers)
		 * @return {string} HTML string for the code snippet
		 */
		renderCodeSnippet( layers ) {
			const t = this.msg.bind( this );
			const list = Array.isArray( layers ) ? layers : this.getLayers();
			const visibleLayers = list.filter( ( layer ) => layer.visible !== false );
			const filename = this.editor && this.editor.filename ? this.editor.filename : 'YourImage.jpg';
			let codeHtml = '';
			if ( visibleLayers.length === 0 ) {
				codeHtml = '<p><strong>' + t( 'layers-code-none', 'No layers visible.' ) + '</strong> ' +
					t( 'layers-code-enable', 'Enable layers to see the code.' ) + '</p>';
			} else if ( visibleLayers.length === list.length ) {
				codeHtml = '<p><strong>' + t( 'layers-code-all-visible', 'All layers visible:' ) + '</strong></p>' +
					'<code class="layers-code">[[File:' + filename + '|500px|layers=all|' +
					t( 'layers-code-caption', 'Your caption' ) + ']]</code>' +
					'<button class="copy-btn" data-code="layers=all">' + t( 'layers-code-copy', 'Copy' ) + '</button>';
			} else {
				const layerIds = visibleLayers.map( ( layer ) =>
					layer.id || ( 'layer_' + Math.random().toString( 36 ).slice( 2, 6 ) )
				);
				const layersParam = layerIds.join( ',' );
				codeHtml = '<p><strong>' + t( 'layers-code-selected-visible', 'Selected layers visible:' ) + '</strong></p>' +
					'<code class="layers-code">[[File:' + filename + '|500px|layers=' + layersParam + '|' +
					t( 'layers-code-caption', 'Your caption' ) + ']]</code>' +
					'<button class="copy-btn" data-code="layers=' + layersParam + '">' + t( 'layers-code-copy', 'Copy' ) + '</button>';
			}
			return codeHtml;
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.LayerPanel = LayerPanel;
	}
}());
