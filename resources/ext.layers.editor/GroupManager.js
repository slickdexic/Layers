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

	/**
	 * GroupManager class
	 *
	 * @class
	 */
	class GroupManager {
		/**
		 * Create a new GroupManager instance
		 *
		 * @param {Object} editor Reference to LayersEditor instance
		 */
		constructor( editor ) {
			this.editor = editor;
			this.stateManager = null;
			this.selectionManager = null;
			this.historyManager = null;

			// Configuration
			this.maxNestingDepth = 3;
			this.maxChildrenPerGroup = 100;
		}

		/**
		 * Initialize the GroupManager with required dependencies
		 *
		 * @param {Object} options Configuration options
		 * @param {Object} options.stateManager StateManager instance
		 * @param {Object} options.selectionManager SelectionManager instance
		 * @param {Object} options.historyManager HistoryManager instance
		 */
		initialize( options ) {
			this.stateManager = options.stateManager || null;
			this.selectionManager = options.selectionManager || null;
			this.historyManager = options.historyManager || null;
		}

		/**
		 * Generate a unique group ID
		 *
		 * @return {string} Unique group ID
		 */
		generateGroupId() {
			return 'group-' + Date.now() + '-' + Math.random().toString( 36 ).substr( 2, 9 );
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

			// Find insertion index (position of first grouped layer)
			const firstLayerIndex = updatedLayers.findIndex(
				( l ) => validLayerIds.includes( l.id )
			);

			// Insert group at the position of the first grouped layer
			const newLayers = [
				...updatedLayers.slice( 0, firstLayerIndex ),
				group,
				...updatedLayers.slice( firstLayerIndex )
			];

			// Save state with history
			if ( this.historyManager ) {
				this.historyManager.saveState( 'Create group' );
			}

			this.stateManager.set( 'layers', newLayers );

			return group;
		}

		/**
		 * Generate a default name for a new group
		 *
		 * @param {Array} layers Current layers array
		 * @return {string} Default group name
		 */
		generateDefaultGroupName( layers ) {
			const existingGroups = layers.filter( ( l ) => l.type === 'group' );
			return 'Group ' + ( existingGroups.length + 1 );
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
					const { parentGroup, ...rest } = layer;
					return rest;
				}
				return layer;
			} );

			// Remove the group layer
			const newLayers = updatedLayers.filter( ( l ) => l.id !== groupId );

			// Save state with history
			if ( this.historyManager ) {
				this.historyManager.saveState( 'Ungroup' );
			}

			this.stateManager.set( 'layers', newLayers );

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

			// Save state with history
			if ( this.historyManager ) {
				this.historyManager.saveState( 'Add to group' );
			}

			this.stateManager.set( 'layers', finalLayers );

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
					const { parentGroup, ...rest } = l;
					return rest;
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
					const { parentGroup, ...rest } = l;
					return rest;
				}
				return l;
			} );

			// Save state with history
			if ( this.historyManager ) {
				this.historyManager.saveState( 'Remove from group' );
			}

			this.stateManager.set( 'layers', updatedLayers );

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

		/**
		 * Get all children of a group (including nested children)
		 *
		 * @param {string} groupId ID of the group
		 * @param {boolean} [recursive=true] Whether to include nested children
		 * @return {Array} Array of child layer objects
		 */
		getGroupChildren( groupId, recursive = true ) {
			if ( !this.stateManager ) {
				return [];
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			const group = layers.find( ( l ) => l.id === groupId && l.type === 'group' );

			if ( !group ) {
				return [];
			}

			const children = [];
			for ( const childId of group.children || [] ) {
				const child = layers.find( ( l ) => l.id === childId );
				if ( child ) {
					children.push( child );
					if ( recursive && child.type === 'group' ) {
						children.push( ...this.getGroupChildren( child.id, true ) );
					}
				}
			}

			return children;
		}

		/**
		 * Get the nesting depth of a layer
		 *
		 * @param {Object} layer Layer object
		 * @param {Array} layers All layers array
		 * @return {number} Nesting depth (0 = root level)
		 */
		getLayerDepth( layer, layers ) {
			let depth = 0;
			let current = layer;

			while ( current && current.parentGroup ) {
				const parent = layers.find( ( l ) => l.id === current.parentGroup );
				if ( !parent ) {
					break;
				}
				depth++;
				current = parent;

				// Safety check to prevent infinite loops
				if ( depth > this.maxNestingDepth + 1 ) {
					break;
				}
			}

			return depth;
		}

		/**
		 * Get the maximum depth of children within a group
		 *
		 * @param {Object} group Group layer object
		 * @param {Array} layers All layers array
		 * @return {number} Maximum child depth
		 */
		getMaxChildDepth( group, layers ) {
			if ( group.type !== 'group' || !group.children || group.children.length === 0 ) {
				return 0;
			}

			let maxDepth = 0;
			for ( const childId of group.children ) {
				const child = layers.find( ( l ) => l.id === childId );
				if ( child && child.type === 'group' ) {
					const childDepth = 1 + this.getMaxChildDepth( child, layers );
					maxDepth = Math.max( maxDepth, childDepth );
				}
			}

			return maxDepth;
		}

		/**
		 * Calculate the bounding box of a group (union of all children bounds)
		 *
		 * @param {string} groupId ID of the group
		 * @return {Object|null} Bounding box { x, y, width, height } or null
		 */
		getGroupBounds( groupId ) {
			const children = this.getGroupChildren( groupId, true );

			if ( children.length === 0 ) {
				return null;
			}

			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			for ( const child of children ) {
				if ( child.type === 'group' ) {
					continue; // Skip group layers themselves
				}

				const bounds = this.getLayerBounds( child );
				if ( bounds ) {
					minX = Math.min( minX, bounds.x );
					minY = Math.min( minY, bounds.y );
					maxX = Math.max( maxX, bounds.x + bounds.width );
					maxY = Math.max( maxY, bounds.y + bounds.height );
				}
			}

			if ( minX === Infinity ) {
				return null;
			}

			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY
			};
		}

		/**
		 * Get bounds for a single layer
		 *
		 * @param {Object} layer Layer object
		 * @return {Object|null} Bounding box { x, y, width, height }
		 */
		getLayerBounds( layer ) {
			if ( !layer ) {
				return null;
			}

			// Try to use BoundsCalculator if available
			if ( window.Layers && window.Layers.BoundsCalculator ) {
				return window.Layers.BoundsCalculator.calculateBounds( layer );
			}

			// Fallback basic bounds calculation
			const x = layer.x || 0;
			const y = layer.y || 0;
			const width = layer.width || layer.radius * 2 || 100;
			const height = layer.height || layer.radius * 2 || 100;

			return { x, y, width, height };
		}

		/**
		 * Get all top-level layers (not inside any group)
		 *
		 * @return {Array} Array of top-level layer objects
		 */
		getTopLevelLayers() {
			if ( !this.stateManager ) {
				return [];
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			return layers.filter( ( l ) => !l.parentGroup );
		}

		/**
		 * Check if a layer is a group
		 *
		 * @param {Object|string} layerOrId Layer object or ID
		 * @return {boolean} True if layer is a group
		 */
		isGroup( layerOrId ) {
			if ( typeof layerOrId === 'string' ) {
				if ( !this.stateManager ) {
					return false;
				}
				const layers = this.stateManager.get( 'layers' ) || [];
				const layer = layers.find( ( l ) => l.id === layerOrId );
				return layer ? layer.type === 'group' : false;
			}
			return layerOrId && layerOrId.type === 'group';
		}

		/**
		 * Get the parent group of a layer
		 *
		 * @param {string} layerId ID of the layer
		 * @return {Object|null} Parent group layer or null
		 */
		getParentGroup( layerId ) {
			if ( !this.stateManager ) {
				return null;
			}

			const layers = this.stateManager.get( 'layers' ) || [];
			const layer = layers.find( ( l ) => l.id === layerId );

			if ( !layer || !layer.parentGroup ) {
				return null;
			}

			return layers.find( ( l ) => l.id === layer.parentGroup && l.type === 'group' ) || null;
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

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Rename group' );
			}

			this.stateManager.set( 'layers', updatedLayers );

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
				const collectChildren = ( gId ) => {
					const g = layers.find( ( l ) => l.id === gId && l.type === 'group' );
					if ( g && g.children ) {
						for ( const childId of g.children ) {
							allChildIds.add( childId );
							collectChildren( childId );
						}
					}
				};
				allChildIds.add( groupId );
				collectChildren( groupId );

				newLayers = layers.filter( ( l ) => !allChildIds.has( l.id ) );
			} else {
				// Ungroup first, then delete empty group
				this.ungroup( groupId );
				return true;
			}

			if ( this.historyManager ) {
				this.historyManager.saveState( 'Delete group' );
			}

			this.stateManager.set( 'layers', newLayers );

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
				this.selectionManager.selectLayer( group );
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
			this.stateManager = null;
			this.selectionManager = null;
			this.historyManager = null;
		}
	}

	// Register in namespace
	window.Layers = window.Layers || {};
	window.Layers.GroupManager = GroupManager;

	// Also export for module systems
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = GroupManager;
	}
}() );
