/* eslint-env node */
/**
 * ShapeLibraryManager - Search, filtering, and category navigation for shapes
 *
 * Manages user interactions with the shape library including search,
 * recent shapes tracking, and favorites.
 *
 * @class
 */
class ShapeLibraryManager {
	/**
	 * Create a ShapeLibraryManager
	 *
	 * @param {Object} [options] - Manager options
	 * @param {number} [options.maxRecent=10] - Maximum recent shapes to track
	 * @param {number} [options.maxFavorites=50] - Maximum favorites
	 * @param {string} [options.storageKey='layers-shape-library'] - localStorage key prefix
	 */
	constructor( options = {} ) {
		/**
		 * Maximum recent shapes to track
		 *
		 * @private
		 * @type {number}
		 */
		this.maxRecent = options.maxRecent || 10;

		/**
		 * Maximum favorites
		 *
		 * @private
		 * @type {number}
		 */
		this.maxFavorites = options.maxFavorites || 50;

		/**
		 * localStorage key prefix
		 *
		 * @private
		 * @type {string}
		 */
		this.storageKey = options.storageKey || 'layers-shape-library';

		/**
		 * Recently used shapes (in-memory, synced to storage)
		 *
		 * @private
		 * @type {Array<string>}
		 */
		this.recentShapes = [];

		/**
		 * Favorite shapes (in-memory, synced to storage)
		 *
		 * @private
		 * @type {Set<string>}
		 */
		this.favoriteShapes = new Set();

		/**
		 * Shape data provider (defaults to ShapeLibraryData)
		 *
		 * @private
		 * @type {Object}
		 */
		this.shapeData = null;

		/**
		 * Search index cache
		 *
		 * @private
		 * @type {Map<string, Object>}
		 */
		this.searchIndex = new Map();

		// Load persisted state
		this.loadFromStorage();
	}

	/**
	 * Set the shape data provider
	 *
	 * @param {Object} shapeData - Object with static methods for shape access
	 */
	setShapeData( shapeData ) {
		this.shapeData = shapeData;
		this.buildSearchIndex();
	}

	/**
	 * Build the search index for fast lookups
	 *
	 * @private
	 */
	buildSearchIndex() {
		if ( !this.shapeData ) {
			return;
		}

		this.searchIndex.clear();

		const allShapes = this.shapeData.getAllShapes();
		allShapes.forEach( ( shape ) => {
			// Index by ID for quick lookups
			this.searchIndex.set( shape.id, shape );
		} );
	}

	/**
	 * Get all categories
	 *
	 * @returns {Array<Object>} Category definitions
	 */
	getCategories() {
		if ( !this.shapeData ) {
			return [];
		}
		return this.shapeData.getCategories();
	}

	/**
	 * Get shapes in a category
	 *
	 * @param {string} categoryId - Category identifier
	 * @returns {Array<Object>} Shapes in category
	 */
	getShapesByCategory( categoryId ) {
		if ( !this.shapeData ) {
			return [];
		}
		return this.shapeData.getShapesByCategory( categoryId );
	}

	/**
	 * Get a shape by ID
	 *
	 * @param {string} shapeId - Shape identifier
	 * @returns {Object|null} Shape definition or null
	 */
	getShapeById( shapeId ) {
		// Try cache first
		if ( this.searchIndex.has( shapeId ) ) {
			return this.searchIndex.get( shapeId );
		}

		// Fall back to data provider
		if ( this.shapeData ) {
			return this.shapeData.getShapeById( shapeId );
		}

		return null;
	}

	/**
	 * Search for shapes by query
	 *
	 * @param {string} query - Search query
	 * @returns {Array<Object>} Matching shapes
	 */
	search( query ) {
		if ( !this.shapeData ) {
			return [];
		}
		return this.shapeData.search( query );
	}

	/**
	 * Get recent shapes
	 *
	 * @returns {Array<Object>} Recent shape definitions
	 */
	getRecentShapes() {
		return this.recentShapes
			.map( ( id ) => this.getShapeById( id ) )
			.filter( ( shape ) => shape !== null );
	}

	/**
	 * Add a shape to recent list
	 *
	 * @param {string} shapeId - Shape identifier
	 */
	addToRecent( shapeId ) {
		// Remove if already in list
		const index = this.recentShapes.indexOf( shapeId );
		if ( index > -1 ) {
			this.recentShapes.splice( index, 1 );
		}

		// Add to beginning
		this.recentShapes.unshift( shapeId );

		// Trim to max
		if ( this.recentShapes.length > this.maxRecent ) {
			this.recentShapes = this.recentShapes.slice( 0, this.maxRecent );
		}

		this.saveToStorage();
	}

