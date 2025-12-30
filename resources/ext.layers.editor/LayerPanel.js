/**
 * Layer Panel for Layers Editor
 * Manages the layer list, visibility, ordering, and layer properties
 */
( function () {
	'use strict';

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

			// Initialize EventTracker for memory-safe event listener management
			const EventTracker = getClass( 'Utils.EventTracker', 'EventTracker' );
			this.eventTracker = EventTracker ? new EventTracker() : null;

			// Initialize LayerItemFactory for layer item creation
			this.initLayerItemFactory();

			// Initialize BackgroundLayerController (will be fully configured after createInterface)
			this.backgroundLayerController = null;

			this.createInterface();
			this.setupEventHandlers();
			this.subscribeToState();
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

			// Debug: log layers state
			if ( typeof console !== 'undefined' && console.log ) {
				const groupsAndChildren = allLayers.filter( ( l ) => l.type === 'group' || l.parentGroup );
				if ( groupsAndChildren.length > 0 ) {
					console.log( '[LayerPanel] getVisibleLayers - groups and children:', groupsAndChildren.map( ( l ) => ( {
						id: l.id,
						type: l.type,
						name: l.name,
						parentGroup: l.parentGroup,
						children: l.children
					} ) ) );
				}
			}

			// Build a map of collapsed groups
			const collapsedGroupIds = new Set();
			for ( const layer of allLayers ) {
				if ( layer.type === 'group' && layer.expanded === false ) {
					collapsedGroupIds.add( layer.id );
				}
			}

			// If no collapsed groups, return all layers
			if ( collapsedGroupIds.size === 0 ) {
				return allLayers;
			}

			// Filter out layers whose parent (or any ancestor) is collapsed
			return allLayers.filter( ( layer ) => {
				// Check if any ancestor group is collapsed
				let parentId = layer.parentGroup;
				while ( parentId ) {
					if ( collapsedGroupIds.has( parentId ) ) {
						return false; // Hide this layer - its parent is collapsed
					}
					// Find the parent layer to check its parent
					const parent = allLayers.find( ( l ) => l.id === parentId );
					parentId = parent ? parent.parentGroup : null;
				}
				return true; // No collapsed ancestor, show this layer
			} );
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
		 * This is the UI action for the "Create Folder" button
		 */
		createFolder() {
			const selectedIds = this.getSelectedLayerIds();

			// Use GroupManager if available
			if ( this.editor && this.editor.groupManager ) {
				// createFolder() can create empty folders or include selected layers
				const createdFolder = this.editor.groupManager.createFolder( selectedIds );
				if ( createdFolder ) {
					// Select the new folder
					if ( this.editor.stateManager ) {
						this.editor.stateManager.set( 'selectedLayerIds', [ createdFolder.id ] );
					}
					// Notify success
					if ( typeof mw !== 'undefined' && mw.notify ) {
						const msg = selectedIds.length > 0 ?
							this.msg( 'layers-folder-created-with-layers', 'Folder created with ' + selectedIds.length + ' layer(s)' ) :
							this.msg( 'layers-folder-created', 'Folder created' );
						mw.notify( msg, { type: 'success', tag: 'layers-folder' } );
					}
					// Refresh the layer list
					this.renderLayerList();
				} else {
					// Folder creation failed
					if ( typeof mw !== 'undefined' && mw.notify ) {
						mw.notify(
							this.msg( 'layers-folder-failed', 'Failed to create folder' ),
							{ type: 'error', tag: 'layers-folder' }
						);
					}
				}
			} else {
				// Fallback: notify that folders are not available
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify(
						this.msg( 'layers-folder-unavailable', 'Folders are not available' ),
						{ type: 'error', tag: 'layers-folder' }
					);
				}
			}
		}

		/**
		 * @deprecated Use createFolder() instead
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

			// Subscribe to layers changes
			const unsubLayers = this.editor.stateManager.subscribe( 'layers', () => {
				this.renderLayerList();
				this.updateCodePanel();
			} );
			this.stateSubscriptions.push( unsubLayers );

			// Subscribe to selection changes
			const unsubSelection = this.editor.stateManager.subscribe( 'selectedLayerIds', ( newIds ) => {
				const selectedId = newIds && newIds.length > 0 ? newIds[ newIds.length - 1 ] : null;
				this.renderLayerList();
				this.updatePropertiesPanel( selectedId );
			} );
			this.stateSubscriptions.push( unsubSelection );
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
		 * No-op kept for backward compatibility
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

			// Title row with actions
			const titleRow = document.createElement( 'div' );
			titleRow.className = 'layers-panel-title-row';
			titleRow.style.display = 'flex';
			titleRow.style.alignItems = 'center';
			titleRow.style.justifyContent = 'space-between';

			// Left side: folder button + title
			const titleLeft = document.createElement( 'div' );
			titleLeft.style.display = 'flex';
			titleLeft.style.alignItems = 'center';
			titleLeft.style.gap = '6px';

			// Create Folder button (placed before title)
			const createGroupBtn = document.createElement( 'button' );
			createGroupBtn.className = 'layers-btn layers-btn-icon layers-create-group-btn';
			createGroupBtn.type = 'button';
			createGroupBtn.title = this.msg( 'layers-add-folder', 'Add folder' );
			createGroupBtn.setAttribute( 'aria-label', this.msg( 'layers-add-folder', 'Add folder' ) );

			// Folder icon with plus badge for create folder
			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
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
			titleLeft.appendChild( createGroupBtn );

			const title = document.createElement( 'h3' );
			title.className = 'layers-panel-title';
			title.textContent = this.msg( 'layers-panel-title', 'Layers' );
			titleLeft.appendChild( title );

			titleRow.appendChild( titleLeft );
			header.appendChild( titleRow );

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
						onEditName: ( layerId, nameEl ) => this.editLayerName( layerId, nameEl )
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
				return;
			}

			// Fallback: inline implementation
			const layers = this.getVisibleLayers();
			const listContainer = this.layerList;

			// Map existing DOM items by ID (exclude background layer item)
			const existingItems = {};
			const domItems = listContainer.querySelectorAll( '.layer-item:not(.background-layer-item)' );
			for ( let i = 0; i < domItems.length; i++ ) {
				existingItems[ domItems[ i ].dataset.layerId ] = domItems[ i ];
			}

			if ( layers.length === 0 ) {
				// Handle empty state - preserve background layer item
				const bgItem = listContainer.querySelector( '.background-layer-item' );
				while ( listContainer.firstChild ) {
					listContainer.removeChild( listContainer.firstChild );
				}
				const empty = document.createElement( 'div' );
				empty.className = 'layers-empty';
				empty.textContent = this.msg( 'layers-empty', 'No layers yet. Choose a tool to begin.' );
				listContainer.appendChild( empty );
				// Re-add background layer item if it existed, or create it
				if ( bgItem ) {
					listContainer.appendChild( bgItem );
				} else {
					this.renderBackgroundLayerItem();
				}
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

			// Ensure background layer item is rendered at the bottom
			this.renderBackgroundLayerItem();
		}

		/**
		 * Render or update the background layer item at the bottom of the layer list.
		 * The background layer cannot be moved, deleted, or unlocked - it just
		 * provides controls for background visibility and opacity.
		 */
		renderBackgroundLayerItem() {
			// Delegate to BackgroundLayerController if available
			if ( this.backgroundLayerController ) {
				this.backgroundLayerController.render();
				return;
			}

			// Fallback: inline implementation (kept for backwards compatibility)
			const listContainer = this.layerList;
			let bgItem = listContainer.querySelector( '.background-layer-item' );

			if ( !bgItem ) {
				bgItem = this.createBackgroundLayerItem();
				listContainer.appendChild( bgItem );
			} else {
				this.updateBackgroundLayerItem( bgItem );
			}
		}

		/**
		 * Create the background layer item DOM element
		 *
		 * @return {HTMLElement} Background layer item element
		 */
		createBackgroundLayerItem() {
			const t = this.msg.bind( this );
			const item = document.createElement( 'div' );
			item.className = 'layer-item background-layer-item';
			item.dataset.layerId = '__background__';

			// ARIA attributes
			item.setAttribute( 'role', 'option' );
			item.setAttribute( 'aria-selected', 'false' );
			item.setAttribute( 'aria-label', t( 'layers-background-layer', 'Background Image' ) );

			// Background icon (image icon)
			const iconArea = document.createElement( 'div' );
			iconArea.className = 'layer-background-icon';
			iconArea.style.cssText = 'width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;';
			const iconSvg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			iconSvg.setAttribute( 'width', '20' );
			iconSvg.setAttribute( 'height', '20' );
			iconSvg.setAttribute( 'viewBox', '0 0 24 24' );
			iconSvg.setAttribute( 'fill', 'none' );
			iconSvg.setAttribute( 'stroke', '#666' );
			iconSvg.setAttribute( 'stroke-width', '2' );
			iconSvg.setAttribute( 'aria-hidden', 'true' );
			// Image icon path (landscape with mountains)
			const path = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
			path.setAttribute( 'd', 'M3 5h18v14H3V5zm0 14l5-6 3 4 4-5 6 7' );
			path.setAttribute( 'stroke-linecap', 'round' );
			path.setAttribute( 'stroke-linejoin', 'round' );
			iconSvg.appendChild( path );
			// Sun circle
			const circle = document.createElementNS( 'http://www.w3.org/2000/svg', 'circle' );
			circle.setAttribute( 'cx', '16' );
			circle.setAttribute( 'cy', '9' );
			circle.setAttribute( 'r', '2' );
			iconSvg.appendChild( circle );
			iconArea.appendChild( iconSvg );

			// Visibility toggle
			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
			const visibilityBtn = document.createElement( 'button' );
			visibilityBtn.className = 'layer-visibility background-visibility';
			visibilityBtn.type = 'button';
			const bgVisible = this.getBackgroundVisible();
			if ( IconFactory ) {
				visibilityBtn.appendChild( IconFactory.createEyeIcon( bgVisible ) );
			}
			visibilityBtn.title = t( 'layers-toggle-visibility', 'Toggle visibility' );
			visibilityBtn.setAttribute( 'aria-label', t( 'layers-background-visibility', 'Toggle background visibility' ) );
			visibilityBtn.setAttribute( 'aria-pressed', bgVisible ? 'true' : 'false' );

			this.addTargetListener( visibilityBtn, 'click', ( e ) => {
				e.stopPropagation();
				this.toggleBackgroundVisibility();
			} );

			// Name label
			const name = document.createElement( 'span' );
			name.className = 'layer-name background-name';
			name.textContent = t( 'layers-background-layer', 'Background Image' );
			// Not editable for background
			name.contentEditable = false;
			name.style.cursor = 'default';

			// Opacity slider container
			const opacityContainer = document.createElement( 'div' );
			opacityContainer.className = 'background-opacity-container';
			opacityContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-left: auto;';

			const opacityLabel = document.createElement( 'span' );
			opacityLabel.className = 'background-opacity-label';
			opacityLabel.style.cssText = 'font-size: 11px; color: #666; min-width: 32px; text-align: right;';
			const currentOpacity = this.getBackgroundOpacity();
			opacityLabel.textContent = Math.round( currentOpacity * 100 ) + '%';

			const opacitySlider = document.createElement( 'input' );
			opacitySlider.type = 'range';
			opacitySlider.className = 'background-opacity-slider';
			opacitySlider.min = '0';
			opacitySlider.max = '100';
			opacitySlider.value = String( Math.round( currentOpacity * 100 ) );
			opacitySlider.title = t( 'layers-background-opacity', 'Background Opacity' );
			opacitySlider.setAttribute( 'aria-label', t( 'layers-background-opacity', 'Background Opacity' ) );
			opacitySlider.style.cssText = 'width: 60px; cursor: pointer;';

			this.addTargetListener( opacitySlider, 'input', ( e ) => {
				const value = parseInt( e.target.value, 10 ) / 100;
				opacityLabel.textContent = Math.round( value * 100 ) + '%';
				this.setBackgroundOpacity( value );
			} );

			opacityContainer.appendChild( opacitySlider );
			opacityContainer.appendChild( opacityLabel );

			// Lock icon (always locked, not interactive)
			const lockIcon = document.createElement( 'div' );
			lockIcon.className = 'layer-lock background-lock';
			lockIcon.style.cssText = 'width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; opacity: 0.5;';
			lockIcon.title = t( 'layers-background-locked', 'Background is always locked' );
			if ( IconFactory ) {
				lockIcon.appendChild( IconFactory.createLockIcon( true ) );
			}

			item.appendChild( iconArea );
			item.appendChild( visibilityBtn );
			item.appendChild( name );
			item.appendChild( opacityContainer );
			item.appendChild( lockIcon );

			return item;
		}

		/**
		 * Update the background layer item to reflect current state
		 *
		 * @param {HTMLElement} [item] The background layer item element (optional - will be found if not provided)
		 */
		updateBackgroundLayerItem( item ) {
			// If no item provided, find it
			if ( !item && this.layerList ) {
				item = this.layerList.querySelector( '.background-layer-item' );
			}

			// If still no item, nothing to update
			if ( !item ) {
				return;
			}

			const IconFactory = getClass( 'UI.IconFactory', 'IconFactory' );
			const bgVisible = this.getBackgroundVisible();
			const bgOpacity = this.getBackgroundOpacity();

			// Update visibility icon
			const visibilityBtn = item.querySelector( '.background-visibility' );
			if ( visibilityBtn && IconFactory ) {
				while ( visibilityBtn.firstChild ) {
					visibilityBtn.removeChild( visibilityBtn.firstChild );
				}
				visibilityBtn.appendChild( IconFactory.createEyeIcon( bgVisible ) );
				visibilityBtn.setAttribute( 'aria-pressed', bgVisible ? 'true' : 'false' );
			}

			// Update opacity slider and label
			const opacitySlider = item.querySelector( '.background-opacity-slider' );
			const opacityLabel = item.querySelector( '.background-opacity-label' );
			if ( opacitySlider && document.activeElement !== opacitySlider ) {
				opacitySlider.value = String( Math.round( bgOpacity * 100 ) );
			}
			if ( opacityLabel ) {
				opacityLabel.textContent = Math.round( bgOpacity * 100 ) + '%';
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
			e.preventDefault();

			const target = e.target;
			const layerItem = target.closest( '.layer-item' );

			// Get current selection
			const selectedIds = this.getSelectedLayerIds();

			// Close any existing context menu
			this.closeLayerContextMenu();

			// Create context menu
			const menu = document.createElement( 'div' );
			menu.className = 'layers-context-menu';
			menu.setAttribute( 'role', 'menu' );
			menu.style.position = 'fixed';
			menu.style.left = e.clientX + 'px';
			menu.style.top = e.clientY + 'px';
			menu.style.zIndex = '10000';
			menu.style.backgroundColor = '#fff';
			menu.style.border = '1px solid #ccc';
			menu.style.borderRadius = '4px';
			menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
			menu.style.padding = '4px 0';
			menu.style.minWidth = '160px';

			const addMenuItem = ( label, icon, callback, disabled ) => {
				const item = document.createElement( 'button' );
				item.className = 'layers-context-menu-item';
				item.type = 'button';
				item.setAttribute( 'role', 'menuitem' );
				item.style.display = 'flex';
				item.style.alignItems = 'center';
				item.style.width = '100%';
				item.style.padding = '8px 12px';
				item.style.border = 'none';
				item.style.background = 'none';
				item.style.cursor = disabled ? 'default' : 'pointer';
				item.style.textAlign = 'left';
				item.style.fontSize = '13px';
				item.style.color = disabled ? '#999' : '#333';
				item.style.gap = '8px';
				if ( !disabled ) {
					item.addEventListener( 'mouseenter', () => {
						item.style.backgroundColor = '#f0f0f0';
					} );
					item.addEventListener( 'mouseleave', () => {
						item.style.backgroundColor = 'transparent';
					} );
				}
				if ( icon ) {
					const iconSpan = document.createElement( 'span' );
					iconSpan.textContent = icon;
					iconSpan.style.width = '16px';
					item.appendChild( iconSpan );
				}
				const labelSpan = document.createElement( 'span' );
				labelSpan.textContent = label;
				item.appendChild( labelSpan );
				if ( disabled ) {
					item.disabled = true;
				} else {
					item.addEventListener( 'click', () => {
						this.closeLayerContextMenu();
						callback();
					} );
				}
				menu.appendChild( item );
			};

			const addSeparator = () => {
				const sep = document.createElement( 'div' );
				sep.style.height = '1px';
				sep.style.backgroundColor = '#e0e0e0';
				sep.style.margin = '4px 0';
				menu.appendChild( sep );
			};

			// Determine context based on selection
			const hasMultipleSelected = selectedIds.length >= 2;
			const hasSingleSelected = selectedIds.length === 1;
			const clickedLayerId = layerItem ? layerItem.dataset.layerId : null;
			const clickedLayer = clickedLayerId ? this.editor.getLayerById( clickedLayerId ) : null;
			const isGroup = clickedLayer && clickedLayer.type === 'group';

			// If clicked on a layer not in selection, select it first
			if ( clickedLayerId && !selectedIds.includes( clickedLayerId ) ) {
				this.selectLayer( clickedLayerId, false, false );
			}

			// Group option (requires 2+ layers selected)
			addMenuItem(
				this.msg( 'layers-context-group', 'Group (Ctrl+G)' ),
				'📁',
				() => this.createGroupFromSelection(),
				!hasMultipleSelected
			);

			// Ungroup option (only for group layers)
			addMenuItem(
				this.msg( 'layers-context-ungroup', 'Ungroup (Ctrl+Shift+G)' ),
				'📂',
				() => this.ungroupLayer( clickedLayerId ),
				!isGroup
			);

			addSeparator();

			// Standard layer operations
			addMenuItem(
				this.msg( 'layers-context-rename', 'Rename' ),
				'✏️',
				() => {
					if ( layerItem ) {
						const nameEl = layerItem.querySelector( '.layer-name' );
						if ( nameEl ) {
							this.editLayerName( clickedLayerId, nameEl );
							nameEl.focus();
						}
					}
				},
				!hasSingleSelected && !clickedLayerId
			);

			addMenuItem(
				this.msg( 'layers-context-duplicate', 'Duplicate' ),
				'📋',
				() => {
					if ( this.editor && this.editor.duplicateSelected ) {
						this.editor.duplicateSelected();
					}
				},
				selectedIds.length === 0
			);

			addMenuItem(
				this.msg( 'layers-context-delete', 'Delete' ),
				'🗑️',
				() => {
					if ( clickedLayerId ) {
						this.deleteLayer( clickedLayerId );
					}
				},
				selectedIds.length === 0 && !clickedLayerId
			);

			document.body.appendChild( menu );
			this.activeContextMenu = menu;

			// Close menu when clicking outside
			const closeHandler = ( evt ) => {
				if ( !menu.contains( evt.target ) ) {
					this.closeLayerContextMenu();
					document.removeEventListener( 'click', closeHandler );
				}
			};
			setTimeout( () => {
				document.addEventListener( 'click', closeHandler );
			}, 0 );

			// Close on Escape
			const escHandler = ( evt ) => {
				if ( evt.key === 'Escape' ) {
					this.closeLayerContextMenu();
					document.removeEventListener( 'keydown', escHandler );
				}
			};
			document.addEventListener( 'keydown', escHandler );
		}

		/**
		 * Close the active layer context menu if open
		 */
		closeLayerContextMenu() {
			if ( this.activeContextMenu && this.activeContextMenu.parentNode ) {
				this.activeContextMenu.parentNode.removeChild( this.activeContextMenu );
			}
			this.activeContextMenu = null;
		}

		/**
		 * Ungroup a group layer, moving its children to the parent level
		 *
		 * @param {string} groupId The ID of the group layer to ungroup
		 */
		ungroupLayer( groupId ) {
			if ( !groupId ) {
				return;
			}

			// Use GroupManager if available
			if ( this.editor && this.editor.groupManager ) {
				const result = this.editor.groupManager.ungroup( groupId );
				if ( result && result.success ) {
					if ( typeof mw !== 'undefined' && mw.notify ) {
						mw.notify(
							this.msg( 'layers-ungrouped', 'Group removed' ),
							{ type: 'success', tag: 'layers-group' }
						);
					}
					this.renderLayerList();
				} else if ( result && result.error ) {
					if ( typeof mw !== 'undefined' && mw.notify ) {
						mw.notify( result.error, { type: 'error', tag: 'layers-group' } );
					}
				}
			}
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
			const layer = this.editor.getLayerById( layerId );
			if ( layer ) {
				const newVisibility = !( layer.visible !== false );
				layer.visible = newVisibility;

				// If this is a group, cascade visibility to all children
				if ( layer.type === 'group' && Array.isArray( layer.children ) ) {
					this._setChildrenVisibility( layer.children, newVisibility );
				}

				if ( this.editor.canvasManager ) {
					const layers = this.editor.stateManager ? this.editor.stateManager.get( 'layers' ) || [] : [];
					this.editor.canvasManager.renderLayers( layers );
				}
				this.renderLayerList();
				this.updateCodePanel();
				this.editor.saveState( layer.visible ? 'Show Layer' : 'Hide Layer' );
			}
		}

		/**
		 * Recursively set visibility on child layer IDs
		 *
		 * @param {Array} childIds Array of child layer IDs
		 * @param {boolean} visible Visibility state to set
		 * @private
		 */
		_setChildrenVisibility( childIds, visible ) {
			for ( const childId of childIds ) {
				const child = this.editor.getLayerById( childId );
				if ( child ) {
					child.visible = visible;
					// Recurse if child is also a group
					if ( child.type === 'group' && Array.isArray( child.children ) ) {
						this._setChildrenVisibility( child.children, visible );
					}
				}
			}
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
			const t = this.msg.bind( this );
			const layer = this.editor.getLayerById( layerId );

			if ( !layer ) {
				return;
			}

			// Check if this is a folder with children
			const isGroupWithChildren = layer.type === 'group' &&
				Array.isArray( layer.children ) && layer.children.length > 0;

			if ( isGroupWithChildren ) {
				// Show folder-specific dialog with options
				this._showFolderDeleteDialog( layerId, layer );
			} else {
				// Standard delete confirmation
				const confirmMessage = t( 'layers-delete-confirm', 'Are you sure you want to delete this layer?' );
				this.createConfirmDialog( confirmMessage, () => {
					this._performLayerDelete( layerId );
					this.editor.saveState( layer.type === 'group' ? 'Delete Folder' : 'Delete Layer' );
				} );
			}
		}

		/**
		 * Show delete dialog for a folder with options
		 *
		 * @param {string} folderId Folder layer ID
		 * @param {Object} folder Folder layer object
		 * @private
		 */
		_showFolderDeleteDialog( folderId, folder ) {
			const t = this.msg.bind( this );
			const childCount = folder.children.length;

			// Create custom dialog with two options
			const overlay = document.createElement( 'div' );
			overlay.className = 'layers-modal-overlay';
			overlay.setAttribute( 'role', 'presentation' );

			const dialog = document.createElement( 'div' );
			dialog.className = 'layers-modal-dialog';
			dialog.setAttribute( 'role', 'alertdialog' );
			dialog.setAttribute( 'aria-modal', 'true' );
			dialog.setAttribute( 'aria-label', t( 'layers-delete-folder-title', 'Delete Folder' ) );

			const title = document.createElement( 'h3' );
			title.textContent = t( 'layers-delete-folder-title', 'Delete Folder' );
			title.style.margin = '0 0 12px 0';
			dialog.appendChild( title );

			const text = document.createElement( 'p' );
			text.textContent = t(
				'layers-delete-folder-message',
				'This folder contains ' + childCount + ' layer(s). What would you like to do?'
			).replace( '$1', childCount );
			dialog.appendChild( text );

			const buttons = document.createElement( 'div' );
			buttons.className = 'layers-modal-buttons';
			buttons.style.flexDirection = 'column';
			buttons.style.gap = '8px';

			// Option 1: Delete folder only (keep children)
			const keepChildrenBtn = document.createElement( 'button' );
			keepChildrenBtn.textContent = t( 'layers-delete-folder-keep-children', 'Delete folder only (keep layers)' );
			keepChildrenBtn.className = 'layers-btn layers-btn-secondary';
			keepChildrenBtn.style.width = '100%';

			// Option 2: Delete folder and all contents
			const deleteAllBtn = document.createElement( 'button' );
			deleteAllBtn.textContent = t( 'layers-delete-folder-delete-all', 'Delete folder and all layers inside' );
			deleteAllBtn.className = 'layers-btn layers-btn-danger';
			deleteAllBtn.style.width = '100%';

			// Cancel button
			const cancelBtn = document.createElement( 'button' );
			cancelBtn.textContent = t( 'layers-cancel', 'Cancel' );
			cancelBtn.className = 'layers-btn';
			cancelBtn.style.width = '100%';

			buttons.appendChild( keepChildrenBtn );
			buttons.appendChild( deleteAllBtn );
			buttons.appendChild( cancelBtn );
			dialog.appendChild( buttons );

			document.body.appendChild( overlay );
			document.body.appendChild( dialog );

			const cleanup = () => {
				if ( overlay.parentNode ) {
					overlay.parentNode.removeChild( overlay );
				}
				if ( dialog.parentNode ) {
					dialog.parentNode.removeChild( dialog );
				}
			};

			this.registerDialogCleanup( cleanup );

			// Handle option 1: Delete folder only, unparent children
			keepChildrenBtn.addEventListener( 'click', () => {
				cleanup();
				this._deleteFolderKeepChildren( folderId, folder );
			} );

			// Handle option 2: Delete folder and all contents
			deleteAllBtn.addEventListener( 'click', () => {
				cleanup();
				this._deleteFolderAndContents( folderId, folder );
			} );

			cancelBtn.addEventListener( 'click', cleanup );
			overlay.addEventListener( 'click', cleanup );

			// Focus the cancel button for accessibility
			cancelBtn.focus();
		}

		/**
		 * Delete a folder but keep its children (unparent them)
		 *
		 * @param {string} folderId Folder layer ID
		 * @param {Object} folder Folder layer object
		 * @private
		 */
		_deleteFolderKeepChildren( folderId, folder ) {
			// Start batch mode so all operations are one undo step
			if ( this.editor.historyManager ) {
				this.editor.historyManager.startBatch( 'Delete Folder (Keep Layers)' );
			}

			// Unparent all children
			for ( const childId of folder.children ) {
				const child = this.editor.getLayerById( childId );
				if ( child ) {
					delete child.parentGroup;
				}
			}

			// Now delete the folder itself
			this._performLayerDelete( folderId );

			// End batch mode - saves as single history entry
			if ( this.editor.historyManager ) {
				this.editor.historyManager.endBatch();
			}
		}

		/**
		 * Delete a folder and all its contents recursively
		 *
		 * @param {string} folderId Folder layer ID
		 * @param {Object} folder Folder layer object
		 * @private
		 */
		_deleteFolderAndContents( folderId, folder ) {
			// Start batch mode so all operations are one undo step
			if ( this.editor.historyManager ) {
				this.editor.historyManager.startBatch( 'Delete Folder and Contents' );
			}

			// Delete children first (recursively handles nested folders)
			this._deleteChildrenRecursively( folder.children );

			// Now delete the folder itself
			this._performLayerDelete( folderId );

			// End batch mode - saves as single history entry
			if ( this.editor.historyManager ) {
				this.editor.historyManager.endBatch();
			}
		}

		/**
		 * Recursively delete child layers
		 *
		 * @param {Array} childIds Array of child layer IDs
		 * @private
		 */
		_deleteChildrenRecursively( childIds ) {
			for ( const childId of childIds ) {
				const child = this.editor.getLayerById( childId );
				if ( child ) {
					// If child is also a group, delete its children first
					if ( child.type === 'group' && Array.isArray( child.children ) ) {
						this._deleteChildrenRecursively( child.children );
					}
					this.editor.removeLayer( childId );
				}
			}
		}

		/**
		 * Perform the actual layer deletion
		 *
		 * @param {string} layerId Layer ID to delete
		 * @private
		 */
		_performLayerDelete( layerId ) {
			this.editor.removeLayer( layerId );
			this.renderLayerList();
			this.updateCodePanel();
			if ( this.getSelectedLayerId() === layerId ) {
				// Clear selection through StateManager
				if ( this.editor && this.editor.stateManager ) {
					this.editor.stateManager.set( 'selectedLayerIds', [] );
				}
				this.updatePropertiesPanel( null );
			}
		}

		/**
		 * Edit a layer's name
		 *
		 * @param {string} layerId Layer ID to edit
		 * @param {HTMLElement} nameElement Name element to edit
		 */
		editLayerName( layerId, nameElement ) {
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
					const isInt = Math.abs( r - Math.round( r ) ) < 1e-9;
					return isInt ? String( Math.round( r ) ) : r.toFixed( 1 );
				}
				return String( n );
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

			// Use extracted LayerDragDrop component if available
			const LayerDragDrop = getClass( 'UI.LayerDragDrop', 'LayerDragDrop' );
			if ( LayerDragDrop ) {
				this.dragDropController = new LayerDragDrop( {
					layerList: this.layerList,
					editor: this.editor,
					renderLayerList: this.renderLayerList.bind( this ),
					addTargetListener: this.addTargetListener.bind( this )
				} );
				return;
			}

			// Fallback: inline implementation
			this.addTargetListener( this.layerList, 'dragstart', ( e ) => {
				const li = e.target.closest( '.layer-item' );
				if ( li ) {
					e.dataTransfer.setData( 'text/plain', li.dataset.layerId );
					li.classList.add( 'dragging' );
				}
			} );
			this.addTargetListener( this.layerList, 'dragend', ( e ) => {
				const li = e.target.closest( '.layer-item' );
				if ( li ) {
					li.classList.remove( 'dragging' );
				}
			} );
			this.addTargetListener( this.layerList, 'dragover', ( e ) => {
				e.preventDefault();
			} );
			this.addTargetListener( this.layerList, 'drop', ( e ) => {
				e.preventDefault();
				const draggedId = e.dataTransfer.getData( 'text/plain' );
				const targetItem = e.target.closest( '.layer-item' );
				if ( targetItem && draggedId && draggedId !== targetItem.dataset.layerId ) {
					this.reorderLayers( draggedId, targetItem.dataset.layerId );
				}
			} );
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
				return;
			}

			// Fallback: Use StateManager's reorderLayer method if available
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

			// Legacy fallback (when StateManager doesn't have reorderLayer)
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
		}

		/**
		 * Create and display a confirmation dialog
		 *
		 * @param {string} message Confirmation message
		 * @param {Function} onConfirm Callback when confirmed
		 */
		createConfirmDialog( message, onConfirm ) {
			const t = this.msg.bind( this );

			// Use extracted ConfirmDialog component if available
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

			const cleanup = () => {
				if ( overlay.parentNode ) {
					overlay.parentNode.removeChild( overlay );
				}
				if ( dialog.parentNode ) {
					dialog.parentNode.removeChild( dialog );
				}
				document.removeEventListener( 'keydown', handleKey );
			};

			const handleKey = ( e ) => {
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
			confirmBtn.addEventListener( 'click', () => {
				cleanup();
				onConfirm();
			} );

			confirmBtn.focus();
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
