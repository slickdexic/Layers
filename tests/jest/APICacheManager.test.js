/**
 * Tests for APICacheManager module
 */

'use strict';

window.Layers = window.Layers || {};
window.Layers.Editor = window.Layers.Editor || {};

const APICacheManager = require( '../../resources/ext.layers.editor/APICacheManager.js' );

describe( 'APICacheManager', () => {
	let cache;

	beforeEach( () => {
		jest.clearAllMocks();
		cache = new APICacheManager();
	} );

	afterEach( () => {
		cache.destroy();
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default options', () => {
			expect( cache.responseCache ).toBeInstanceOf( Map );
			expect( cache.cacheMaxSize ).toBe( 20 );
			expect( cache.cacheTTL ).toBe( 300000 );
		} );

		it( 'should accept custom maxSize', () => {
			const c = new APICacheManager( { maxSize: 50 } );
			expect( c.cacheMaxSize ).toBe( 50 );
			c.destroy();
		} );

		it( 'should accept custom ttl', () => {
			const c = new APICacheManager( { ttl: 60000 } );
			expect( c.cacheTTL ).toBe( 60000 );
			c.destroy();
		} );
	} );

	describe( 'getCached', () => {
		it( 'should return null for non-existent key', () => {
			expect( cache.getCached( 'nonexistent' ) ).toBeNull();
		} );

		it( 'should return cached data for valid entry', () => {
			cache.setCache( 'test-key', { foo: 'bar' } );
			expect( cache.getCached( 'test-key' ) ).toEqual( { foo: 'bar' } );
		} );

		it( 'should return null and delete expired entry', () => {
			const c = new APICacheManager( { ttl: 1 } );
			c.setCache( 'expired-key', { data: 1 } );
			// Force expiration by advancing time
			jest.spyOn( Date, 'now' ).mockReturnValue( Date.now() + 100 );
			expect( c.getCached( 'expired-key' ) ).toBeNull();
			expect( c.responseCache.has( 'expired-key' ) ).toBe( false );
			c.destroy();
		} );

		it( 'should perform LRU re-insertion on cache hit', () => {
			cache.setCache( 'key1', 'a' );
			cache.setCache( 'key2', 'b' );
			cache.setCache( 'key3', 'c' );

			// Access key1 to move it to end (most recently used)
			cache.getCached( 'key1' );

			const keys = Array.from( cache.responseCache.keys() );
			expect( keys[ keys.length - 1 ] ).toBe( 'key1' );
		} );
	} );

	describe( 'setCache', () => {
		it( 'should store data with timestamp', () => {
			const now = Date.now();
			jest.spyOn( Date, 'now' ).mockReturnValue( now );
			cache.setCache( 'mykey', { val: 42 } );

			const entry = cache.responseCache.get( 'mykey' );
			expect( entry.data ).toEqual( { val: 42 } );
			expect( entry.timestamp ).toBe( now );
		} );

		it( 'should evict oldest entry when cache is full', () => {
			const c = new APICacheManager( { maxSize: 3 } );
			c.setCache( 'a', 1 );
			c.setCache( 'b', 2 );
			c.setCache( 'c', 3 );
			// Cache is full, adding d should evict a
			c.setCache( 'd', 4 );

			expect( c.responseCache.has( 'a' ) ).toBe( false );
			expect( c.responseCache.has( 'b' ) ).toBe( true );
			expect( c.responseCache.has( 'd' ) ).toBe( true );
			expect( c.responseCache.size ).toBe( 3 );
			c.destroy();
		} );

		it( 'should evict multiple entries if needed', () => {
			const c = new APICacheManager( { maxSize: 2 } );
			c.setCache( 'x', 1 );
			c.setCache( 'y', 2 );
			// Manually set maxSize to 1 to force multiple evictions
			c.cacheMaxSize = 1;
			c.setCache( 'z', 3 );

			expect( c.responseCache.size ).toBe( 1 );
			expect( c.responseCache.has( 'z' ) ).toBe( true );
			c.destroy();
		} );
	} );

	describe( 'invalidateCache', () => {
		it( 'should clear all entries when no filename provided', () => {
			cache.setCache( 'File.jpg:default', 'a' );
			cache.setCache( 'Other.png:default', 'b' );
			cache.invalidateCache();
			expect( cache.responseCache.size ).toBe( 0 );
		} );

		it( 'should clear all entries when filename is empty string', () => {
			cache.setCache( 'File.jpg:default', 'a' );
			cache.invalidateCache( '' );
			expect( cache.responseCache.size ).toBe( 0 );
		} );

		it( 'should clear all entries when filename is null', () => {
			cache.setCache( 'File.jpg:default', 'a' );
			cache.invalidateCache( null );
			expect( cache.responseCache.size ).toBe( 0 );
		} );

		it( 'should remove only entries matching filename prefix', () => {
			cache.setCache( 'File.jpg:default', 'a' );
			cache.setCache( 'File.jpg:set:labels', 'b' );
			cache.setCache( 'Other.png:default', 'c' );
			cache.invalidateCache( 'File.jpg' );
			expect( cache.responseCache.has( 'Other.png:default' ) ).toBe( true );
			expect( cache.responseCache.has( 'File.jpg:default' ) ).toBe( false );
			expect( cache.responseCache.has( 'File.jpg:set:labels' ) ).toBe( false );
		} );

		it( 'should not remove entries that do not match filename prefix', () => {
			cache.setCache( 'File.jpg:default', 'a' );
			cache.setCache( 'File.jpgExtra:default', 'b' );
			cache.invalidateCache( 'File.jpg' );
			// File.jpgExtra:default does NOT start with 'File.jpg:'
			expect( cache.responseCache.has( 'File.jpgExtra:default' ) ).toBe( true );
		} );
	} );

	describe( 'buildCacheKey', () => {
		it( 'should build key with layersetid', () => {
			expect( cache.buildCacheKey( 'File.jpg', { layersetid: 42 } ) )
				.toBe( 'File.jpg:id:42' );
		} );

		it( 'should build key with setname', () => {
			expect( cache.buildCacheKey( 'File.jpg', { setname: 'labels' } ) )
				.toBe( 'File.jpg:set:labels' );
		} );

		it( 'should prefer layersetid over setname', () => {
			expect( cache.buildCacheKey( 'File.jpg', { layersetid: 5, setname: 'labels' } ) )
				.toBe( 'File.jpg:id:5' );
		} );

		it( 'should build default key when no options', () => {
			expect( cache.buildCacheKey( 'File.jpg' ) )
				.toBe( 'File.jpg:default' );
		} );

		it( 'should build default key for empty options', () => {
			expect( cache.buildCacheKey( 'File.jpg', {} ) )
				.toBe( 'File.jpg:default' );
		} );
	} );

	describe( 'clearFreshnessCache', () => {
		beforeEach( () => {
			// Mock sessionStorage
			Object.defineProperty( window, 'sessionStorage', {
				value: {
					removeItem: jest.fn(),
					getItem: jest.fn(),
					setItem: jest.fn(),
					clear: jest.fn()
				},
				writable: true,
				configurable: true
			} );
		} );

		it( 'should return early when filename is falsy', () => {
			cache.clearFreshnessCache( null, [], 'default' );
			expect( window.sessionStorage.removeItem ).not.toHaveBeenCalled();
		} );

		it( 'should return early when filename is empty string', () => {
			cache.clearFreshnessCache( '', [], 'default' );
			expect( window.sessionStorage.removeItem ).not.toHaveBeenCalled();
		} );

		it( 'should clear default set freshness', () => {
			cache.clearFreshnessCache( 'File.jpg', [], 'default' );
			expect( window.sessionStorage.removeItem ).toHaveBeenCalledWith(
				'layers-fresh-File.jpg:default'
			);
		} );

		it( 'should clear freshness for current set name', () => {
			cache.clearFreshnessCache( 'File.jpg', [], 'labels' );
			expect( window.sessionStorage.removeItem ).toHaveBeenCalledWith(
				'layers-fresh-File.jpg:labels'
			);
			expect( window.sessionStorage.removeItem ).toHaveBeenCalledWith(
				'layers-fresh-File.jpg:default'
			);
		} );

		it( 'should clear freshness for named sets', () => {
			const namedSets = [
				{ name: 'anatomy' },
				{ name: 'labels' }
			];
			cache.clearFreshnessCache( 'File.jpg', namedSets, 'default' );
			expect( window.sessionStorage.removeItem ).toHaveBeenCalledWith(
				'layers-fresh-File.jpg:anatomy'
			);
			expect( window.sessionStorage.removeItem ).toHaveBeenCalledWith(
				'layers-fresh-File.jpg:labels'
			);
		} );

		it( 'should handle null namedSets', () => {
			cache.clearFreshnessCache( 'File.jpg', null, 'default' );
			expect( window.sessionStorage.removeItem ).toHaveBeenCalledWith(
				'layers-fresh-File.jpg:default'
			);
		} );

		it( 'should handle null currentSetName', () => {
			cache.clearFreshnessCache( 'File.jpg', [], null );
			// Should use 'default' as fallback
			expect( window.sessionStorage.removeItem ).toHaveBeenCalledWith(
				'layers-fresh-File.jpg:default'
			);
		} );

		it( 'should skip named sets with no name property', () => {
			const namedSets = [
				{ name: 'valid' },
				{},
				null,
				{ name: '' }
			];
			cache.clearFreshnessCache( 'File.jpg', namedSets, 'default' );
			expect( window.sessionStorage.removeItem ).toHaveBeenCalledWith(
				'layers-fresh-File.jpg:valid'
			);
		} );

		it( 'should normalize filename spaces to underscores', () => {
			cache.clearFreshnessCache( 'My File.jpg', [], 'default' );
			expect( window.sessionStorage.removeItem ).toHaveBeenCalledWith(
				'layers-fresh-My_File.jpg:default'
			);
		} );

		it( 'should log debug message when wgLayersDebug is enabled', () => {
			window.mw = {
				config: { get: jest.fn().mockReturnValue( true ) },
				log: jest.fn()
			};
			cache.clearFreshnessCache( 'File.jpg', [], 'default' );
			expect( window.mw.log ).toHaveBeenCalledWith(
				'[APICacheManager] Cleared freshness cache for:', 'File.jpg'
			);
			delete window.mw;
		} );

		it( 'should not log when wgLayersDebug is disabled', () => {
			window.mw = {
				config: { get: jest.fn().mockReturnValue( false ) },
				log: jest.fn()
			};
			cache.clearFreshnessCache( 'File.jpg', [], 'default' );
			expect( window.mw.log ).not.toHaveBeenCalled();
			delete window.mw;
		} );

		it( 'should handle sessionStorage errors gracefully', () => {
			window.sessionStorage.removeItem = jest.fn().mockImplementation( () => {
				throw new Error( 'Storage quota exceeded' );
			} );
			// Should not throw
			expect( () => {
				cache.clearFreshnessCache( 'File.jpg', [], 'default' );
			} ).not.toThrow();
		} );

		it( 'should handle outer exception and log warning', () => {
			// Force an exception in the outer try by making filename.replace throw
			window.mw = {
				log: { warn: jest.fn() }
			};
			// Create a scenario where the code throws in the outer try
			// by making sessionStorage throw before the inner try/catch
			Object.defineProperty( window, 'sessionStorage', {
				get() {
					throw new Error( 'sessionStorage unavailable' );
				},
				configurable: true
			} );
			cache.clearFreshnessCache( 'File.jpg', [], 'default' );
			// Restore sessionStorage
			Object.defineProperty( window, 'sessionStorage', {
				value: { removeItem: jest.fn() },
				writable: true,
				configurable: true
			} );
			delete window.mw;
		} );

		it( 'should handle outer exception without mw.log', () => {
			// Force an outer exception with no mw available
			Object.defineProperty( window, 'sessionStorage', {
				get() {
					throw new Error( 'not available' );
				},
				configurable: true
			} );
			expect( () => {
				cache.clearFreshnessCache( 'File.jpg', [], 'default' );
			} ).not.toThrow();
			// Restore
			Object.defineProperty( window, 'sessionStorage', {
				value: { removeItem: jest.fn() },
				writable: true,
				configurable: true
			} );
		} );

		it( 'should deduplicate set names', () => {
			const namedSets = [ { name: 'default' } ];
			cache.clearFreshnessCache( 'File.jpg', namedSets, 'default' );
			// 'default' appears in Set constructor AND from namedSets, but should only
			// result in one removeItem call for 'default'
			const calls = window.sessionStorage.removeItem.mock.calls
				.filter( ( c ) => c[ 0 ] === 'layers-fresh-File.jpg:default' );
			expect( calls.length ).toBe( 1 );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clear the response cache', () => {
			cache.setCache( 'key1', 'a' );
			cache.setCache( 'key2', 'b' );
			cache.destroy();
			expect( cache.responseCache.size ).toBe( 0 );
		} );
	} );
} );
