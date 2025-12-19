/**
 * Tests for LayerDataNormalizer - shared utility for normalizing layer data
 */
'use strict';

// Load the module
require( '../../resources/ext.layers.shared/LayerDataNormalizer.js' );

describe( 'LayerDataNormalizer', () => {
	let LayerDataNormalizer;

	beforeEach( () => {
		LayerDataNormalizer = window.LayerDataNormalizer || window.Layers.LayerDataNormalizer;
	} );

	describe( 'normalizeLayer', () => {
		describe( 'boolean property normalization', () => {
			test( 'should convert string "true" to boolean true', () => {
				const layer = { shadow: 'true', textShadow: 'true', glow: 'true', visible: 'true', locked: 'true' };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.shadow ).toBe( true );
				expect( layer.textShadow ).toBe( true );
				expect( layer.glow ).toBe( true );
				expect( layer.visible ).toBe( true );
				expect( layer.locked ).toBe( true );
			} );

			test( 'should convert string "false" to boolean false', () => {
				const layer = { shadow: 'false', textShadow: 'false', glow: 'false', visible: 'false', locked: 'false' };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.shadow ).toBe( false );
				expect( layer.textShadow ).toBe( false );
				expect( layer.glow ).toBe( false );
				expect( layer.visible ).toBe( false );
				expect( layer.locked ).toBe( false );
			} );

			test( 'should convert string "1" to boolean true', () => {
				const layer = { shadow: '1', textShadow: '1', visible: '1' };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.shadow ).toBe( true );
				expect( layer.textShadow ).toBe( true );
				expect( layer.visible ).toBe( true );
			} );

			test( 'should convert string "0" to boolean false', () => {
				const layer = { shadow: '0', textShadow: '0', visible: '0' };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.shadow ).toBe( false );
				expect( layer.textShadow ).toBe( false );
				expect( layer.visible ).toBe( false );
			} );

			test( 'should convert numeric 1 to boolean true', () => {
				const layer = { shadow: 1, textShadow: 1, glow: 1 };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.shadow ).toBe( true );
				expect( layer.textShadow ).toBe( true );
				expect( layer.glow ).toBe( true );
			} );

			test( 'should convert numeric 0 to boolean false', () => {
				const layer = { shadow: 0, textShadow: 0, glow: 0 };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.shadow ).toBe( false );
				expect( layer.textShadow ).toBe( false );
				expect( layer.glow ).toBe( false );
			} );

			test( 'should convert empty string to boolean true (legacy data)', () => {
				const layer = { shadow: '', textShadow: '' };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.shadow ).toBe( true );
				expect( layer.textShadow ).toBe( true );
			} );

			test( 'should preserve actual boolean true', () => {
				const layer = { shadow: true, textShadow: true, visible: true };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.shadow ).toBe( true );
				expect( layer.textShadow ).toBe( true );
				expect( layer.visible ).toBe( true );
			} );

			test( 'should preserve actual boolean false', () => {
				const layer = { shadow: false, textShadow: false, visible: false };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.shadow ).toBe( false );
				expect( layer.textShadow ).toBe( false );
				expect( layer.visible ).toBe( false );
			} );

			test( 'should not add properties that do not exist', () => {
				const layer = { type: 'rectangle', x: 10, y: 20 };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.shadow ).toBeUndefined();
				expect( layer.textShadow ).toBeUndefined();
				expect( layer.glow ).toBeUndefined();
			} );

			test( 'should handle preserveAspectRatio boolean', () => {
				const layer = { preserveAspectRatio: 'true' };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.preserveAspectRatio ).toBe( true );

				const layer2 = { preserveAspectRatio: '0' };
				LayerDataNormalizer.normalizeLayer( layer2 );
				expect( layer2.preserveAspectRatio ).toBe( false );
			} );
		} );

		describe( 'numeric property normalization', () => {
			test( 'should convert string numbers to actual numbers', () => {
				const layer = { x: '100', y: '200', width: '50', height: '75' };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.x ).toBe( 100 );
				expect( layer.y ).toBe( 200 );
				expect( layer.width ).toBe( 50 );
				expect( layer.height ).toBe( 75 );
			} );

			test( 'should handle decimal string numbers', () => {
				const layer = { opacity: '0.5', rotation: '45.5', strokeWidth: '2.5' };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.opacity ).toBe( 0.5 );
				expect( layer.rotation ).toBe( 45.5 );
				expect( layer.strokeWidth ).toBe( 2.5 );
			} );

			test( 'should preserve actual numbers', () => {
				const layer = { x: 100, y: 200, opacity: 0.8 };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.x ).toBe( 100 );
				expect( layer.y ).toBe( 200 );
				expect( layer.opacity ).toBe( 0.8 );
			} );

			test( 'should not add numeric properties that do not exist', () => {
				const layer = { type: 'text', text: 'Hello' };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.x ).toBeUndefined();
				expect( layer.y ).toBeUndefined();
			} );

			test( 'should handle shadow numeric properties', () => {
				const layer = { shadowBlur: '10', shadowOffsetX: '5', shadowOffsetY: '5' };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.shadowBlur ).toBe( 10 );
				expect( layer.shadowOffsetX ).toBe( 5 );
				expect( layer.shadowOffsetY ).toBe( 5 );
			} );

			test( 'should handle text shadow numeric properties', () => {
				const layer = { textShadowBlur: '3', textShadowOffsetX: '2', textShadowOffsetY: '2' };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.textShadowBlur ).toBe( 3 );
				expect( layer.textShadowOffsetX ).toBe( 2 );
				expect( layer.textShadowOffsetY ).toBe( 2 );
			} );
		} );

		describe( 'points array normalization', () => {
			test( 'should normalize string coordinates in points array', () => {
				const layer = {
					type: 'path',
					points: [
						{ x: '10', y: '20' },
						{ x: '30', y: '40' }
					]
				};
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.points[ 0 ].x ).toBe( 10 );
				expect( layer.points[ 0 ].y ).toBe( 20 );
				expect( layer.points[ 1 ].x ).toBe( 30 );
				expect( layer.points[ 1 ].y ).toBe( 40 );
			} );

			test( 'should preserve numeric coordinates in points array', () => {
				const layer = {
					type: 'polygon',
					points: [
						{ x: 10, y: 20 },
						{ x: 30, y: 40 }
					]
				};
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.points[ 0 ].x ).toBe( 10 );
				expect( layer.points[ 0 ].y ).toBe( 20 );
			} );

			test( 'should handle empty points array', () => {
				const layer = { type: 'path', points: [] };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.points ).toEqual( [] );
			} );

			test( 'should handle invalid points gracefully', () => {
				const layer = { type: 'path', points: [ null, undefined, { x: '10', y: '20' } ] };
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.points[ 2 ].x ).toBe( 10 );
				expect( layer.points[ 2 ].y ).toBe( 20 );
			} );
		} );

		describe( 'edge cases', () => {
			test( 'should handle null layer', () => {
				expect( LayerDataNormalizer.normalizeLayer( null ) ).toBe( null );
			} );

			test( 'should handle undefined layer', () => {
				expect( LayerDataNormalizer.normalizeLayer( undefined ) ).toBe( undefined );
			} );

			test( 'should handle non-object layer', () => {
				expect( LayerDataNormalizer.normalizeLayer( 'string' ) ).toBe( 'string' );
				expect( LayerDataNormalizer.normalizeLayer( 123 ) ).toBe( 123 );
			} );

			test( 'should return the same layer object (for chaining)', () => {
				const layer = { shadow: 'true' };
				const result = LayerDataNormalizer.normalizeLayer( layer );
				expect( result ).toBe( layer );
			} );

			test( 'should handle mixed property types in same layer', () => {
				const layer = {
					type: 'textbox',
					x: '100',
					y: 200,
					shadow: 'true',
					textShadow: true,
					visible: 1,
					opacity: '0.8',
					text: 'Hello World'
				};
				LayerDataNormalizer.normalizeLayer( layer );
				expect( layer.x ).toBe( 100 );
				expect( layer.y ).toBe( 200 );
				expect( layer.shadow ).toBe( true );
				expect( layer.textShadow ).toBe( true );
				expect( layer.visible ).toBe( true );
				expect( layer.opacity ).toBe( 0.8 );
				expect( layer.text ).toBe( 'Hello World' ); // unchanged
			} );
		} );
	} );

	describe( 'normalizeLayers', () => {
		test( 'should normalize an array of layers', () => {
			const layers = [
				{ shadow: 'true', x: '10' },
				{ textShadow: 1, y: '20' },
				{ visible: 'false', opacity: '0.5' }
			];
			LayerDataNormalizer.normalizeLayers( layers );
			expect( layers[ 0 ].shadow ).toBe( true );
			expect( layers[ 0 ].x ).toBe( 10 );
			expect( layers[ 1 ].textShadow ).toBe( true );
			expect( layers[ 1 ].y ).toBe( 20 );
			expect( layers[ 2 ].visible ).toBe( false );
			expect( layers[ 2 ].opacity ).toBe( 0.5 );
		} );

		test( 'should handle empty array', () => {
			const layers = [];
			const result = LayerDataNormalizer.normalizeLayers( layers );
			expect( result ).toEqual( [] );
		} );

		test( 'should handle non-array input', () => {
			expect( LayerDataNormalizer.normalizeLayers( null ) ).toBe( null );
			expect( LayerDataNormalizer.normalizeLayers( undefined ) ).toBe( undefined );
			expect( LayerDataNormalizer.normalizeLayers( {} ) ).toEqual( {} );
		} );

		test( 'should return the same array (for chaining)', () => {
			const layers = [ { shadow: 'true' } ];
			const result = LayerDataNormalizer.normalizeLayers( layers );
			expect( result ).toBe( layers );
		} );
	} );

	describe( 'normalizeLayerData', () => {
		test( 'should normalize layers inside a layerData object', () => {
			const layerData = {
				layers: [
					{ shadow: 'true', textShadow: '1' },
					{ visible: 0, glow: 'false' }
				],
				baseWidth: 800,
				baseHeight: 600
			};
			LayerDataNormalizer.normalizeLayerData( layerData );
			expect( layerData.layers[ 0 ].shadow ).toBe( true );
			expect( layerData.layers[ 0 ].textShadow ).toBe( true );
			expect( layerData.layers[ 1 ].visible ).toBe( false );
			expect( layerData.layers[ 1 ].glow ).toBe( false );
		} );

		test( 'should handle layerData without layers array', () => {
			const layerData = { baseWidth: 800 };
			LayerDataNormalizer.normalizeLayerData( layerData );
			expect( layerData.layers ).toBeUndefined();
		} );

		test( 'should handle null/undefined layerData', () => {
			expect( LayerDataNormalizer.normalizeLayerData( null ) ).toBe( null );
			expect( LayerDataNormalizer.normalizeLayerData( undefined ) ).toBe( undefined );
		} );

		test( 'should return the same object (for chaining)', () => {
			const layerData = { layers: [ { shadow: 'true' } ] };
			const result = LayerDataNormalizer.normalizeLayerData( layerData );
			expect( result ).toBe( layerData );
		} );
	} );

	describe( 'utility methods', () => {
		describe( 'getBooleanProperties', () => {
			test( 'should return an array of boolean property names', () => {
				const props = LayerDataNormalizer.getBooleanProperties();
				expect( Array.isArray( props ) ).toBe( true );
				expect( props ).toContain( 'shadow' );
				expect( props ).toContain( 'textShadow' );
				expect( props ).toContain( 'glow' );
				expect( props ).toContain( 'visible' );
				expect( props ).toContain( 'locked' );
				expect( props ).toContain( 'preserveAspectRatio' );
			} );

			test( 'should return a copy (not the original array)', () => {
				const props1 = LayerDataNormalizer.getBooleanProperties();
				const props2 = LayerDataNormalizer.getBooleanProperties();
				expect( props1 ).not.toBe( props2 );
				props1.push( 'test' );
				expect( props2 ).not.toContain( 'test' );
			} );
		} );

		describe( 'getNumericProperties', () => {
			test( 'should return an array of numeric property names', () => {
				const props = LayerDataNormalizer.getNumericProperties();
				expect( Array.isArray( props ) ).toBe( true );
				expect( props ).toContain( 'x' );
				expect( props ).toContain( 'y' );
				expect( props ).toContain( 'width' );
				expect( props ).toContain( 'height' );
				expect( props ).toContain( 'opacity' );
				expect( props ).toContain( 'rotation' );
			} );

			test( 'should return a copy (not the original array)', () => {
				const props1 = LayerDataNormalizer.getNumericProperties();
				const props2 = LayerDataNormalizer.getNumericProperties();
				expect( props1 ).not.toBe( props2 );
			} );
		} );

		describe( 'toBoolean', () => {
			test( 'should convert true-like values to true', () => {
				expect( LayerDataNormalizer.toBoolean( true ) ).toBe( true );
				expect( LayerDataNormalizer.toBoolean( 'true' ) ).toBe( true );
				expect( LayerDataNormalizer.toBoolean( '1' ) ).toBe( true );
				expect( LayerDataNormalizer.toBoolean( 1 ) ).toBe( true );
				expect( LayerDataNormalizer.toBoolean( '' ) ).toBe( true );
			} );

			test( 'should convert false-like values to false', () => {
				expect( LayerDataNormalizer.toBoolean( false ) ).toBe( false );
				expect( LayerDataNormalizer.toBoolean( 'false' ) ).toBe( false );
				expect( LayerDataNormalizer.toBoolean( '0' ) ).toBe( false );
				expect( LayerDataNormalizer.toBoolean( 0 ) ).toBe( false );
			} );

			test( 'should return undefined for non-boolean values', () => {
				expect( LayerDataNormalizer.toBoolean( null ) ).toBe( undefined );
				expect( LayerDataNormalizer.toBoolean( undefined ) ).toBe( undefined );
				expect( LayerDataNormalizer.toBoolean( 'hello' ) ).toBe( undefined );
				expect( LayerDataNormalizer.toBoolean( 42 ) ).toBe( undefined );
			} );
		} );
	} );

	describe( 'namespace exports', () => {
		test( 'should be exported to window.LayerDataNormalizer', () => {
			expect( window.LayerDataNormalizer ).toBeDefined();
		} );

		test( 'should be exported to window.Layers.LayerDataNormalizer', () => {
			expect( window.Layers ).toBeDefined();
			expect( window.Layers.LayerDataNormalizer ).toBeDefined();
		} );

		test( 'both exports should reference the same class', () => {
			expect( window.LayerDataNormalizer ).toBe( window.Layers.LayerDataNormalizer );
		} );
	} );

	describe( 'real-world scenarios', () => {
		test( 'should handle text shadow bug scenario (string boolean from JSON)', () => {
			// This was the actual bug: textShadow came as "true" from the API
			const layerData = {
				layers: [ {
					type: 'textbox',
					textShadow: 'true',
					textShadowColor: '#000000',
					textShadowBlur: '3',
					textShadowOffsetX: '2',
					textShadowOffsetY: '2'
				} ]
			};
			LayerDataNormalizer.normalizeLayerData( layerData );

			const layer = layerData.layers[ 0 ];
			expect( layer.textShadow ).toBe( true );
			expect( layer.textShadowBlur ).toBe( 3 );
			expect( layer.textShadowOffsetX ).toBe( 2 );
			expect( layer.textShadowOffsetY ).toBe( 2 );

			// Now the strict equality check works
			expect( layer.textShadow === true ).toBe( true );
		} );

		test( 'should handle complex layer with all property types', () => {
			const layer = {
				id: 'layer_123',
				type: 'textbox',
				x: '100',
				y: '200',
				width: '300',
				height: '150',
				rotation: '0',
				visible: 'true',
				locked: 'false',
				shadow: '1',
				shadowColor: '#000000',
				shadowBlur: '10',
				shadowOffsetX: '5',
				shadowOffsetY: '5',
				textShadow: 1,
				textShadowColor: '#333333',
				textShadowBlur: '3',
				opacity: '0.9',
				fill: '#ffffff',
				stroke: '#000000',
				strokeWidth: '2',
				text: 'Hello World',
				fontSize: '24',
				fontFamily: 'Arial',
				cornerRadius: '5',
				padding: '10'
			};

			LayerDataNormalizer.normalizeLayer( layer );

			// Booleans
			expect( layer.visible ).toBe( true );
			expect( layer.locked ).toBe( false );
			expect( layer.shadow ).toBe( true );
			expect( layer.textShadow ).toBe( true );

			// Numbers
			expect( layer.x ).toBe( 100 );
			expect( layer.y ).toBe( 200 );
			expect( layer.width ).toBe( 300 );
			expect( layer.height ).toBe( 150 );
			expect( layer.rotation ).toBe( 0 );
			expect( layer.shadowBlur ).toBe( 10 );
			expect( layer.opacity ).toBe( 0.9 );
			expect( layer.fontSize ).toBe( 24 );
			expect( layer.cornerRadius ).toBe( 5 );
			expect( layer.padding ).toBe( 10 );

			// Strings remain unchanged
			expect( layer.id ).toBe( 'layer_123' );
			expect( layer.type ).toBe( 'textbox' );
			expect( layer.text ).toBe( 'Hello World' );
			expect( layer.fill ).toBe( '#ffffff' );
			expect( layer.stroke ).toBe( '#000000' );
			expect( layer.shadowColor ).toBe( '#000000' );
		} );
	} );
} );
