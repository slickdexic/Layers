/**
 * Unit tests for DeepClone utility
 */

describe( 'DeepClone', () => {
	let deepClone, deepCloneArray, deepCloneLayer;

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
		} );
	} );
} );
