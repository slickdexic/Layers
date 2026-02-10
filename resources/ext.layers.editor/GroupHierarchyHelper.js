/**
 * GroupHierarchyHelper - Pure static utility functions for layer group hierarchy operations
 *
 * Extracted from GroupManager to reduce god-class size. These are all read-only
 * tree traversal and query methods that operate on a layers array without mutating state.
 *
 * @module GroupHierarchyHelper
 */
( function () {
	'use strict';

	/**
	 * GroupHierarchyHelper class - all methods are static
	 *
	 * @class
	 */
	class GroupHierarchyHelper {
		/**
		 * Generate a unique group ID
		 *
		 * @return {string} Unique group ID
		 */
		static generateGroupId() {
			return 'group-' + Date.now() + '-' + Math.random().toString( 36 ).substr( 2, 9 );
		}

		/**
		 * Generate a default name for a new folder
		 *
		 * @param {Array} layers Current layers array
		 * @return {string} Default folder name
		 */
		static generateDefaultFolderName( layers ) {
			const existingFolders = layers.filter( ( l ) => l.type === 'group' );
			return 'Folder ' + ( existingFolders.length + 1 );
		}

		/**
		 * Generate a default name for a new group
		 *
		 * @param {Array} layers Current layers array
		 * @return {string} Default group name
		 */
		static generateDefaultGroupName( layers ) {
			const existingGroups = layers.filter( ( l ) => l.type === 'group' );
			return 'Folder ' + ( existingGroups.length + 1 );
		}

		/**
		 * Check if a layer is a descendant of another layer (folder).
		 * Used to prevent circular references when moving folders.
		 *
		 * @param {string} potentialDescendantId ID of the layer to check
		 * @param {string} ancestorId ID of the potential ancestor
		 * @param {Array} layers Current layers array
		 * @param {number} maxNestingDepth Maximum allowed nesting depth
		 * @param {number} [depth=0] Current recursion depth (for guard)
		 * @return {boolean} True if potentialDescendantId is inside ancestorId's tree
		 */
		static isDescendantOf( potentialDescendantId, ancestorId, layers, maxNestingDepth, depth = 0 ) {
			// Depth guard to prevent stack overflow with corrupted data
			if ( depth > maxNestingDepth + 5 ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[GroupHierarchyHelper] Max recursion depth exceeded in isDescendantOf' );
				}
				return false;
			}

			const ancestor = layers.find( ( l ) => l.id === ancestorId );
			if ( !ancestor || ancestor.type !== 'group' || !ancestor.children ) {
				return false;
			}

			// Direct child check
			if ( ancestor.children.includes( potentialDescendantId ) ) {
				return true;
			}

			// Recursive check through all children that are groups
			for ( const childId of ancestor.children ) {
				const child = layers.find( ( l ) => l.id === childId );
				if ( child && child.type === 'group' ) {
					if ( GroupHierarchyHelper.isDescendantOf( potentialDescendantId, childId, layers, maxNestingDepth, depth + 1 ) ) {
						return true;
					}
				}
			}

			return false;
		}

		/**
		 * Get all children of a group (including nested children)
		 *
		 * @param {string} groupId ID of the group
		 * @param {Array} layers All layers array
		 * @param {number} maxNestingDepth Maximum allowed nesting depth
		 * @param {boolean} [recursive=true] Whether to include nested children
		 * @param {number} [depth=0] Current recursion depth (for guard)
		 * @return {Array} Array of child layer objects
		 */
		static getGroupChildren( groupId, layers, maxNestingDepth, recursive = true, depth = 0 ) {
			// Depth guard to prevent stack overflow with corrupted data
			if ( depth > maxNestingDepth + 5 ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[GroupHierarchyHelper] Max recursion depth exceeded in getGroupChildren' );
				}
				return [];
			}

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
						children.push( ...GroupHierarchyHelper.getGroupChildren( child.id, layers, maxNestingDepth, true, depth + 1 ) );
					}
				}
			}

			return children;
		}

		/**
		 * Get the nesting depth of a layer
		 *
		 * @param {string|Object} layerOrId Layer object or layer ID
		 * @param {Array} layers All layers array
		 * @param {number} maxNestingDepth Maximum allowed nesting depth
		 * @return {number} Nesting depth (0 = root level)
		 */
		static getLayerDepth( layerOrId, layers, maxNestingDepth ) {
			if ( !layers ) {
				return 0;
			}

			// If passed an ID (string), find the layer object
			let layer = layerOrId;
			if ( typeof layerOrId === 'string' ) {
				layer = layers.find( ( l ) => l.id === layerOrId );
				if ( !layer ) {
					return 0;
				}
			}

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
				if ( depth > maxNestingDepth + 1 ) {
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
		 * @param {number} maxNestingDepth Maximum allowed nesting depth
		 * @param {number} [depth=0] Current recursion depth (for guard)
		 * @return {number} Maximum child depth
		 */
		static getMaxChildDepth( group, layers, maxNestingDepth, depth = 0 ) {
			// Depth guard to prevent stack overflow with corrupted data
			if ( depth > maxNestingDepth + 5 ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[GroupHierarchyHelper] Max recursion depth exceeded in getMaxChildDepth' );
				}
				return 0;
			}

			if ( group.type !== 'group' || !group.children || group.children.length === 0 ) {
				return 0;
			}

			let maxDepth = 0;
			for ( const childId of group.children ) {
				const child = layers.find( ( l ) => l.id === childId );
				if ( child && child.type === 'group' ) {
					const childDepth = 1 + GroupHierarchyHelper.getMaxChildDepth( child, layers, maxNestingDepth, depth + 1 );
					maxDepth = Math.max( maxDepth, childDepth );
				}
			}

			return maxDepth;
		}

		/**
		 * Calculate the bounding box of a group (union of all children bounds)
		 *
		 * @param {string} groupId ID of the group
		 * @param {Array} layers All layers array
		 * @param {number} maxNestingDepth Maximum allowed nesting depth
		 * @return {Object|null} Bounding box { x, y, width, height } or null
		 */
		static getGroupBounds( groupId, layers, maxNestingDepth ) {
			const children = GroupHierarchyHelper.getGroupChildren( groupId, layers, maxNestingDepth, true );

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

				const bounds = GroupHierarchyHelper.getLayerBounds( child );
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
		static getLayerBounds( layer ) {
			if ( !layer ) {
				return null;
			}

			// Try to use BoundsCalculator if available
			if ( typeof window !== 'undefined' && window.Layers && window.Layers.BoundsCalculator ) {
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
		 * @param {Array} layers All layers array
		 * @return {Array} Array of top-level layer objects
		 */
		static getTopLevelLayers( layers ) {
			return layers.filter( ( l ) => !l.parentGroup );
		}

		/**
		 * Check if a layer is a group
		 *
		 * @param {Object|string} layerOrId Layer object or ID
		 * @param {Array} [layers] Layers array (required if layerOrId is a string)
		 * @return {boolean} True if layer is a group
		 */
		static isGroup( layerOrId, layers ) {
			if ( typeof layerOrId === 'string' ) {
				if ( !layers ) {
					return false;
				}
				const layer = layers.find( ( l ) => l.id === layerOrId );
				return layer ? layer.type === 'group' : false;
			}
			return layerOrId && layerOrId.type === 'group';
		}

		/**
		 * Get the parent group of a layer
		 *
		 * @param {string} layerId ID of the layer
		 * @param {Array} layers All layers array
		 * @return {Object|null} Parent group layer or null
		 */
		static getParentGroup( layerId, layers ) {
			const layer = layers.find( ( l ) => l.id === layerId );

			if ( !layer || !layer.parentGroup ) {
				return null;
			}

			return layers.find( ( l ) => l.id === layer.parentGroup && l.type === 'group' ) || null;
		}
	}

	// Export for ResourceLoader
	if ( typeof mw !== 'undefined' ) {
		mw.ext = mw.ext || {};
		mw.ext.layers = mw.ext.layers || {};
		mw.ext.layers.GroupHierarchyHelper = GroupHierarchyHelper;
	}

	// Export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = GroupHierarchyHelper;
	}
}() );
