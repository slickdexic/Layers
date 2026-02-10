/**
 * GroupManager - Manages layer grouping operations for the Layers editor
 *
 * Provides functionality for:
 * - Creating and deleting groups
 * - Adding/removing layers from groups
 * - Expanding/collapsing groups
 * - Getting group children and calculating group bounds
 * - Keyboard shortcuts (Ctrl+G to group, Ctrl+Shift+G to ungroup)
 *
 * @module GroupManager
 */
( function () {
	'use strict';

	// Resolve GroupHierarchyHelper dependency
	let GroupHierarchyHelper;
	if ( typeof mw !== 'undefined' && mw.ext && mw.ext.layers ) {
		GroupHierarchyHelper = mw.ext.layers.GroupHierarchyHelper;
	} else if ( typeof require !== 'undefined' ) {
		GroupHierarchyHelper = require( './GroupHierarchyHelper.js' );
	}

	/**
	 * GroupManager class
	 *
	 * @class
	 */
	class GroupManager {
		/**
		 * Create a new GroupManager instance
		 *
		 * @param {Object} config Configuration object
		 * @param {Object} config.editor Reference to LayersEditor instance
		 */
		constructor( config ) {
			this.editor = config.editor;
			// Dependencies are resolved lazily via getters to handle initialization order
			this._stateManager = null;
			this._historyManager = null;
			this._selectionManager = null;

			// Configuration
			this.maxNestingDepth = 3;
			this.maxChildrenPerGroup = 100;
		}

		/**
		 * State manager getter - resolves lazily from editor if needed
		 *
		 * @return {Object|null} StateManager instance
		 */
		get stateManager() {
			if ( !this._stateManager && this.editor ) {
				this._stateManager = this.editor.stateManager || null;
			}
			return this._stateManager;
		}

		/**
		 * History manager getter - resolves lazily from editor if needed
		 *
		 * @return {Object|null} HistoryManager instance
		 */
		get historyManager() {
			if ( !this._historyManager && this.editor ) {
				this._historyManager = this.editor.historyManager || null;
			}
			return this._historyManager;
		}

		/**
		 * Selection manager getter - resolves lazily from editor if needed
		 *
		 * @return {Object|null} SelectionManager instance
		 */
		get selectionManager() {
			if ( !this._selectionManager && this.editor && this.editor.canvasManager ) {
				this._selectionManager = this.editor.canvasManager.selectionManager || null;
			}
			return this._selectionManager;
		}

		/**
		 * Initialize the GroupManager with required dependencies
		 * Can be called later if dependencies weren't available at construction time
		 *
		 * @param {Object} options Configuration options
		 * @param {Object} options.stateManager StateManager instance
		 * @param {Object} options.selectionManager SelectionManager instance
		 * @param {Object} options.historyManager HistoryManager instance
		 */
		initialize( options ) {
			this._stateManager = options.stateManager || this._stateManager;
			this._selectionManager = options.selectionManager || this._selectionManager;
			this._historyManager = options.historyManager || this._historyManager;
		}

		/** @see GroupHierarchyHelper.generateGroupId */
		generateGroupId() {
			return GroupHierarchyHelper.generateGroupId();
		}

		/**
		 * Create a new group from selected layers
		 *
		 * @param {Array} layerIds Array of layer IDs to group
		 * @param {string} [name] Optional group name
		 * @return {Object|null} The created group layer, or null if failed
		 */
		createGroup( layerIds, name ) {
			if ( !layerIds || layerIds.length === 0 ) {
				return null;
			}

			if ( !this.stateManager ) {
				return null;
			}

			const layers = this.stateManager.get( 'layers' ) || [];

			// Validate layers exist and check nesting depth
			const validLayerIds = [];
			for ( const id of layerIds ) {
				const layer = layers.find( ( l ) => l.id === id );
				if ( layer ) {
					// Check if layer is already in a group that would exceed max depth
					const currentDepth = this.getLayerDepth( layer, layers );
					if ( currentDepth >= this.maxNestingDepth ) {
						// Skip layers that would exceed nesting depth
						continue;
					}
					validLayerIds.push( id );
				}
			}

			if ( validLayerIds.length === 0 ) {
				return null;
			}

			// Check max children limit
			if ( validLayerIds.length > this.maxChildrenPerGroup ) {
				return null;
			}

			// Create the group layer
			const group = {
				id: this.generateGroupId(),
				type: 'group',
				name: name || this.generateDefaultGroupName( layers ),
				visible: true,
				locked: false,
				expanded: true,
				children: validLayerIds
			};

			// Update child layers to reference the parent group
			const updatedLayers = layers.map( ( layer ) => {
				if ( validLayerIds.includes( layer.id ) ) {
					return { ...layer, parentGroup: group.id };
				}
				return layer;
			} );

			// Find the position of the first grouped layer (topmost in visual order)
			const firstLayerIndex = updatedLayers.findIndex(
				( l ) => validLayerIds.includes( l.id )
			);

			// Separate layers: non-grouped layers and grouped layers (children)
			const nonGroupedLayers = updatedLayers.filter(
				( l ) => !validLayerIds.includes( l.id )
			);
			const groupedLayers = updatedLayers.filter(
				( l ) => validLayerIds.includes( l.id )
			);

			// Build new layer order: insert group followed by its children at the first layer's position
			// Count how many non-grouped layers come before the first grouped layer
			let insertionPoint = 0;
			for ( let i = 0; i < firstLayerIndex; i++ ) {
				if ( !validLayerIds.includes( updatedLayers[ i ].id ) ) {
					insertionPoint++;
				}
			}

			// Insert group and children into the non-grouped array
			const newLayers = [
				...nonGroupedLayers.slice( 0, insertionPoint ),
				group,
				...groupedLayers,
				...nonGroupedLayers.slice( insertionPoint )
			];

			// Mutate state first, then save to history (save-after-mutate pattern)
			this.stateManager.set( 'layers', newLayers );

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Create group' );
			}

			return group;
		}

		/**
		 * Create a folder (group) - can be empty or include specified layers
		 * This is the primary method for the "Add Folder" button
		 *
		 * @param {Array} [layerIds] Optional array of layer IDs to include in the folder
		 * @param {string} [name] Optional folder name
		 * @return {Object|null} The created folder layer, or null if failed
		 */
		createFolder( layerIds, name ) {
			if ( !this.stateManager ) {
				return null;
			}

			const layers = this.stateManager.get( 'layers' ) || [];

			// If layerIds provided, use createGroup logic to include them
			if ( layerIds && layerIds.length > 0 ) {
				return this.createGroup( layerIds, name || this.generateDefaultFolderName( layers ) );
			}

			// Create an empty folder
			const folder = {
				id: this.generateGroupId(),
				type: 'group',
				name: name || this.generateDefaultFolderName( layers ),
				visible: true,
				locked: false,
				expanded: true,
				children: []
			};

			// Insert folder at the top of the layer list
			const newLayers = [ folder, ...layers ];

			// Mutate state first, then save to history (save-after-mutate pattern)
			this.stateManager.set( 'layers', newLayers );

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Create folder' );
			}

			return folder;
		}

		/** @see GroupHierarchyHelper.generateDefaultFolderName */
		generateDefaultFolderName( layers ) {
			return GroupHierarchyHelper.generateDefaultFolderName( layers );
		}

		/** @see GroupHierarchyHelper.generateDefaultGroupName */
		generateDefaultGroupName( layers ) {
			return GroupHierarchyHelper.generateDefaultGroupName( layers );
		}

		/** @see GroupHierarchyHelper.isDescendantOf */
		isDescendantOf( potentialDescendantId, ancestorId, layers, depth = 0 ) {
			return GroupHierarchyHelper.isDescendantOf( potentialDescendantId, ancestorId, layers, this.maxNestingDepth, depth );
		}

		/**
		 * Move a layer into a folder
		 *
		 * @param {string} layerId ID of the layer to move
		 * @param {string} folderId ID of the target folder
		 * @return {boolean} True if successful
		 */
		moveToFolder( layerId, folderId ) {
			if ( !this.stateManager ) {
				return false;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			const layer = layers.find( ( l ) => l.id === layerId );
			const folder = layers.find( ( l ) => l.id === folderId && l.type === 'group' );

			if ( !layer || !folder ) {
				return false;
			}

			// Don't move a folder into itself or its children
			if ( layerId === folderId ) {
				return false;
			}

			// CORE-4 fix: Prevent circular references - don't allow moving a folder
			// into one of its own descendants
			if ( layer.type === 'group' && this.isDescendantOf( folderId, layerId, layers ) ) {
				return false;
			}

			// Check if layer is already in this folder
			if ( layer.parentGroup === folderId ) {
				return false;
			}

			// Check nesting depth
			const folderDepth = this.getLayerDepth( folder, layers );
			const layerMaxDepth = layer.type === 'group' ? this.getMaxChildDepth( layer, layers ) : 0;
			if ( folderDepth + 1 + layerMaxDepth > this.maxNestingDepth ) {
				return false;
			}

			// Remove layer from its current parent's children array (if any)
			let updatedLayers = layers.map( ( l ) => {
				if ( l.type === 'group' && l.children && l.children.includes( layerId ) ) {
					return { ...l, children: l.children.filter( ( id ) => id !== layerId ) };
				}
				return l;
			} );

			// Update target folder to include the layer
			updatedLayers = updatedLayers.map( ( l ) => {
				if ( l.id === folderId ) {
					const newChildren = [ ...( l.children || [] ), layerId ];
					return { ...l, children: newChildren };
				}
				return l;
			} );

			// Update the layer's parentGroup reference
			updatedLayers = updatedLayers.map( ( l ) => {
				if ( l.id === layerId ) {
					return { ...l, parentGroup: folderId };
				}
				return l;
			} );

			// Reorder layers so that the moved layer appears after the folder
			const folderIndex = updatedLayers.findIndex( ( l ) => l.id === folderId );
			const layerIndex = updatedLayers.findIndex( ( l ) => l.id === layerId );

			if ( folderIndex !== -1 && layerIndex !== -1 && layerIndex !== folderIndex + 1 ) {
				// Remove the layer from its current position
				const [ movedLayer ] = updatedLayers.splice( layerIndex, 1 );

				// Find the new folder index (may have shifted after removal)
				const newFolderIndex = updatedLayers.findIndex( ( l ) => l.id === folderId );

				// Find where the folder's children end
				let insertIndex = newFolderIndex + 1;
				for ( let i = newFolderIndex + 1; i < updatedLayers.length; i++ ) {
					if ( updatedLayers[ i ].parentGroup === folderId ) {
						insertIndex = i + 1;
					} else {
						break;
					}
				}

				// Insert the layer after the folder's existing children
				updatedLayers.splice( insertIndex, 0, movedLayer );
			}

			// Mutate state first, then save to history (save-after-mutate pattern)
			this.stateManager.set( 'layers', updatedLayers );

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Move to folder' );
			}

			return true;
		}

		/**
		 * Add a layer to a folder at a specific position (before a sibling)
		 * Used when dragging a layer between items inside an expanded folder
		 *
		 * @param {string} layerId ID of the layer to add
		 * @param {string} folderId ID of the target folder
		 * @param {string} beforeSiblingId ID of the sibling to insert before
		 * @return {boolean} True if successful
		 */
		addToFolderAtPosition( layerId, folderId, beforeSiblingId ) {
			if ( !this.stateManager ) {
				return false;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			const layer = layers.find( ( l ) => l.id === layerId );
			const folder = layers.find( ( l ) => l.id === folderId && l.type === 'group' );

			if ( !layer || !folder ) {
				return false;
			}

			// Don't move a folder into itself
			if ( layerId === folderId ) {
				return false;
			}

			// Check if layer is already in this folder
			if ( layer.parentGroup === folderId ) {
				return false; // Already in folder, just reorder
			}

			// Check nesting depth
			const folderDepth = this.getLayerDepth( folder, layers );
			const layerMaxDepth = layer.type === 'group' ? this.getMaxChildDepth( layer, layers ) : 0;
			if ( folderDepth + 1 + layerMaxDepth > this.maxNestingDepth ) {
				return false;
			}

			// Remove layer from its current parent's children array (if any)
			let updatedLayers = layers.map( ( l ) => {
				if ( l.type === 'group' && l.children && l.children.includes( layerId ) ) {
					return { ...l, children: l.children.filter( ( id ) => id !== layerId ) };
				}
				return l;
			} );

			// Find the position of the sibling in the folder's children array
			const currentChildren = folder.children || [];
			const siblingIndex = beforeSiblingId ? currentChildren.indexOf( beforeSiblingId ) : -1;

			// Update target folder to include the layer at the correct position
			updatedLayers = updatedLayers.map( ( l ) => {
				if ( l.id === folderId ) {
					const newChildren = [ ...( l.children || [] ).filter( ( id ) => id !== layerId ) ];
					if ( siblingIndex >= 0 ) {
						// Insert before the sibling
						newChildren.splice( siblingIndex, 0, layerId );
					} else {
						// Sibling not found or null, add at end
						newChildren.push( layerId );
					}
					return { ...l, children: newChildren };
				}
				return l;
			} );

			// Update the layer's parentGroup reference
			updatedLayers = updatedLayers.map( ( l ) => {
				if ( l.id === layerId ) {
					return { ...l, parentGroup: folderId };
				}
				return l;
			} );

			// Reorder in the flat layers array
			const layerFlatIndex = updatedLayers.findIndex( ( l ) => l.id === layerId );

			if ( beforeSiblingId ) {
				// Insert before the sibling in the flat array
				const siblingFlatIndex = updatedLayers.findIndex( ( l ) => l.id === beforeSiblingId );
				if ( siblingFlatIndex !== -1 && layerFlatIndex !== -1 && layerFlatIndex !== siblingFlatIndex ) {
					const [ movedLayer ] = updatedLayers.splice( layerFlatIndex, 1 );
					// Recalculate sibling index after removal
					const newSiblingIndex = updatedLayers.findIndex( ( l ) => l.id === beforeSiblingId );
					updatedLayers.splice( newSiblingIndex, 0, movedLayer );
				}
			} else {
				// Add at end of folder's children - position after the last child in flat array
				const updatedFolder = updatedLayers.find( ( l ) => l.id === folderId );
				const folderChildren = ( updatedFolder && updatedFolder.children ) || [];
				// Find the last child that's not the layer we're adding
				const lastChildId = folderChildren.length > 1 ?
					folderChildren[ folderChildren.length - 2 ] : // -2 because layerId was just added at end
					null;

				if ( lastChildId && layerFlatIndex !== -1 ) {
					const lastChildFlatIndex = updatedLayers.findIndex( ( l ) => l.id === lastChildId );
					if ( lastChildFlatIndex !== -1 && layerFlatIndex !== lastChildFlatIndex + 1 ) {
						const [ movedLayer ] = updatedLayers.splice( layerFlatIndex, 1 );
						// Recalculate last child index after removal
						const newLastChildIndex = updatedLayers.findIndex( ( l ) => l.id === lastChildId );
						updatedLayers.splice( newLastChildIndex + 1, 0, movedLayer );
					}
				} else if ( layerFlatIndex !== -1 ) {
					// No other children, position after the folder itself
					const folderFlatIndex = updatedLayers.findIndex( ( l ) => l.id === folderId );
					if ( folderFlatIndex !== -1 && layerFlatIndex !== folderFlatIndex + 1 ) {
						const [ movedLayer ] = updatedLayers.splice( layerFlatIndex, 1 );
						const newFolderIndex = updatedLayers.findIndex( ( l ) => l.id === folderId );
						updatedLayers.splice( newFolderIndex + 1, 0, movedLayer );
					}
				}
			}

			// Mutate state first, then save to history (save-after-mutate pattern)
			this.stateManager.set( 'layers', updatedLayers );

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Add to folder' );
			}

			return true;
		}

		/**
		 * Remove a layer from its parent folder (move to root level)
		 *
		 * @param {string} layerId ID of the layer to remove from folder
		 * @return {boolean} True if successful
		 */
		removeFromFolder( layerId ) {
			if ( !this.stateManager ) {
				return false;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			const layer = layers.find( ( l ) => l.id === layerId );

			if ( !layer || !layer.parentGroup ) {
				return false; // Layer not in a folder
			}

			const parentId = layer.parentGroup;

			// Remove from parent's children array
			let updatedLayers = layers.map( ( l ) => {
				if ( l.id === parentId && l.type === 'group' && l.children ) {
					return { ...l, children: l.children.filter( ( id ) => id !== layerId ) };
				}
				return l;
			} );

			// Remove parentGroup reference from the layer
			updatedLayers = updatedLayers.map( ( l ) => {
				if ( l.id === layerId ) {
					return window.Layers.Utils.omitProperty( l, 'parentGroup' );
				}
				return l;
			} );

			// Mutate state first, then save to history (save-after-mutate pattern)
			this.stateManager.set( 'layers', updatedLayers );

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Remove from folder' );
			}

			return true;
		}

		/**
		 * Ungroup a group layer, moving its children to the root level
		 *
		 * @param {string} groupId ID of the group to ungroup
		 * @return {boolean} True if successful
		 */
		ungroup( groupId ) {
			if ( !this.stateManager ) {
				return false;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			const groupIndex = layers.findIndex( ( l ) => l.id === groupId && l.type === 'group' );

			if ( groupIndex === -1 ) {
				return false;
			}

			const group = layers[ groupIndex ];
			const childIds = group.children || [];

			// Remove parentGroup reference from children
			const updatedLayers = layers.map( ( layer ) => {
				if ( childIds.includes( layer.id ) ) {
					return window.Layers.Utils.omitProperty( layer, 'parentGroup' );
				}
				return layer;
			} );

			// Remove the group layer
			const newLayers = updatedLayers.filter( ( l ) => l.id !== groupId );

			// Mutate state first, then save to history (save-after-mutate pattern)
			this.stateManager.set( 'layers', newLayers );

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Ungroup' );
			}

			return true;
		}

		/**
		 * Add a layer to an existing group
		 *
		 * @param {string} layerId ID of the layer to add
		 * @param {string} groupId ID of the target group
		 * @return {boolean} True if successful
		 */
		addToGroup( layerId, groupId ) {
			if ( !this.stateManager ) {
				return false;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			const layer = layers.find( ( l ) => l.id === layerId );
			const group = layers.find( ( l ) => l.id === groupId && l.type === 'group' );

			if ( !layer || !group ) {
				return false;
			}

			// Check nesting depth
			const groupDepth = this.getLayerDepth( group, layers );
			const layerDepth = layer.type === 'group' ? this.getMaxChildDepth( layer, layers ) : 0;

			if ( groupDepth + layerDepth + 1 > this.maxNestingDepth ) {
				return false;
			}

			// Check max children
			if ( group.children.length >= this.maxChildrenPerGroup ) {
				return false;
			}

			// Remove from previous group if any
			const updatedLayers = this.removeFromCurrentGroup( layerId, layers );

			// Add to new group
			const finalLayers = updatedLayers.map( ( l ) => {
				if ( l.id === groupId ) {
					return { ...l, children: [ ...l.children, layerId ] };
				}
				if ( l.id === layerId ) {
					return { ...l, parentGroup: groupId };
				}
				return l;
			} );

			// Mutate state first, then save to history (save-after-mutate pattern)
			this.stateManager.set( 'layers', finalLayers );

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Add to group' );
			}

			return true;
		}

		/**
		 * Remove a layer from its current group
		 *
		 * @param {string} layerId ID of the layer to remove
		 * @param {Array} [layers] Optional layers array (uses state if not provided)
		 * @return {Array} Updated layers array
		 */
		removeFromCurrentGroup( layerId, layers ) {
			if ( !layers ) {
				if ( !this.stateManager ) {
					return [];
				}
				layers = this.stateManager.get( 'layers' ) || [];
			}

			const layer = layers.find( ( l ) => l.id === layerId );
			if ( !layer || !layer.parentGroup ) {
				return layers;
			}

			const parentGroupId = layer.parentGroup;

			return layers.map( ( l ) => {
				if ( l.id === parentGroupId && l.type === 'group' ) {
					return {
						...l,
						children: l.children.filter( ( childId ) => childId !== layerId )
					};
				}
				if ( l.id === layerId ) {
					return window.Layers.Utils.omitProperty( l, 'parentGroup' );
				}
				return l;
			} );
		}

		/**
		 * Remove a layer from a specific group
		 *
		 * @param {string} layerId ID of the layer to remove
		 * @param {string} groupId ID of the group to remove from
		 * @return {boolean} True if successful
		 */
		removeFromGroup( layerId, groupId ) {
			if ( !this.stateManager ) {
				return false;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			const updatedLayers = layers.map( ( l ) => {
				if ( l.id === groupId && l.type === 'group' ) {
					return {
						...l,
						children: l.children.filter( ( childId ) => childId !== layerId )
					};
				}
				if ( l.id === layerId && l.parentGroup === groupId ) {
					return window.Layers.Utils.omitProperty( l, 'parentGroup' );
				}
				return l;
			} );

			// Mutate state first, then save to history (save-after-mutate pattern)
			this.stateManager.set( 'layers', updatedLayers );

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Remove from group' );
			}

			return true;
		}

		/**
		 * Toggle the expanded state of a group
		 *
		 * @param {string} groupId ID of the group
		 * @return {boolean} New expanded state
		 */
		toggleExpanded( groupId ) {
			if ( !this.stateManager ) {
				return false;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			let newExpanded = false;

			const updatedLayers = layers.map( ( l ) => {
				if ( l.id === groupId && l.type === 'group' ) {
					newExpanded = !l.expanded;
					return { ...l, expanded: newExpanded };
				}
				return l;
			} );

			this.stateManager.set( 'layers', updatedLayers );

			return newExpanded;
		}

		/**
		 * Set the expanded state of a group
		 *
		 * @param {string} groupId ID of the group
		 * @param {boolean} expanded Whether to expand or collapse
		 */
		setExpanded( groupId, expanded ) {
			if ( !this.stateManager ) {
				return;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			const updatedLayers = layers.map( ( l ) => {
				if ( l.id === groupId && l.type === 'group' ) {
					return { ...l, expanded: Boolean( expanded ) };
				}
				return l;
			} );

			this.stateManager.set( 'layers', updatedLayers );
		}

		/** @see GroupHierarchyHelper.getGroupChildren */
		getGroupChildren( groupId, recursive = true, depth = 0 ) {
			if ( !this.stateManager ) {
				return [];
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			return GroupHierarchyHelper.getGroupChildren( groupId, layers, this.maxNestingDepth, recursive, depth );
		}

		/** @see GroupHierarchyHelper.getLayerDepth */
		getLayerDepth( layerOrId, layers ) {
			// If layers not provided, get from stateManager
			if ( !layers && this.stateManager ) {
				layers = this.stateManager.get( 'layers' ) || [];
			}
			return GroupHierarchyHelper.getLayerDepth( layerOrId, layers, this.maxNestingDepth );
		}

		/** @see GroupHierarchyHelper.getMaxChildDepth */
		getMaxChildDepth( group, layers, depth = 0 ) {
			return GroupHierarchyHelper.getMaxChildDepth( group, layers, this.maxNestingDepth, depth );
		}

		/** @see GroupHierarchyHelper.getGroupBounds */
		getGroupBounds( groupId ) {
			if ( !this.stateManager ) {
				return null;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			return GroupHierarchyHelper.getGroupBounds( groupId, layers, this.maxNestingDepth );
		}

		/** @see GroupHierarchyHelper.getLayerBounds */
		getLayerBounds( layer ) {
			return GroupHierarchyHelper.getLayerBounds( layer );
		}

		/** @see GroupHierarchyHelper.getTopLevelLayers */
		getTopLevelLayers() {
			if ( !this.stateManager ) {
				return [];
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			return GroupHierarchyHelper.getTopLevelLayers( layers );
		}

		/** @see GroupHierarchyHelper.isGroup */
		isGroup( layerOrId ) {
			if ( typeof layerOrId === 'string' && this.stateManager ) {
				const layers = this.stateManager.get( 'layers' ) || [];
				return GroupHierarchyHelper.isGroup( layerOrId, layers );
			}
			return GroupHierarchyHelper.isGroup( layerOrId );
		}

		/** @see GroupHierarchyHelper.getParentGroup */
		getParentGroup( layerId ) {
			if ( !this.stateManager ) {
				return null;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			return GroupHierarchyHelper.getParentGroup( layerId, layers );
		}

		/**
		 * Rename a group
		 *
		 * @param {string} groupId ID of the group
		 * @param {string} newName New name for the group
		 * @return {boolean} True if successful
		 */
		renameGroup( groupId, newName ) {
			if ( !this.stateManager || !newName ) {
				return false;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			const updatedLayers = layers.map( ( l ) => {
				if ( l.id === groupId && l.type === 'group' ) {
					return { ...l, name: newName };
				}
				return l;
			} );

			// Mutate state first, then save to history (save-after-mutate pattern)
			this.stateManager.set( 'layers', updatedLayers );

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Rename group' );
			}

			return true;
		}

		/**
		 * Delete a group and optionally its children
		 *
		 * @param {string} groupId ID of the group to delete
		 * @param {boolean} [deleteChildren=false] Whether to delete children too
		 * @return {boolean} True if successful
		 */
		deleteGroup( groupId, deleteChildren = false ) {
			if ( !this.stateManager ) {
				return false;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			const group = layers.find( ( l ) => l.id === groupId && l.type === 'group' );

			if ( !group ) {
				return false;
			}

			let newLayers;

			if ( deleteChildren ) {
				// Get all descendant IDs
				const allChildIds = new Set();
				const maxDepth = this.maxNestingDepth + 5;
				const collectChildren = ( gId, depth = 0 ) => {
					// Depth guard to prevent stack overflow with corrupted data
					if ( depth > maxDepth ) {
						if ( typeof mw !== 'undefined' && mw.log ) {
							mw.log.warn( '[GroupManager] Max recursion depth exceeded in collectChildren' );
						}
						return;
					}
					const g = layers.find( ( l ) => l.id === gId && l.type === 'group' );
					if ( g && g.children ) {
						for ( const childId of g.children ) {
							allChildIds.add( childId );
							collectChildren( childId, depth + 1 );
						}
					}
				};
				allChildIds.add( groupId );
				collectChildren( groupId, 0 );

				newLayers = layers.filter( ( l ) => !allChildIds.has( l.id ) );
			} else {
				// Ungroup first, then delete empty group
				this.ungroup( groupId );
				return true;
			}

			// Mutate state first, then save to history (save-after-mutate pattern)
			this.stateManager.set( 'layers', newLayers );

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Delete group' );
			}

			return true;
		}

		/**
		 * Group currently selected layers
		 *
		 * @return {Object|null} Created group or null
		 */
		groupSelected() {
			if ( !this.selectionManager ) {
				return null;
			}

			const selectedLayers = this.selectionManager.getSelectedLayers();
			if ( !selectedLayers || selectedLayers.length < 2 ) {
				return null;
			}

			const layerIds = selectedLayers.map( ( l ) => l.id );
			const group = this.createGroup( layerIds );

			if ( group && this.selectionManager ) {
				// Select the new group
				this.selectionManager.selectLayer( group.id );
			}

			return group;
		}

		/**
		 * Ungroup currently selected group
		 *
		 * @return {boolean} True if successful
		 */
		ungroupSelected() {
			if ( !this.selectionManager ) {
				return false;
			}

			const selectedLayers = this.selectionManager.getSelectedLayers();
			if ( !selectedLayers || selectedLayers.length !== 1 ) {
				return false;
			}

			const selected = selectedLayers[ 0 ];
			if ( selected.type !== 'group' ) {
				return false;
			}

			return this.ungroup( selected.id );
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.editor = null;
			this._stateManager = null;
			this._selectionManager = null;
			this._historyManager = null;
		}
	}

	// Register in namespace
	window.Layers = window.Layers || {};
	window.Layers.Core = window.Layers.Core || {};
	window.Layers.GroupManager = GroupManager;
	window.Layers.Core.GroupManager = GroupManager;

	// Also export for module systems
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = GroupManager;
	}
}() );
