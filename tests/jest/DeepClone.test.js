/**
 * Unit tests for DeepClone utility
 */

describe( 'DeepClone', () => {
	let deepClone, deepCloneArray, deepCloneLayer, omitProperty;

	beforeEach( () => {
		jest.resetModules();

		// Setup minimal window
		global.window = {
			Layers: {}
		};

		// Load DeepClone
		const module = require( '../../resources/ext.layers.shared/DeepClone.js' );
		deepClone = module.deepClone;
		deepCloneArray = module.deepCloneArray;
		deepCloneLayer = module.deepCloneLayer;
		omitProperty = module.omitProperty;
	} );

	afterEach( () => {
		delete global.window;
	} );

	describe( 'deepClone', () => {
		describe( 'primitives', () => {
			it( 'should return null for null', () => {
				expect( deepClone( null ) ).toBe( null );
			} );

			it( 'should return undefined for undefined', () => {
				expect( deepClone( undefined ) ).toBe( undefined );
			} );

			it( 'should return numbers as-is', () => {
				expect( deepClone( 42 ) ).toBe( 42 );
				expect( deepClone( 3.14 ) ).toBe( 3.14 );
				expect( deepClone( -1 ) ).toBe( -1 );
				expect( deepClone( 0 ) ).toBe( 0 );
			} );

			it( 'should return strings as-is', () => {
				expect( deepClone( 'hello' ) ).toBe( 'hello' );
				expect( deepClone( '' ) ).toBe( '' );
			} );

			it( 'should return booleans as-is', () => {
				expect( deepClone( true ) ).toBe( true );
				expect( deepClone( false ) ).toBe( false );
			} );
		} );

		describe( 'arrays', () => {
			it( 'should clone empty array', () => {
				const original = [];
				const cloned = deepClone( original );

				expect( cloned ).toEqual( [] );
				expect( cloned ).not.toBe( original );
			} );

			it( 'should clone array of primitives', () => {
				const original = [ 1, 2, 3 ];
				const cloned = deepClone( original );

				expect( cloned ).toEqual( [ 1, 2, 3 ] );
				expect( cloned ).not.toBe( original );
			} );

			it( 'should clone nested arrays', () => {
				const original = [ [ 1, 2 ], [ 3, 4 ] ];
				const cloned = deepClone( original );

				expect( cloned ).toEqual( [ [ 1, 2 ], [ 3, 4 ] ] );
				expect( cloned ).not.toBe( original );
				expect( cloned[ 0 ] ).not.toBe( original[ 0 ] );
			} );

			it( 'should clone array of objects', () => {
				const original = [ { a: 1 }, { b: 2 } ];
				const cloned = deepClone( original );

				expect( cloned ).toEqual( [ { a: 1 }, { b: 2 } ] );
				expect( cloned ).not.toBe( original );
				expect( cloned[ 0 ] ).not.toBe( original[ 0 ] );
			} );

			it( 'should not share references after modification', () => {
				const original = [ { value: 1 }, { value: 2 } ];
				const cloned = deepClone( original );

				cloned[ 0 ].value = 999;

				expect( original[ 0 ].value ).toBe( 1 );
				expect( cloned[ 0 ].value ).toBe( 999 );
			} );
		} );

		describe( 'objects', () => {
			it( 'should clone empty object', () => {
				const original = {};
				const cloned = deepClone( original );

				expect( cloned ).toEqual( {} );
				expect( cloned ).not.toBe( original );
			} );

			it( 'should clone simple object', () => {
				const original = { a: 1, b: 'two', c: true };
				const cloned = deepClone( original );

				expect( cloned ).toEqual( { a: 1, b: 'two', c: true } );
				expect( cloned ).not.toBe( original );
			} );

			it( 'should clone nested objects', () => {
				const original = { outer: { inner: { deep: 'value' } } };
				const cloned = deepClone( original );

				expect( cloned ).toEqual( { outer: { inner: { deep: 'value' } } } );
				expect( cloned ).not.toBe( original );
				expect( cloned.outer ).not.toBe( original.outer );
				expect( cloned.outer.inner ).not.toBe( original.outer.inner );
			} );

			it( 'should not share references after modification', () => {
				const original = { nested: { value: 1 } };
				const cloned = deepClone( original );

				cloned.nested.value = 999;

				expect( original.nested.value ).toBe( 1 );
				expect( cloned.nested.value ).toBe( 999 );
			} );
		} );

		describe( 'layer objects', () => {
			it( 'should clone a rectangle layer', () => {
				const original = {
					id: 'layer1',
					type: 'rectangle',
					x: 100,
					y: 200,
					width: 300,
					height: 150,
					fill: '#ff0000',
					stroke: '#000000',
					strokeWidth: 2,
					opacity: 0.8,
					rotation: 45
				};
				const cloned = deepClone( original );

				expect( cloned ).toEqual( original );
				expect( cloned ).not.toBe( original );

				// Modify clone, original should be unchanged
				cloned.x = 500;
				expect( original.x ).toBe( 100 );
			} );

			it( 'should clone a text layer', () => {
				const original = {
					id: 'text1',
					type: 'text',
					x: 50,
					y: 50,
					text: 'Hello World',
					fontSize: 24,
					fontFamily: 'Arial',
					fill: '#000000'
				};
				const cloned = deepClone( original );

				expect( cloned ).toEqual( original );
				expect( cloned ).not.toBe( original );
			} );

			it( 'should clone a path layer with points', () => {
				const original = {
					id: 'path1',
					type: 'path',
					points: [ { x: 0, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 50 } ],
					stroke: '#ff0000',
					strokeWidth: 3
				};
				const cloned = deepClone( original );

				expect( cloned ).toEqual( original );
				expect( cloned ).not.toBe( original );
				expect( cloned.points ).not.toBe( original.points );
				expect( cloned.points[ 0 ] ).not.toBe( original.points[ 0 ] );
			} );

			it( 'should clone a layer with shadow properties', () => {
				const original = {
					id: 'shadow1',
					type: 'rectangle',
					x: 10,
					y: 10,
					shadowBlur: 5,
					shadowColor: 'rgba(0,0,0,0.5)',
					shadowOffsetX: 3,
					shadowOffsetY: 3
				};
				const cloned = deepClone( original );

				expect( cloned ).toEqual( original );
				expect( cloned ).not.toBe( original );
			} );
		} );
	} );

	describe( 'deepCloneArray', () => {
		it( 'should clone array of layers', () => {
			const original = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' }
			];
			const cloned = deepCloneArray( original );

			expect( cloned ).toEqual( original );
			expect( cloned ).not.toBe( original );
			expect( cloned[ 0 ] ).not.toBe( original[ 0 ] );
		} );

		it( 'should return empty array for non-array input', () => {
			expect( deepCloneArray( null ) ).toEqual( [] );
			expect( deepCloneArray( undefined ) ).toEqual( [] );
			expect( deepCloneArray( 'string' ) ).toEqual( [] );
			expect( deepCloneArray( {} ) ).toEqual( [] );
		} );

		it( 'should handle empty array', () => {
			expect( deepCloneArray( [] ) ).toEqual( [] );
		} );
	} );

	describe( 'deepCloneLayer', () => {
		it( 'should clone a layer object', () => {
			const original = { id: 'layer1', type: 'rectangle', x: 100 };
			const cloned = deepCloneLayer( original );

			expect( cloned ).toEqual( original );
			expect( cloned ).not.toBe( original );
		} );

		it( 'should return null for null input', () => {
			expect( deepCloneLayer( null ) ).toBe( null );
		} );

		it( 'should return null for undefined input', () => {
			expect( deepCloneLayer( undefined ) ).toBe( null );
		} );

		it( 'should return null for non-object input', () => {
			expect( deepCloneLayer( 'string' ) ).toBe( null );
			expect( deepCloneLayer( 123 ) ).toBe( null );
		} );
	} );

	describe( 'exports', () => {
		it( 'should export to window.Layers.Utils namespace', () => {
			expect( window.Layers.Utils.deepClone ).toBeDefined();
			expect( window.Layers.Utils.deepCloneArray ).toBeDefined();
			expect( window.Layers.Utils.deepCloneLayer ).toBeDefined();
			expect( window.Layers.Utils.omitProperty ).toBeDefined();
		} );
	} );

	describe( 'omitProperty', () => {
		it( 'should return a new object without the specified property', () => {
			const original = { a: 1, b: 2, c: 3 };
			const result = omitProperty( original, 'b' );

			expect( result ).toEqual( { a: 1, c: 3 } );
			expect( result ).not.toBe( original );
			expect( original ).toEqual( { a: 1, b: 2, c: 3 } ); // Original unchanged
		} );

		it( 'should return copy if property does not exist', () => {
			const original = { a: 1, b: 2 };
			const result = omitProperty( original, 'notThere' );

			expect( result ).toEqual( { a: 1, b: 2 } );
			expect( result ).not.toBe( original );
		} );

		it( 'should handle empty object', () => {
			const original = {};
			const result = omitProperty( original, 'any' );

			expect( result ).toEqual( {} );
			expect( result ).not.toBe( original );
		} );

		it( 'should handle null input', () => {
			expect( omitProperty( null, 'prop' ) ).toBe( null );
		} );

		it( 'should handle undefined input', () => {
			expect( omitProperty( undefined, 'prop' ) ).toBe( undefined );
		} );

		it( 'should handle non-object input', () => {
			expect( omitProperty( 'string', 'prop' ) ).toBe( 'string' );
			expect( omitProperty( 123, 'prop' ) ).toBe( 123 );
			expect( omitProperty( true, 'prop' ) ).toBe( true );
		} );

		it( 'should work with layer objects - removing parentGroup', () => {
			const layer = {
				id: 'layer1',
				type: 'rectangle',
				x: 100,
				y: 200,
				parentGroup: 'group1'
			};
			const result = omitProperty( layer, 'parentGroup' );

			expect( result ).toEqual( {
				id: 'layer1',
				type: 'rectangle',
				x: 100,
				y: 200
			} );
			expect( result.parentGroup ).toBeUndefined();
			expect( layer.parentGroup ).toBe( 'group1' ); // Original unchanged
		} );

		it( 'should only copy own properties', () => {
			function Parent() {
				this.ownProp = 'owned';
			}
			Parent.prototype.inheritedProp = 'inherited';

			const original = new Parent();
			const result = omitProperty( original, 'ownProp' );

			expect( result ).toEqual( {} );
			expect( result.inheritedProp ).toBeUndefined();
		} );
	} );

	describe( 'fallback behaviors', () => {
		it( 'should fall back to JSON when structuredClone throws', () => {
			// Save original
			const originalStructuredClone = global.structuredClone;

			// Mock structuredClone to throw
			global.structuredClone = jest.fn( () => {
				throw new Error( 'DataCloneError' );
			} );

			// Reload module to pick up mock
			jest.resetModules();
			global.window = { Layers: {} };
			const freshModule = require( '../../resources/ext.layers.shared/DeepClone.js' );

			const original = { a: 1, b: { c: 2 } };
			const cloned = freshModule.deepClone( original );

			// Should succeed via JSON fallback
			expect( cloned ).toEqual( original );
			expect( cloned ).not.toBe( original );
			expect( global.structuredClone ).toHaveBeenCalled();

			// Restore
			global.structuredClone = originalStructuredClone;
		} );

		it( 'should return original object when both methods fail', () => {
			// Save originals
			const originalStructuredClone = global.structuredClone;
			const originalStringify = JSON.stringify;

			// Mock structuredClone to throw
			global.structuredClone = jest.fn( () => {
				throw new Error( 'DataCloneError' );
			} );

			// Mock JSON.stringify to throw
			JSON.stringify = jest.fn( () => {
				throw new Error( 'Converting circular structure' );
			} );

			// Setup mw.log.warn mock
			global.mw = {
				log: {
					warn: jest.fn()
				}
			};

			// Reload module
			jest.resetModules();
			global.window = { Layers: {} };
			const freshModule = require( '../../resources/ext.layers.shared/DeepClone.js' );

			const original = { self: null };
			const cloned = freshModule.deepClone( original );

			// Should return original object as last resort
			expect( cloned ).toBe( original );
			expect( global.mw.log.warn ).toHaveBeenCalledWith(
				'[DeepClone] Failed to clone object:',
				'Converting circular structure'
			);

			// Restore
			global.structuredClone = originalStructuredClone;
			JSON.stringify = originalStringify;
			delete global.mw;
		} );

		it( 'should handle failure without mw.log available', () => {
			// Save originals
			const originalStructuredClone = global.structuredClone;
			const originalStringify = JSON.stringify;

			// Mock structuredClone to throw
			global.structuredClone = jest.fn( () => {
				throw new Error( 'DataCloneError' );
			} );

			// Mock JSON.stringify to throw
			JSON.stringify = jest.fn( () => {
				throw new Error( 'Cannot serialize' );
			} );

			// Ensure mw is not defined
			delete global.mw;

			// Reload module
			jest.resetModules();
			global.window = { Layers: {} };
			const freshModule = require( '../../resources/ext.layers.shared/DeepClone.js' );

			const original = { data: 'test' };
			const cloned = freshModule.deepClone( original );

			// Should return original object silently
			expect( cloned ).toBe( original );

			// Restore
			global.structuredClone = originalStructuredClone;
			JSON.stringify = originalStringify;
		} );

		it( 'should use JSON fallback when structuredClone is not available', () => {
			// Save and remove structuredClone
			const originalStructuredClone = global.structuredClone;
			delete global.structuredClone;

			// Reload module
			jest.resetModules();
			global.window = { Layers: {} };
			const freshModule = require( '../../resources/ext.layers.shared/DeepClone.js' );

			const original = { nested: { value: 42 } };
			const cloned = freshModule.deepClone( original );

			// Should work via JSON fallback
			expect( cloned ).toEqual( original );
			expect( cloned ).not.toBe( original );
			expect( cloned.nested ).not.toBe( original.nested );

			// Restore
			global.structuredClone = originalStructuredClone;
		} );
	} );

	describe( 'cloneLayerEfficient', () => {
		let cloneLayerEfficient, cloneLayersEfficient;

		beforeEach( () => {
			jest.resetModules();
			global.window = { Layers: {} };
			const freshModule = require( '../../resources/ext.layers.shared/DeepClone.js' );
			cloneLayerEfficient = freshModule.cloneLayerEfficient;
			cloneLayersEfficient = freshModule.cloneLayersEfficient;
		} );

		it( 'should return null for null input', () => {
			expect( cloneLayerEfficient( null ) ).toBe( null );
		} );

		it( 'should return null for undefined input', () => {
			expect( cloneLayerEfficient( undefined ) ).toBe( null );
		} );

		it( 'should clone simple layer properties', () => {
			const layer = {
				id: 'layer1',
				type: 'rectangle',
				x: 100,
				y: 200,
				width: 50,
				height: 50
			};
			const cloned = cloneLayerEfficient( layer );

			expect( cloned ).toEqual( layer );
			expect( cloned ).not.toBe( layer );
		} );

		it( 'should preserve src property by reference (not deep clone)', () => {
			const largeBase64 = 'data:image/png;base64,' + 'A'.repeat( 10000 );
			const layer = {
				id: 'image1',
				type: 'image',
				src: largeBase64,
				x: 0,
				y: 0,
				width: 100,
				height: 100
			};
			const cloned = cloneLayerEfficient( layer );

			// src should be the same reference (not a deep copy)
			expect( cloned.src ).toBe( layer.src );
			// Other properties should be cloned
			expect( cloned.id ).toBe( layer.id );
		} );

		it( 'should preserve path property by reference (customShape)', () => {
			const svgPath = 'M0,0 L100,0 L100,100 L0,100 Z';
			const layer = {
				id: 'shape1',
				type: 'customShape',
				path: svgPath,
				viewBox: [ 0, 0, 100, 100 ],
				x: 50,
				y: 50,
				width: 100,
				height: 100
			};
			const cloned = cloneLayerEfficient( layer );

			// path should be the same reference (not a deep copy)
			expect( cloned.path ).toBe( layer.path );
			// viewBox should be a shallow copy
			expect( cloned.viewBox ).toEqual( layer.viewBox );
			expect( cloned.viewBox ).not.toBe( layer.viewBox );
		} );

		it( 'should deep clone points array for path layers', () => {
			const layer = {
				id: 'path1',
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 } ]
			};
			const cloned = cloneLayerEfficient( layer );

			// Points should be deep cloned
			expect( cloned.points ).toEqual( layer.points );
			expect( cloned.points ).not.toBe( layer.points );
			expect( cloned.points[ 0 ] ).not.toBe( layer.points[ 0 ] );
		} );

		it( 'should handle layer with both src and path (edge case)', () => {
			const layer = {
				id: 'combo1',
				type: 'customShape',
				src: 'data:image/png;base64,test',
				path: 'M0,0 L10,10',
				x: 0,
				y: 0
			};
			const cloned = cloneLayerEfficient( layer );

			expect( cloned.src ).toBe( layer.src );
			expect( cloned.path ).toBe( layer.path );
			expect( cloned.x ).toBe( layer.x );
		} );
	} );

	describe( 'cloneLayersEfficient', () => {
		let cloneLayersEfficient;

		beforeEach( () => {
			jest.resetModules();
			global.window = { Layers: {} };
			const freshModule = require( '../../resources/ext.layers.shared/DeepClone.js' );
			cloneLayersEfficient = freshModule.cloneLayersEfficient;
		} );

		it( 'should return empty array for null input', () => {
			expect( cloneLayersEfficient( null ) ).toEqual( [] );
		} );

		it( 'should return empty array for non-array input', () => {
			expect( cloneLayersEfficient( 'not an array' ) ).toEqual( [] );
		} );

		it( 'should clone array of layers', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle', x: 0, y: 0 },
				{ id: 'layer2', type: 'circle', x: 100, y: 100 }
			];
			const cloned = cloneLayersEfficient( layers );

			expect( cloned ).toEqual( layers );
			expect( cloned ).not.toBe( layers );
			expect( cloned[ 0 ] ).not.toBe( layers[ 0 ] );
			expect( cloned[ 1 ] ).not.toBe( layers[ 1 ] );
		} );

		it( 'should preserve references to immutable data in array', () => {
			const largeBase64 = 'data:image/png;base64,' + 'A'.repeat( 10000 );
			const layers = [
				{ id: 'image1', type: 'image', src: largeBase64, x: 0, y: 0 },
				{ id: 'shape1', type: 'customShape', path: 'M0,0 L10,10', x: 50, y: 50 }
			];
			const cloned = cloneLayersEfficient( layers );

			// src and path should be the same references
			expect( cloned[ 0 ].src ).toBe( layers[ 0 ].src );
			expect( cloned[ 1 ].path ).toBe( layers[ 1 ].path );
		} );

		it( 'should handle empty array', () => {
			expect( cloneLayersEfficient( [] ) ).toEqual( [] );
		} );
	} );
} );
