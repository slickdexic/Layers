/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Tests for NamespaceHelper
 *
 * NamespaceHelper provides utilities for resolving classes from the Layers
 * namespace with graceful fallback to global scope.
 */

describe( 'NamespaceHelper', () => {
	let originalLayers;
	let originalGlobal;

	beforeEach( () => {
		jest.resetModules();

		// Store original values
		originalLayers = window.Layers;
		originalGlobal = { ...global };

		// Clean state
		delete window.Layers;
		delete window.layersGetClass;
	} );

	afterEach( () => {
		// Restore original values
		window.Layers = originalLayers;
		Object.assign( global, originalGlobal );
	} );

	describe( 'getClass', () => {
		it( 'should export getClass to window.Layers.Utils', () => {
			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			expect( window.Layers.Utils.getClass ).toBeDefined();
			expect( typeof window.Layers.Utils.getClass ).toBe( 'function' );
		} );

		it( 'should export getClass to window.layersGetClass', () => {
			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			expect( window.layersGetClass ).toBeDefined();
			expect( typeof window.layersGetClass ).toBe( 'function' );
		} );

		it( 'should resolve class from namespace path', () => {
			// Setup namespace before loading
			window.Layers = {
				Utils: {
					TestClass: function TestClass() {}
				}
			};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.getClass( 'Utils.TestClass', 'TestClass' );

			expect( result ).toBe( window.Layers.Utils.TestClass );
		} );

		it( 'should fall back to global when namespace not found', () => {
			const globalClass = function GlobalClass() {};
			window.GlobalTestClass = globalClass;

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.getClass( 'NonExistent.Path', 'GlobalTestClass' );

			expect( result ).toBe( globalClass );

			delete window.GlobalTestClass;
		} );

		it( 'should return null when class not found anywhere', () => {
			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.getClass( 'Does.Not.Exist', 'DoesNotExist' );

			expect( result ).toBeNull();
		} );

		it( 'should resolve deeply nested namespace paths', () => {
			window.Layers = {
				UI: {
					Components: {
						ColorPickerDialog: function ColorPickerDialog() {}
					}
				}
			};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.getClass(
				'UI.Components.ColorPickerDialog',
				'ColorPickerDialog'
			);

			expect( result ).toBe( window.Layers.UI.Components.ColorPickerDialog );
		} );

		it( 'should handle partial namespace path gracefully', () => {
			window.Layers = {
				UI: {}
				// Missing ColorPickerDialog
			};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.getClass(
				'UI.ColorPickerDialog',
				'NonExistent'
			);

			expect( result ).toBeNull();
		} );

		it( 'should fall back to Node global in test environment', () => {
			jest.resetModules();
			delete window.Layers;
			delete window.layersGetClass;

			// Set up global fallback
			global.TestGlobalClass = function TestGlobalClass() {};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.getClass( 'Does.Not.Exist', 'TestGlobalClass' );

			expect( result ).toBe( global.TestGlobalClass );

			delete global.TestGlobalClass;
		} );
	} );

	describe( 'resolveClasses', () => {
		it( 'should export resolveClasses to window.Layers.Utils', () => {
			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			expect( window.Layers.Utils.resolveClasses ).toBeDefined();
			expect( typeof window.Layers.Utils.resolveClasses ).toBe( 'function' );
		} );

		it( 'should resolve multiple classes at once', () => {
			const ClassA = function ClassA() {};
			const ClassB = function ClassB() {};

			window.Layers = {
				Core: {
					ClassA: ClassA
				},
				Utils: {
					ClassB: ClassB
				}
			};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.resolveClasses( {
				'Core.ClassA': 'ClassA',
				'Utils.ClassB': 'ClassB'
			} );

			expect( result.ClassA ).toBe( ClassA );
			expect( result.ClassB ).toBe( ClassB );
		} );

		it( 'should handle missing classes in resolution', () => {
			window.Layers = {};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.resolveClasses( {
				'Missing.ClassA': 'ClassA',
				'Missing.ClassB': 'ClassB'
			} );

			expect( result.ClassA ).toBeNull();
			expect( result.ClassB ).toBeNull();
		} );

		it( 'should mix found and missing classes', () => {
			const FoundClass = function FoundClass() {};

			window.Layers = {
				Core: {
					FoundClass: FoundClass
				}
			};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.resolveClasses( {
				'Core.FoundClass': 'FoundClass',
				'Missing.MissingClass': 'MissingClass'
			} );

			expect( result.FoundClass ).toBe( FoundClass );
			expect( result.MissingClass ).toBeNull();
		} );
	} );

	describe( 'classExists', () => {
		it( 'should export classExists to window.Layers.Utils', () => {
			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			expect( window.Layers.Utils.classExists ).toBeDefined();
			expect( typeof window.Layers.Utils.classExists ).toBe( 'function' );
		} );

		it( 'should return true when class exists in namespace', () => {
			window.Layers = {
				Core: {
					ExistingClass: function () {}
				}
			};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.classExists( 'Core.ExistingClass', 'ExistingClass' );

			expect( result ).toBe( true );
		} );

		it( 'should return true when class exists in global scope', () => {
			window.GlobalExistingClass = function () {};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.classExists( 'Does.Not.Exist', 'GlobalExistingClass' );

			expect( result ).toBe( true );

			delete window.GlobalExistingClass;
		} );

		it( 'should return false when class does not exist', () => {
			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			const result = window.Layers.Utils.classExists( 'Does.Not.Exist', 'DoesNotExist' );

			expect( result ).toBe( false );
		} );
	} );

	describe( 'namespace initialization', () => {
		it( 'should create Layers namespace if not exists', () => {
			delete window.Layers;

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			expect( window.Layers ).toBeDefined();
			expect( window.Layers.Utils ).toBeDefined();
		} );

		it( 'should not overwrite existing Layers namespace', () => {
			const existingClass = function () {};
			window.Layers = {
				Existing: {
					Class: existingClass
				}
			};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			expect( window.Layers.Existing.Class ).toBe( existingClass );
			expect( window.Layers.Utils.getClass ).toBeDefined();
		} );

		it( 'should not overwrite existing Utils namespace', () => {
			const existingUtil = function () {};
			window.Layers = {
				Utils: {
					ExistingUtil: existingUtil
				}
			};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			expect( window.Layers.Utils.ExistingUtil ).toBe( existingUtil );
			expect( window.Layers.Utils.getClass ).toBeDefined();
		} );
	} );
} );
