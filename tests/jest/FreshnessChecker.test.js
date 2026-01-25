/**
 * Tests for FreshnessChecker module.
 *
 * @module tests/jest/FreshnessChecker.test
 */

/**
 * @jest-environment jsdom
 */

'use strict';

// Mock sessionStorage
const mockSessionStorage = ( function () {
	let store = {};
	return {
		getItem: jest.fn( ( key ) => store[ key ] || null ),
		setItem: jest.fn( ( key, value ) => {
			store[ key ] = String( value );
		} ),
		removeItem: jest.fn( ( key ) => {
			delete store[ key ];
		} ),
		clear: jest.fn( () => {
			store = {};
		} ),
		_getStore: () => store
	};
}() );

Object.defineProperty( window, 'sessionStorage', {
	value: mockSessionStorage
} );

// Mock mw object
global.mw = {
	log: jest.fn(),
	Api: jest.fn()
};
mw.log.warn = jest.fn();

// Import FreshnessChecker
const FreshnessChecker = require( '../../resources/ext.layers/viewer/FreshnessChecker.js' );

describe( 'FreshnessChecker', () => {
	let freshnessChecker;
	let mockApiGet;

	beforeEach( () => {
		jest.clearAllMocks();
		mockSessionStorage.clear();
		freshnessChecker = new FreshnessChecker( { debug: true } );

		// Setup default API mock
		mockApiGet = jest.fn();
		mw.Api.mockImplementation( () => ( {
			get: mockApiGet
		} ) );
	} );

	describe( 'constructor', () => {
		it( 'should create instance with debug enabled', () => {
			const checker = new FreshnessChecker( { debug: true } );
			expect( checker.debug ).toBe( true );
		} );

		it( 'should create instance with debug disabled by default', () => {
			const checker = new FreshnessChecker();
			expect( checker.debug ).toBeUndefined();
		} );

		it( 'should create instance with empty options', () => {
			const checker = new FreshnessChecker( {} );
			expect( checker ).toBeInstanceOf( FreshnessChecker );
		} );
	} );

	describe( 'getStorageKey', () => {
		it( 'should generate storage key with filename and setname', () => {
			const key = freshnessChecker.getStorageKey( 'Test Image.jpg', 'default' );
			expect( key ).toBe( 'layers-fresh-Test_Image.jpg:default' );
		} );

		it( 'should normalize spaces in filename', () => {
			const key = freshnessChecker.getStorageKey( 'My  Test  Image.jpg', 'annotations' );
			expect( key ).toBe( 'layers-fresh-My_Test_Image.jpg:annotations' );
		} );

		it( 'should use default for empty setname', () => {
			const key = freshnessChecker.getStorageKey( 'image.jpg', '' );
			expect( key ).toBe( 'layers-fresh-image.jpg:default' );
		} );

		it( 'should use default for null setname', () => {
			const key = freshnessChecker.getStorageKey( 'image.jpg', null );
			expect( key ).toBe( 'layers-fresh-image.jpg:default' );
		} );

		it( 'should handle empty filename', () => {
			const key = freshnessChecker.getStorageKey( '', 'default' );
			expect( key ).toBe( 'layers-fresh-:default' );
		} );
	} );

	describe( 'getCachedFreshness', () => {
		it( 'should return null when no cache exists', () => {
			const result = freshnessChecker.getCachedFreshness( 'image.jpg', 'default' );
			expect( result ).toBeNull();
		} );

		it( 'should return cached data when valid', () => {
			const cacheData = {
				revision: 5,
				timestamp: Date.now() // Fresh
			};
			mockSessionStorage.setItem( 'layers-fresh-image.jpg:default', JSON.stringify( cacheData ) );

			const result = freshnessChecker.getCachedFreshness( 'image.jpg', 'default' );
			expect( result ).not.toBeNull();
			expect( result.revision ).toBe( 5 );
		} );

		it( 'should return null and remove cache when expired', () => {
			const cacheData = {
				revision: 5,
				timestamp: Date.now() - 60000 // 60 seconds ago (expired)
			};
			mockSessionStorage.setItem( 'layers-fresh-image.jpg:default', JSON.stringify( cacheData ) );

			const result = freshnessChecker.getCachedFreshness( 'image.jpg', 'default' );
			expect( result ).toBeNull();
			expect( mockSessionStorage.removeItem ).toHaveBeenCalledWith( 'layers-fresh-image.jpg:default' );
		} );

		it( 'should return null on parse error', () => {
			mockSessionStorage.setItem( 'layers-fresh-image.jpg:default', 'invalid json' );

			// Temporarily silence console for this test
			const originalWarn = console.warn;
			console.warn = jest.fn();

			const result = freshnessChecker.getCachedFreshness( 'image.jpg', 'default' );
			expect( result ).toBeNull();

			console.warn = originalWarn;
		} );
	} );

	describe( 'setCachedFreshness', () => {
		it( 'should cache revision data', () => {
			freshnessChecker.setCachedFreshness( 'image.jpg', 'default', 10 );

			expect( mockSessionStorage.setItem ).toHaveBeenCalled();
			const call = mockSessionStorage.setItem.mock.calls[ 0 ];
			expect( call[ 0 ] ).toBe( 'layers-fresh-image.jpg:default' );

			const stored = JSON.parse( call[ 1 ] );
			expect( stored.revision ).toBe( 10 );
			expect( stored.timestamp ).toBeDefined();
		} );

		it( 'should not throw on storage error', () => {
			mockSessionStorage.setItem.mockImplementationOnce( () => {
				throw new Error( 'QuotaExceeded' );
			} );

			expect( () => {
				freshnessChecker.setCachedFreshness( 'image.jpg', 'default', 10 );
			} ).not.toThrow();
		} );
	} );

	describe( 'clearCache', () => {
		it( 'should remove cached data', () => {
			mockSessionStorage.setItem( 'layers-fresh-image.jpg:default', '{}' );

			freshnessChecker.clearCache( 'image.jpg', 'default' );

			expect( mockSessionStorage.removeItem ).toHaveBeenCalledWith( 'layers-fresh-image.jpg:default' );
		} );

		it( 'should use default setname when not provided', () => {
			freshnessChecker.clearCache( 'image.jpg' );

			expect( mockSessionStorage.removeItem ).toHaveBeenCalledWith( 'layers-fresh-image.jpg:default' );
		} );
	} );

	describe( 'checkFreshness', () => {
		let mockImg;

		beforeEach( () => {
			mockImg = document.createElement( 'img' );
		} );

		it( 'should return fresh when no revision attribute exists', async () => {
			mockImg.setAttribute( 'data-file-name', 'test.jpg' );
			// No data-layer-revision attribute

			const result = await freshnessChecker.checkFreshness( mockImg );

			expect( result.isFresh ).toBe( true );
			expect( result.inlineRevision ).toBeNull();
		} );

		it( 'should return fresh when no filename attribute exists', async () => {
			mockImg.setAttribute( 'data-layer-revision', '5' );
			// No data-file-name attribute

			const result = await freshnessChecker.checkFreshness( mockImg );

			expect( result.isFresh ).toBe( true );
		} );

		it( 'should use cache when available and valid', async () => {
			mockImg.setAttribute( 'data-layer-revision', '5' );
			mockImg.setAttribute( 'data-file-name', 'test.jpg' );
			mockImg.setAttribute( 'data-layer-setname', 'default' );

			// Setup cache with same revision (fresh)
			const cacheData = {
				revision: 5,
				timestamp: Date.now()
			};
			mockSessionStorage.setItem( 'layers-fresh-test.jpg:default', JSON.stringify( cacheData ) );

			const result = await freshnessChecker.checkFreshness( mockImg );

			expect( result.isFresh ).toBe( true );
			expect( result.inlineRevision ).toBe( 5 );
			expect( result.latestRevision ).toBe( 5 );
			expect( mockApiGet ).not.toHaveBeenCalled(); // No API call
		} );

		it( 'should return stale from cache when revision differs', async () => {
			mockImg.setAttribute( 'data-layer-revision', '5' );
			mockImg.setAttribute( 'data-file-name', 'test.jpg' );
			mockImg.setAttribute( 'data-layer-setname', 'default' );

			// Setup cache with newer revision (stale)
			const cacheData = {
				revision: 7,
				timestamp: Date.now()
			};
			mockSessionStorage.setItem( 'layers-fresh-test.jpg:default', JSON.stringify( cacheData ) );

			const result = await freshnessChecker.checkFreshness( mockImg );

			expect( result.isFresh ).toBe( false );
			expect( result.inlineRevision ).toBe( 5 );
			expect( result.latestRevision ).toBe( 7 );
		} );

		it( 'should query API when cache is empty', async () => {
			mockImg.setAttribute( 'data-layer-revision', '5' );
			mockImg.setAttribute( 'data-file-name', 'test.jpg' );
			mockImg.setAttribute( 'data-layer-setname', 'default' );

			mockApiGet.mockResolvedValue( {
				layersinfo: {
					layerset: {
						revision: 5,
						data: {
							layers: [ { id: '1', type: 'text' } ]
						}
					}
				}
			} );

			const result = await freshnessChecker.checkFreshness( mockImg );

			expect( mockApiGet ).toHaveBeenCalled();
			expect( result.isFresh ).toBe( true );
			expect( result.latestRevision ).toBe( 5 );
		} );

		it( 'should return stale with layer data when API has newer revision', async () => {
			mockImg.setAttribute( 'data-layer-revision', '5' );
			mockImg.setAttribute( 'data-file-name', 'test.jpg' );
			mockImg.setAttribute( 'data-layer-setname', 'default' );

			mockApiGet.mockResolvedValue( {
				layersinfo: {
					layerset: {
						revision: 8,
						baseWidth: 800,
						baseHeight: 600,
						data: {
							layers: [ { id: '1', type: 'text' }, { id: '2', type: 'arrow' } ],
							backgroundVisible: true,
							backgroundOpacity: 0.8
						}
					}
				}
			} );

			const result = await freshnessChecker.checkFreshness( mockImg );

			expect( result.isFresh ).toBe( false );
			expect( result.inlineRevision ).toBe( 5 );
			expect( result.latestRevision ).toBe( 8 );
			expect( result.layerData ).not.toBeNull();
			expect( result.layerData.layers ).toHaveLength( 2 );
			expect( result.layerData.baseWidth ).toBe( 800 );
			expect( result.layerData.backgroundOpacity ).toBe( 0.8 );
		} );

		it( 'should include setname in API request for non-default sets', async () => {
			mockImg.setAttribute( 'data-layer-revision', '3' );
			mockImg.setAttribute( 'data-file-name', 'test.jpg' );
			mockImg.setAttribute( 'data-layer-setname', 'anatomy-labels' );

			mockApiGet.mockResolvedValue( {
				layersinfo: {
					layerset: {
						revision: 3,
						data: { layers: [] }
					}
				}
			} );

			await freshnessChecker.checkFreshness( mockImg );

			expect( mockApiGet ).toHaveBeenCalledWith(
				expect.objectContaining( {
					setname: 'anatomy-labels'
				} )
			);
		} );

		it( 'should not include setname for default set', async () => {
			mockImg.setAttribute( 'data-layer-revision', '3' );
			mockImg.setAttribute( 'data-file-name', 'test.jpg' );
			mockImg.setAttribute( 'data-layer-setname', 'default' );

			mockApiGet.mockResolvedValue( {
				layersinfo: {
					layerset: {
						revision: 3,
						data: { layers: [] }
					}
				}
			} );

			await freshnessChecker.checkFreshness( mockImg );

			const apiCall = mockApiGet.mock.calls[ 0 ][ 0 ];
			expect( apiCall.setname ).toBeUndefined();
		} );

		it( 'should cache API result', async () => {
			mockImg.setAttribute( 'data-layer-revision', '5' );
			mockImg.setAttribute( 'data-file-name', 'test.jpg' );
			mockImg.setAttribute( 'data-layer-setname', 'default' );

			mockApiGet.mockResolvedValue( {
				layersinfo: {
					layerset: {
						revision: 5,
						data: { layers: [] }
					}
				}
			} );

			await freshnessChecker.checkFreshness( mockImg );

			expect( mockSessionStorage.setItem ).toHaveBeenCalled();
		} );

		it( 'should return fresh on API error', async () => {
			mockImg.setAttribute( 'data-layer-revision', '5' );
			mockImg.setAttribute( 'data-file-name', 'test.jpg' );
			mockImg.setAttribute( 'data-layer-setname', 'default' );

			mockApiGet.mockRejectedValue( new Error( 'Network error' ) );

			const result = await freshnessChecker.checkFreshness( mockImg );

			expect( result.isFresh ).toBe( true );
			expect( result.inlineRevision ).toBe( 5 );
		} );

		it( 'should return fresh when mw.Api is not available', async () => {
			mockImg.setAttribute( 'data-layer-revision', '5' );
			mockImg.setAttribute( 'data-file-name', 'test.jpg' );

			// Temporarily remove mw.Api
			const originalApi = mw.Api;
			delete mw.Api;

			const result = await freshnessChecker.checkFreshness( mockImg );

			expect( result.isFresh ).toBe( true );

			mw.Api = originalApi;
		} );

		it( 'should handle empty layerset response', async () => {
			mockImg.setAttribute( 'data-layer-revision', '5' );
			mockImg.setAttribute( 'data-file-name', 'test.jpg' );
			mockImg.setAttribute( 'data-layer-setname', 'default' );

			mockApiGet.mockResolvedValue( {
				layersinfo: {
					layerset: null
				}
			} );

			const result = await freshnessChecker.checkFreshness( mockImg );

			expect( result.isFresh ).toBe( true );
			expect( result.latestRevision ).toBeNull();
		} );
	} );

	describe( 'checkMultipleFreshness', () => {
		it( 'should check multiple images in parallel', async () => {
			const img1 = document.createElement( 'img' );
			img1.setAttribute( 'data-layer-revision', '5' );
			img1.setAttribute( 'data-file-name', 'test1.jpg' );
			img1.setAttribute( 'data-layer-setname', 'default' );

			const img2 = document.createElement( 'img' );
			img2.setAttribute( 'data-layer-revision', '3' );
			img2.setAttribute( 'data-file-name', 'test2.jpg' );
			img2.setAttribute( 'data-layer-setname', 'default' );

			mockApiGet
				.mockResolvedValueOnce( {
					layersinfo: {
						layerset: { revision: 5, data: { layers: [] } }
					}
				} )
				.mockResolvedValueOnce( {
					layersinfo: {
						layerset: { revision: 7, data: { layers: [ { id: '1' } ] } }
					}
				} );

			const results = await freshnessChecker.checkMultipleFreshness( [ img1, img2 ] );

			expect( results ).toBeInstanceOf( Map );
			expect( results.size ).toBe( 2 );

			const result1 = results.get( img1 );
			expect( result1.isFresh ).toBe( true );

			const result2 = results.get( img2 );
			expect( result2.isFresh ).toBe( false );
			expect( result2.latestRevision ).toBe( 7 );
		} );

		it( 'should return empty map for empty input', async () => {
			const results = await freshnessChecker.checkMultipleFreshness( [] );

			expect( results ).toBeInstanceOf( Map );
			expect( results.size ).toBe( 0 );
		} );
	} );

	describe( 'debug logging', () => {
		it( 'should log debug messages when debug is enabled', () => {
			const checker = new FreshnessChecker( { debug: true } );
			checker.debugLog( 'test message' );

			expect( mw.log ).toHaveBeenCalledWith(
				'[Layers:FreshnessChecker]',
				'test message'
			);
		} );

		it( 'should not log when debug is disabled', () => {
			const checker = new FreshnessChecker( { debug: false } );
			checker.debugLog( 'test message' );

			expect( mw.log ).not.toHaveBeenCalled();
		} );

		it( 'should log warnings when debug is enabled', () => {
			const checker = new FreshnessChecker( { debug: true } );
			checker.debugWarn( 'warning message' );

			expect( mw.log.warn ).toHaveBeenCalledWith(
				'[Layers:FreshnessChecker]',
				'warning message'
			);
		} );
	} );
} );
