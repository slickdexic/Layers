/**
 * Jest tests for MessageHelper.js
 * Tests centralized i18n message handling functionality
 */
'use strict';

describe( 'MessageHelper', function () {
	let MessageHelper;
	let messageHelper;

	beforeAll( function () {
		// Load MessageHelper code via require for proper Jest coverage instrumentation
		const loaded = require( '../../resources/ext.layers.editor/MessageHelper.js' );
		MessageHelper = loaded.MessageHelper;

		// Also set up window exports for tests that check exports
		window.LayersMessageHelper = MessageHelper;
		window.layersMessages = loaded.messageHelper;
	} );

	beforeEach( function () {
		// Reset mw mock before each test
		global.mw = {
			message: jest.fn( function ( key ) {
				const messages = {
					'layers-save-success': 'Layers saved successfully',
					'layers-tool-select': 'Select Tool',
					'layers-greeting': 'Hello, $1! You have $2 layers.',
					'layers-missing': null
				};
				const text = messages[ key ];
				return {
					text: function () {
						return text || key;
					},
					exists: text !== null && text !== undefined
				};
			} ),
			msg: jest.fn( function ( key ) {
				return 'legacy-' + key;
			} )
		};

		// Create fresh instance for each test
		messageHelper = new MessageHelper();
	} );

	afterEach( function () {
		delete global.mw;
	} );

	describe( 'constructor', function () {
		it( 'should initialize with empty cache', function () {
			expect( messageHelper.cache ).toEqual( {} );
		} );

		it( 'should enable caching by default', function () {
			expect( messageHelper.cacheEnabled ).toBe( true );
		} );
	} );

	describe( 'get', function () {
		it( 'should return message from mw.message API', function () {
			const result = messageHelper.get( 'layers-save-success' );
			expect( result ).toBe( 'Layers saved successfully' );
		} );

		it( 'should return fallback for non-existent key', function () {
			const result = messageHelper.get( 'layers-nonexistent', 'Default text' );
			expect( result ).toBe( 'Default text' );
		} );

		it( 'should return key as fallback when no fallback provided', function () {
			const result = messageHelper.get( 'layers-unknown-key' );
			expect( result ).toBe( 'layers-unknown-key' );
		} );

		it( 'should return empty string for invalid key', function () {
			expect( messageHelper.get( null ) ).toBe( '' );
			expect( messageHelper.get( undefined ) ).toBe( '' );
			expect( messageHelper.get( '' ) ).toBe( '' );
		} );

		it( 'should return fallback for invalid key when provided', function () {
			expect( messageHelper.get( null, 'fallback' ) ).toBe( 'fallback' );
		} );

		it( 'should cache messages', function () {
			messageHelper.get( 'layers-save-success' );
			messageHelper.get( 'layers-save-success' );
			
			// mw.message should only be called once due to caching
			expect( mw.message ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should not cache when caching is disabled', function () {
			messageHelper.setCacheEnabled( false );
			
			messageHelper.get( 'layers-save-success' );
			messageHelper.get( 'layers-save-success' );
			
			// mw.message should be called twice when caching disabled
			expect( mw.message ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'should handle missing mw object gracefully', function () {
			delete global.mw;
			
			const result = messageHelper.get( 'layers-test', 'fallback' );
			expect( result ).toBe( 'fallback' );
		} );

		it( 'should use mw.msg as fallback when mw.message unavailable', function () {
			global.mw = {
				msg: jest.fn( function () {
					return 'from-mw-msg';
				} )
			};
			
			// Clear cache to force new lookup
			messageHelper.clearCache();
			const result = messageHelper.get( 'test-key' );
			expect( result ).toBe( 'from-mw-msg' );
		} );
	} );

	describe( 'getWithParams', function () {
		it( 'should substitute parameters in message', function () {
			// Mock mw.message to handle parameters
			global.mw.message = jest.fn( function ( key, ...params ) {
				if ( key === 'layers-greeting' && params.length === 2 ) {
					return {
						text: function () {
							return 'Hello, ' + params[ 0 ] + '! You have ' + params[ 1 ] + ' layers.';
						}
					};
				}
				return { text: function () { return key; } };
			} );

			const result = messageHelper.getWithParams( 'layers-greeting', 'User', 5 );
			expect( result ).toBe( 'Hello, User! You have 5 layers.' );
		} );

		it( 'should fall back to manual substitution when mw.message fails', function () {
			// Disable mw.message for params
			global.mw = undefined;
			
			// Pre-cache the message template
			messageHelper.cache[ 'test-template' ] = 'Value is $1 and $2';
			
			const result = messageHelper.getWithParams( 'test-template', 'A', 'B' );
			expect( result ).toBe( 'Value is A and B' );
		} );

		it( 'should handle numeric parameters', function () {
			global.mw = undefined;
			messageHelper.cache[ 'count-msg' ] = 'Count: $1';
			
			const result = messageHelper.getWithParams( 'count-msg', 42 );
			expect( result ).toBe( 'Count: 42' );
		} );
	} );

	describe( 'exists', function () {
		it( 'should return true for existing message', function () {
			expect( messageHelper.exists( 'layers-save-success' ) ).toBe( true );
		} );

		it( 'should return false for non-existing message', function () {
			global.mw.message = jest.fn( function () {
				return { exists: false };
			} );
			
			expect( messageHelper.exists( 'layers-nonexistent' ) ).toBe( false );
		} );

		it( 'should return false when mw is unavailable', function () {
			delete global.mw;
			expect( messageHelper.exists( 'any-key' ) ).toBe( false );
		} );

		it( 'should handle errors gracefully', function () {
			global.mw.message = jest.fn( function () {
				throw new Error( 'Test error' );
			} );
			
			expect( messageHelper.exists( 'error-key' ) ).toBe( false );
		} );
	} );

	describe( 'clearCache', function () {
		it( 'should clear all cached messages', function () {
			messageHelper.get( 'layers-save-success' );
			messageHelper.get( 'layers-tool-select' );
			
			expect( Object.keys( messageHelper.cache ).length ).toBe( 2 );
			
			messageHelper.clearCache();
			
			expect( messageHelper.cache ).toEqual( {} );
		} );
	} );

	describe( 'setCacheEnabled', function () {
		it( 'should enable caching', function () {
			messageHelper.setCacheEnabled( false );
			messageHelper.setCacheEnabled( true );
			
			expect( messageHelper.cacheEnabled ).toBe( true );
		} );

		it( 'should disable caching and clear cache', function () {
			messageHelper.get( 'layers-save-success' );
			expect( Object.keys( messageHelper.cache ).length ).toBe( 1 );
			
			messageHelper.setCacheEnabled( false );
			
			expect( messageHelper.cacheEnabled ).toBe( false );
			expect( messageHelper.cache ).toEqual( {} );
		} );

		it( 'should coerce truthy/falsy values', function () {
			messageHelper.setCacheEnabled( 1 );
			expect( messageHelper.cacheEnabled ).toBe( true );
			
			messageHelper.setCacheEnabled( 0 );
			expect( messageHelper.cacheEnabled ).toBe( false );
			
			messageHelper.setCacheEnabled( 'yes' );
			expect( messageHelper.cacheEnabled ).toBe( true );
		} );
	} );

	describe( 'exports', function () {
		it( 'should export MessageHelper class to window', function () {
			expect( window.LayersMessageHelper ).toBe( MessageHelper );
		} );

		it( 'should export singleton instance to window', function () {
			expect( window.layersMessages ).toBeDefined();
			expect( window.layersMessages instanceof MessageHelper ).toBe( true );
		} );
	} );

	describe( 'getColorPickerStrings', function () {
		it( 'should return all required color picker string keys', function () {
			const strings = messageHelper.getColorPickerStrings();

			expect( strings ).toHaveProperty( 'title' );
			expect( strings ).toHaveProperty( 'standard' );
			expect( strings ).toHaveProperty( 'saved' );
			expect( strings ).toHaveProperty( 'customSection' );
			expect( strings ).toHaveProperty( 'none' );
			expect( strings ).toHaveProperty( 'emptySlot' );
			expect( strings ).toHaveProperty( 'cancel' );
			expect( strings ).toHaveProperty( 'apply' );
			expect( strings ).toHaveProperty( 'transparent' );
			expect( strings ).toHaveProperty( 'swatchTemplate' );
			expect( strings ).toHaveProperty( 'previewTemplate' );
		} );

		it( 'should return localized strings from mw.message', function () {
			// Add color picker messages to mock
			const colorPickerMessages = {
				'layers-color-picker-title': 'Choose color',
				'layers-color-picker-standard': 'Standard colors',
				'layers-color-picker-saved': 'Saved colors',
				'layers-color-picker-custom-section': 'Custom color',
				'layers-color-picker-none': 'No fill (transparent)',
				'layers-color-picker-empty-slot': 'Empty slot - colors will be saved here automatically',
				'layers-color-picker-cancel': 'Cancel',
				'layers-color-picker-apply': 'Apply',
				'layers-color-picker-transparent': 'Transparent',
				'layers-color-picker-color-swatch': 'Set color to $1',
				'layers-color-picker-color-preview': 'Current color: $1'
			};

			global.mw.message = jest.fn( function ( key ) {
				const text = colorPickerMessages[ key ];
				return {
					text: function () {
						return text || key;
					},
					exists: text !== undefined
				};
			} );

			const strings = messageHelper.getColorPickerStrings();

			expect( strings.title ).toBe( 'Choose color' );
			expect( strings.apply ).toBe( 'Apply' );
			expect( strings.cancel ).toBe( 'Cancel' );
			expect( strings.transparent ).toBe( 'Transparent' );
		} );

		it( 'should provide fallback values when messages not found', function () {
			// Mock mw.message to return message doesn't exist
			global.mw.message = jest.fn( function () {
				return {
					text: function () {
						return '';
					},
					exists: false
				};
			} );

			const strings = messageHelper.getColorPickerStrings();

			// Should still have all required keys (with fallback values)
			expect( typeof strings.title ).toBe( 'string' );
			expect( typeof strings.apply ).toBe( 'string' );
		} );

		it( 'should be callable on the singleton instance', function () {
			const singleton = window.layersMessages;
			expect( typeof singleton.getColorPickerStrings ).toBe( 'function' );

			const strings = singleton.getColorPickerStrings();
			expect( strings ).toHaveProperty( 'title' );
		} );
	} );
} );