	/**
	 * Clear recent shapes
	 */
	clearRecent() {
		this.recentShapes = [];
		this.saveToStorage();
	}

	/**
	 * Get favorite shapes
	 *
	 * @returns {Array<Object>} Favorite shape definitions
	 */
	getFavoriteShapes() {
		return Array.from( this.favoriteShapes )
			.map( ( id ) => this.getShapeById( id ) )
			.filter( ( shape ) => shape !== null );
	}

	/**
	 * Check if a shape is a favorite
	 *
	 * @param {string} shapeId - Shape identifier
	 * @returns {boolean} True if favorited
	 */
	isFavorite( shapeId ) {
		return this.favoriteShapes.has( shapeId );
	}

	/**
	 * Toggle favorite status for a shape
	 *
	 * @param {string} shapeId - Shape identifier
	 * @returns {boolean} New favorite status
	 */
	toggleFavorite( shapeId ) {
		if ( this.favoriteShapes.has( shapeId ) ) {
			this.favoriteShapes.delete( shapeId );
			this.saveToStorage();
			return false;
		}

		if ( this.favoriteShapes.size >= this.maxFavorites ) {
			// Don't add if at max
			return false;
		}

		this.favoriteShapes.add( shapeId );
		this.saveToStorage();
		return true;
	}

	/**
	 * Add a shape to favorites
	 *
	 * @param {string} shapeId - Shape identifier
	 * @returns {boolean} True if added
	 */
	addFavorite( shapeId ) {
		if ( this.favoriteShapes.size >= this.maxFavorites ) {
			return false;
		}
		this.favoriteShapes.add( shapeId );
		this.saveToStorage();
		return true;
	}

	/**
	 * Remove a shape from favorites
	 *
	 * @param {string} shapeId - Shape identifier
	 */
	removeFavorite( shapeId ) {
		this.favoriteShapes.delete( shapeId );
		this.saveToStorage();
	}

	/**
	 * Clear all favorites
	 */
	clearFavorites() {
		this.favoriteShapes.clear();
		this.saveToStorage();
	}

	/**
	 * Load state from localStorage
	 *
	 * @private
	 */
	loadFromStorage() {
		try {
			const stored = localStorage.getItem( this.storageKey );
			if ( stored ) {
				const data = JSON.parse( stored );
				if ( Array.isArray( data.recent ) ) {
					this.recentShapes = data.recent.slice( 0, this.maxRecent );
				}
				if ( Array.isArray( data.favorites ) ) {
					this.favoriteShapes = new Set( data.favorites.slice( 0, this.maxFavorites ) );
				}
			}
		} catch {
			// Storage unavailable or corrupt - start fresh
			this.recentShapes = [];
			this.favoriteShapes = new Set();
		}
	}

	/**
	 * Save state to localStorage
	 *
	 * @private
	 */
	saveToStorage() {
		try {
			const data = {
				recent: this.recentShapes,
				favorites: Array.from( this.favoriteShapes )
			};
			localStorage.setItem( this.storageKey, JSON.stringify( data ) );
		} catch {
			// Storage unavailable - fail silently
		}
	}

	/**
	 * Get shape statistics
	 *
	 * @returns {Object} Stats about the library
	 */
	getStats() {
		const allShapes = this.shapeData ? this.shapeData.getAllShapes() : [];
		const categories = this.getCategories();

		const shapesPerCategory = {};
		categories.forEach( ( cat ) => {
			shapesPerCategory[ cat.id ] = this.getShapesByCategory( cat.id ).length;
		} );

		return {
			totalShapes: allShapes.length,
			categoryCount: categories.length,
			shapesPerCategory: shapesPerCategory,
			recentCount: this.recentShapes.length,
			favoriteCount: this.favoriteShapes.size
		};
	}
}

// Export for browser (MediaWiki ResourceLoader)
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.ShapeLibrary = window.Layers.ShapeLibrary || {};
	window.Layers.ShapeLibrary.ShapeLibraryManager = ShapeLibraryManager;
	window.ShapeLibraryManager = ShapeLibraryManager;
}

// Export for Node.js (Jest tests)
if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = ShapeLibraryManager;
}
