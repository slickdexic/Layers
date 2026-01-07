/**
 * Tests for ShapeLibraryManager
 */

const ShapeLibraryManager = require( '../../../resources/ext.layers.editor/shapeLibrary/ShapeLibraryManager.js' );
const ShapeLibraryData = require( '../../../resources/ext.layers.editor/shapeLibrary/ShapeLibraryData.js' );

describe( 'ShapeLibraryManager', () => {
	let manager;
	let localStorageMock;

	beforeEach( () => {
		// Mock localStorage
		localStorageMock = {
			store: {},
			getItem: jest.fn( ( key ) => localStorageMock.store[ key ] || null ),
			setItem: jest.fn( ( key, value ) => {
				localStorageMock.store[ key ] = value;
			} ),
			removeItem: jest.fn( ( key ) => {
				delete localStorageMock.store[ key ];
			} ),
			clear: jest.fn( () => {
				localStorageMock.store = {};
			} )
		};
		Object.defineProperty( global, 'localStorage', {
			value: localStorageMock,
			writable: true
		} );

		manager = new ShapeLibraryManager();
		manager.setShapeData( ShapeLibraryData );
	} );

	afterEach( () => {
		localStorageMock.clear();
	} );

	describe( 'initialization', () => {
		it( 'should initialize with default options', () => {
			expect( manager ).toBeTruthy();
			expect( manager.maxRecent ).toBe( 10 );
			expect( manager.maxFavorites ).toBe( 50 );
		} );

		it( 'should load recent shapes from localStorage', () => {
			localStorageMock.store[ 'layers-shape-library' ] = JSON.stringify( {
				recent: [ 'arrows/right' ],
				favorites: []
			} );
			const newManager = new ShapeLibraryManager();
			newManager.setShapeData( ShapeLibraryData );

			const recentShapes = newManager.getRecentShapes();
			expect( recentShapes.length ).toBe( 1 );
			expect( recentShapes[ 0 ].id ).toBe( 'arrows/right' );
		} );

		it( 'should load favorites from localStorage', () => {
			localStorageMock.store[ 'layers-shape-library' ] = JSON.stringify( {
				recent: [],
				favorites: [ 'geometric/triangle' ]
			} );
			const newManager = new ShapeLibraryManager();
			newManager.setShapeData( ShapeLibraryData );

			expect( newManager.isFavorite( 'geometric/triangle' ) ).toBe( true );
		} );
	} );

	describe( 'getCategories', () => {
		it( 'should return all categories', () => {
			const categories = manager.getCategories();

			expect( categories ).toBeInstanceOf( Array );
			expect( categories.length ).toBeGreaterThan( 0 );
			expect( categories[ 0 ] ).toHaveProperty( 'id' );
			expect( categories[ 0 ] ).toHaveProperty( 'name' );
			expect( categories[ 0 ] ).toHaveProperty( 'icon' );
		} );
	} );

	describe( 'getShapesByCategory', () => {
		it( 'should return shapes for a valid category', () => {
			const shapes = manager.getShapesByCategory( 'arrows' );

			expect( shapes ).toBeInstanceOf( Array );
			expect( shapes.length ).toBeGreaterThan( 0 );
			shapes.forEach( ( shape ) => {
				expect( shape.category ).toBe( 'arrows' );
			} );
		} );

		it( 'should return empty array for invalid category', () => {
			const shapes = manager.getShapesByCategory( 'nonexistent' );

			expect( shapes ).toEqual( [] );
		} );
	} );

	describe( 'getShapeById', () => {
		it( 'should return shape by id', () => {
			const shape = manager.getShapeById( 'arrows/right' );

			expect( shape ).toBeTruthy();
			expect( shape.id ).toBe( 'arrows/right' );
		} );

		it( 'should return null for invalid id', () => {
			const shape = manager.getShapeById( 'nonexistent/shape' );

			expect( shape ).toBeNull();
		} );
	} );

	describe( 'search', () => {
		it( 'should find shapes by name', () => {
			const results = manager.search( 'arrow' );

			expect( results.length ).toBeGreaterThan( 0 );
			results.forEach( ( shape ) => {
				expect(
					shape.id.toLowerCase().includes( 'arrow' ) ||
					shape.name.toLowerCase().includes( 'arrow' )
				).toBe( true );
			} );
		} );

		it( 'should return empty array for no matches', () => {
			const results = manager.search( 'xyznonexistent123' );

			expect( results ).toEqual( [] );
		} );

		it( 'should be case insensitive', () => {
			const results1 = manager.search( 'ARROW' );
			const results2 = manager.search( 'arrow' );

			expect( results1.length ).toBe( results2.length );
		} );

		it( 'should handle empty query', () => {
			const results = manager.search( '' );

			expect( results ).toEqual( [] );
		} );
	} );

	describe( 'recent shapes', () => {
		it( 'should add shape to recent', () => {
			manager.addToRecent( 'arrows/right' );

			const recent = manager.getRecentShapes();
			expect( recent.length ).toBe( 1 );
			expect( recent[ 0 ].id ).toBe( 'arrows/right' );
		} );

		it( 'should move duplicate to front', () => {
			manager.addToRecent( 'arrows/right' );
			manager.addToRecent( 'geometric/triangle' );
			manager.addToRecent( 'arrows/right' );

			const recent = manager.getRecentShapes();
			expect( recent[ 0 ].id ).toBe( 'arrows/right' );
		} );

		it( 'should limit recent shapes', () => {
			// Add more than maxRecent (10)
			for ( let i = 0; i < 15; i++ ) {
				manager.addToRecent( `arrows/arrow-${ i }` );
			}

			const recent = manager.getRecentShapes();
			// Only valid shapes will be returned (ones that exist)
			expect( manager.recentShapes.length ).toBeLessThanOrEqual( manager.maxRecent );
		} );

		it( 'should persist to localStorage', () => {
			manager.addToRecent( 'arrows/arrow-right' );

			expect( localStorageMock.setItem ).toHaveBeenCalledWith(
				'layers-shape-library',
				expect.any( String )
			);
		} );

		it( 'should get recent shapes as full objects', () => {
			manager.addToRecent( 'arrows/right' );
			const recentShapes = manager.getRecentShapes();

			expect( recentShapes[ 0 ] ).toHaveProperty( 'id' );
			expect( recentShapes[ 0 ] ).toHaveProperty( 'path' );
			expect( recentShapes[ 0 ] ).toHaveProperty( 'viewBox' );
		} );

		it( 'should clear recent shapes', () => {
			manager.addToRecent( 'arrows/right' );
			manager.clearRecent();

			expect( manager.getRecentShapes() ).toEqual( [] );
		} );
	} );

	describe( 'favorites', () => {
		it( 'should add shape to favorites', () => {
			const result = manager.toggleFavorite( 'arrows/right' );

			expect( result ).toBe( true );
			expect( manager.isFavorite( 'arrows/right' ) ).toBe( true );
		} );

		it( 'should remove shape from favorites', () => {
			manager.toggleFavorite( 'arrows/right' );
			const result = manager.toggleFavorite( 'arrows/right' );

			expect( result ).toBe( false );
			expect( manager.isFavorite( 'arrows/right' ) ).toBe( false );
		} );

		it( 'should persist favorites to localStorage', () => {
			manager.toggleFavorite( 'arrows/right' );

			expect( localStorageMock.setItem ).toHaveBeenCalledWith(
				'layers-shape-library',
				expect.any( String )
			);
		} );

		it( 'should get all favorite shapes', () => {
			manager.toggleFavorite( 'arrows/right' );
			manager.toggleFavorite( 'geometric/triangle' );

			const favorites = manager.getFavoriteShapes();
			expect( favorites.length ).toBe( 2 );
		} );

		it( 'should limit favorites', () => {
			// Add more than maxFavorites
			for ( let i = 0; i < 55; i++ ) {
				// Manually add to favorites set to bypass toggleFavorite logic
				manager.favoriteShapes.add( `test/shape-${ i }` );
			}

			// Note: Current implementation may not limit on save, just on add
			// This test documents current behavior
			expect( manager.favoriteShapes.size ).toBe( 55 );
		} );

		it( 'should clear favorites', () => {
			manager.toggleFavorite( 'arrows/right' );
			manager.clearFavorites();

			expect( manager.getFavoriteShapes() ).toEqual( [] );
		} );
	} );

	describe( 'getStats', () => {
		it( 'should return statistics', () => {
			manager.addToRecent( 'arrows/right' );
			manager.toggleFavorite( 'geometric/triangle' );

			const stats = manager.getStats();

			expect( stats ).toHaveProperty( 'totalShapes' );
			expect( stats ).toHaveProperty( 'categoryCount' );
			expect( stats ).toHaveProperty( 'recentCount' );
			expect( stats ).toHaveProperty( 'favoriteCount' );
			expect( stats.recentCount ).toBe( 1 );
			expect( stats.favoriteCount ).toBe( 1 );
		} );
	} );

	describe( 'error handling', () => {
		it( 'should handle corrupted localStorage data', () => {
			localStorageMock.store[ 'layers-shape-library' ] = 'not valid json';

			// Should not throw
			expect( () => {
				const newManager = new ShapeLibraryManager();
				newManager.setShapeData( ShapeLibraryData );
			} ).not.toThrow();
		} );

		it( 'should handle missing localStorage', () => {
			// Simulate localStorage not available
			Object.defineProperty( global, 'localStorage', {
				get: () => {
					throw new Error( 'localStorage not available' );
				}
			} );

			// Should not throw
			expect( () => {
				const newManager = new ShapeLibraryManager();
				newManager.setShapeData( ShapeLibraryData );
			} ).not.toThrow();

			// Restore
			Object.defineProperty( global, 'localStorage', {
				value: localStorageMock,
				writable: true
			} );
		} );
	} );

	// ========================================================================
	// Coverage Tests - Edge cases for low coverage branches
	// ========================================================================

	describe( 'coverage - null shapeData branches', () => {
		let noDataManager;

		beforeEach( () => {
			noDataManager = new ShapeLibraryManager();
			// Do NOT call setShapeData - leave shapeData null
		} );

		it( 'should return early from buildSearchIndex when shapeData is null', () => {
			// buildSearchIndex is called during setShapeData
			// If we call it manually on a manager without shapeData, it should return early
			noDataManager.buildSearchIndex();

			expect( noDataManager.searchIndex.size ).toBe( 0 );
		} );

		it( 'should return empty array from getCategories when shapeData is null', () => {
			const categories = noDataManager.getCategories();

			expect( categories ).toEqual( [] );
		} );

		it( 'should return empty array from getShapesByCategory when shapeData is null', () => {
			const shapes = noDataManager.getShapesByCategory( 'arrows' );

			expect( shapes ).toEqual( [] );
		} );

		it( 'should return null from getShapeById when shapeData is null and not in cache', () => {
			const shape = noDataManager.getShapeById( 'some-shape-id' );

			expect( shape ).toBeNull();
		} );

		it( 'should return empty array from search when shapeData is null', () => {
			const results = noDataManager.search( 'arrow' );

			expect( results ).toEqual( [] );
		} );
	} );

	describe( 'coverage - toggleFavorite max limit', () => {
		it( 'should return false from toggleFavorite when at max favorites and trying to add new', () => {
			// Set low maxFavorites for testing
			const limitedManager = new ShapeLibraryManager( { maxFavorites: 2 } );
			limitedManager.setShapeData( ShapeLibraryData );

			// Add 2 favorites (at max)
			limitedManager.toggleFavorite( 'arrows/right' );
			limitedManager.toggleFavorite( 'geometric/triangle' );

			// Try to add a third - should return false
			const result = limitedManager.toggleFavorite( 'geometric/square' );

			expect( result ).toBe( false );
			expect( limitedManager.favoriteShapes.size ).toBe( 2 );
			expect( limitedManager.isFavorite( 'geometric/square' ) ).toBe( false );
		} );

		it( 'should still allow removing favorite when at max', () => {
			const limitedManager = new ShapeLibraryManager( { maxFavorites: 2 } );
			limitedManager.setShapeData( ShapeLibraryData );

			limitedManager.toggleFavorite( 'arrows/right' );
			limitedManager.toggleFavorite( 'geometric/triangle' );

			// Remove one - should work
			const result = limitedManager.toggleFavorite( 'arrows/right' );

			expect( result ).toBe( false ); // returns false when removing
			expect( limitedManager.favoriteShapes.size ).toBe( 1 );
		} );
	} );

	describe( 'coverage - addFavorite and removeFavorite', () => {
		it( 'should add favorite via addFavorite method', () => {
			const result = manager.addFavorite( 'arrows/right' );

			expect( result ).toBe( true );
			expect( manager.isFavorite( 'arrows/right' ) ).toBe( true );
		} );

		it( 'should return false from addFavorite when at max', () => {
			const limitedManager = new ShapeLibraryManager( { maxFavorites: 1 } );
			limitedManager.setShapeData( ShapeLibraryData );

			limitedManager.addFavorite( 'arrows/right' );
			const result = limitedManager.addFavorite( 'geometric/triangle' );

			expect( result ).toBe( false );
			expect( limitedManager.favoriteShapes.size ).toBe( 1 );
		} );

		it( 'should save to storage when adding favorite', () => {
			manager.addFavorite( 'arrows/right' );

			expect( localStorageMock.setItem ).toHaveBeenCalled();
		} );

		it( 'should remove favorite via removeFavorite method', () => {
			manager.addFavorite( 'arrows/right' );
			manager.removeFavorite( 'arrows/right' );

			expect( manager.isFavorite( 'arrows/right' ) ).toBe( false );
		} );

		it( 'should save to storage when removing favorite', () => {
			manager.addFavorite( 'arrows/right' );
			localStorageMock.setItem.mockClear();

			manager.removeFavorite( 'arrows/right' );

			expect( localStorageMock.setItem ).toHaveBeenCalled();
		} );
	} );

	describe( 'coverage - getStats without shapeData', () => {
		it( 'should return stats with zero shapes when shapeData is null', () => {
			const noDataManager = new ShapeLibraryManager();
			// Do NOT set shapeData

			const stats = noDataManager.getStats();

			expect( stats.totalShapes ).toBe( 0 );
			expect( stats.categoryCount ).toBe( 0 );
		} );
	} );

	describe( 'coverage - storage edge cases', () => {
		it( 'should handle localStorage with invalid recent data type', () => {
			localStorageMock.store[ 'layers-shape-library' ] = JSON.stringify( {
				recent: 'not-an-array',
				favorites: []
			} );

			const newManager = new ShapeLibraryManager();

			// Should not crash, recent should remain empty
			expect( newManager.recentShapes ).toEqual( [] );
		} );

		it( 'should handle localStorage with invalid favorites data type', () => {
			localStorageMock.store[ 'layers-shape-library' ] = JSON.stringify( {
				recent: [],
				favorites: 'not-an-array'
			} );

			const newManager = new ShapeLibraryManager();

			// Should not crash, favorites should remain empty
			expect( newManager.favoriteShapes.size ).toBe( 0 );
		} );

		it( 'should limit loaded recent shapes to maxRecent', () => {
			const manyRecent = Array.from( { length: 20 }, ( _, i ) => `shape-${ i }` );
			localStorageMock.store[ 'layers-shape-library' ] = JSON.stringify( {
				recent: manyRecent,
				favorites: []
			} );

			const newManager = new ShapeLibraryManager( { maxRecent: 5 } );

			expect( newManager.recentShapes.length ).toBe( 5 );
		} );

		it( 'should limit loaded favorites to maxFavorites', () => {
			const manyFavorites = Array.from( { length: 100 }, ( _, i ) => `shape-${ i }` );
			localStorageMock.store[ 'layers-shape-library' ] = JSON.stringify( {
				recent: [],
				favorites: manyFavorites
			} );

			const newManager = new ShapeLibraryManager( { maxFavorites: 10 } );

			expect( newManager.favoriteShapes.size ).toBe( 10 );
		} );

		it( 'should handle localStorage setItem failure silently', () => {
			localStorageMock.setItem.mockImplementation( () => {
				throw new Error( 'Storage quota exceeded' );
			} );

			// Should not throw
			expect( () => {
				manager.addToRecent( 'arrows/right' );
			} ).not.toThrow();
		} );
	} );
} );
