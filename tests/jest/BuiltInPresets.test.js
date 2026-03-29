/**
 * Tests for BuiltInPresets module
 *
 * @file
 */

'use strict';

const BuiltInPresets = require( '../../resources/ext.layers.editor/presets/BuiltInPresets.js' );

describe( 'BuiltInPresets', () => {
	describe( 'static getForTool', () => {
		test( 'returns array of presets for supported tool', () => {
			const arrowPresets = BuiltInPresets.getForTool( 'arrow' );
			expect( Array.isArray( arrowPresets ) ).toBe( true );
			expect( arrowPresets.length ).toBeGreaterThan( 0 );
		} );

		test( 'each preset has required properties', () => {
			const presets = BuiltInPresets.getForTool( 'arrow' );
			presets.forEach( ( preset ) => {
				expect( preset ).toHaveProperty( 'id' );
				expect( preset ).toHaveProperty( 'name' );
				expect( preset ).toHaveProperty( 'builtIn', true );
				expect( preset ).toHaveProperty( 'style' );
			} );
		} );

		test( 'returns empty array for unsupported tool', () => {
			const result = BuiltInPresets.getForTool( 'unsupported' );
			expect( result ).toEqual( [] );
		} );

		test( 'returns empty array for path tool (no built-in presets)', () => {
			const result = BuiltInPresets.getForTool( 'path' );
			expect( result ).toEqual( [] );
		} );
	} );

	describe( 'static getById', () => {
		test( 'finds preset by ID', () => {
			const preset = BuiltInPresets.getById( 'arrow', 'builtin-arrow-default' );
			expect( preset ).not.toBeNull();
			expect( preset.id ).toBe( 'builtin-arrow-default' );
			expect( preset.name ).toBe( 'Default Arrow' );
		} );

		test( 'returns null for non-existent ID', () => {
			const preset = BuiltInPresets.getById( 'arrow', 'non-existent' );
			expect( preset ).toBeNull();
		} );

		test( 'returns null for wrong tool type', () => {
			const preset = BuiltInPresets.getById( 'text', 'builtin-arrow-default' );
			expect( preset ).toBeNull();
		} );
	} );

	describe( 'static getDefault', () => {
		test( 'returns first preset for tool', () => {
			const defaultPreset = BuiltInPresets.getDefault( 'arrow' );
			expect( defaultPreset ).not.toBeNull();
			expect( defaultPreset.id ).toBe( 'builtin-arrow-default' );
		} );

		test( 'returns null for tool with no presets', () => {
			const defaultPreset = BuiltInPresets.getDefault( 'path' );
			expect( defaultPreset ).toBeNull();
		} );

		test( 'returns null for unsupported tool', () => {
			const defaultPreset = BuiltInPresets.getDefault( 'unsupported' );
			expect( defaultPreset ).toBeNull();
		} );
	} );

	describe( 'static getSupportedTools', () => {
		test( 'returns array of tool names', () => {
			const tools = BuiltInPresets.getSupportedTools();
			expect( Array.isArray( tools ) ).toBe( true );
			expect( tools ).toContain( 'arrow' );
			expect( tools ).toContain( 'text' );
			expect( tools ).toContain( 'rectangle' );
		} );

		test( 'returns a copy, not the original array', () => {
			const tools1 = BuiltInPresets.getSupportedTools();
			const tools2 = BuiltInPresets.getSupportedTools();
			expect( tools1 ).not.toBe( tools2 );
			expect( tools1 ).toEqual( tools2 );
		} );
	} );

	describe( 'static isToolSupported', () => {
		test( 'returns true for supported tools', () => {
			expect( BuiltInPresets.isToolSupported( 'arrow' ) ).toBe( true );
			expect( BuiltInPresets.isToolSupported( 'text' ) ).toBe( true );
			expect( BuiltInPresets.isToolSupported( 'rectangle' ) ).toBe( true );
		} );

		test( 'returns false for unsupported tools', () => {
			expect( BuiltInPresets.isToolSupported( 'select' ) ).toBe( false );
			expect( BuiltInPresets.isToolSupported( 'unsupported' ) ).toBe( false );
			expect( BuiltInPresets.isToolSupported( '' ) ).toBe( false );
		} );
	} );

	describe( 'static isBuiltIn', () => {
		test( 'returns true for builtin- prefixed IDs', () => {
			expect( BuiltInPresets.isBuiltIn( 'builtin-arrow-default' ) ).toBe( true );
			expect( BuiltInPresets.isBuiltIn( 'builtin-text-label' ) ).toBe( true );
		} );

		test( 'returns false for user preset IDs', () => {
			expect( BuiltInPresets.isBuiltIn( 'arrow-custom-abc123' ) ).toBe( false );
			expect( BuiltInPresets.isBuiltIn( 'user-preset' ) ).toBe( false );
		} );

		test( 'returns false for falsy values', () => {
			expect( BuiltInPresets.isBuiltIn( null ) ).toBe( false );
			expect( BuiltInPresets.isBuiltIn( undefined ) ).toBe( false );
			expect( BuiltInPresets.isBuiltIn( '' ) ).toBe( false );
		} );
	} );

	describe( 'static getAll', () => {
		test( 'returns all preset categories', () => {
			const all = BuiltInPresets.getAll();
			expect( all ).toHaveProperty( 'arrow' );
			expect( all ).toHaveProperty( 'text' );
			expect( all ).toHaveProperty( 'rectangle' );
		} );

		test( 'returns a deep clone', () => {
			const all1 = BuiltInPresets.getAll();
			const all2 = BuiltInPresets.getAll();
			expect( all1 ).not.toBe( all2 );
			expect( all1.arrow ).not.toBe( all2.arrow );
		} );
	} );

	describe( 'static getCount', () => {
		test( 'returns correct count for tools with presets', () => {
			expect( BuiltInPresets.getCount( 'arrow' ) ).toBe( 2 );
			expect( BuiltInPresets.getCount( 'text' ) ).toBe( 2 );
			expect( BuiltInPresets.getCount( 'rectangle' ) ).toBe( 2 );
		} );

		test( 'returns 0 for tools with no presets', () => {
			expect( BuiltInPresets.getCount( 'path' ) ).toBe( 0 );
		} );

		test( 'returns 0 for unsupported tools', () => {
			expect( BuiltInPresets.getCount( 'unsupported' ) ).toBe( 0 );
		} );
	} );

	describe( 'static getTotalCount', () => {
		test( 'returns total of all presets', () => {
			const total = BuiltInPresets.getTotalCount();
			expect( total ).toBeGreaterThan( 0 );
			// Verify by summing individual counts
			const tools = BuiltInPresets.getSupportedTools();
			const sum = tools.reduce( ( acc, tool ) => acc + BuiltInPresets.getCount( tool ), 0 );
			expect( total ).toBe( sum );
		} );
	} );

	describe( 'static constants', () => {
		test( 'SUPPORTED_TOOLS is exposed', () => {
			expect( Array.isArray( BuiltInPresets.SUPPORTED_TOOLS ) ).toBe( true );
			expect( BuiltInPresets.SUPPORTED_TOOLS ).toContain( 'arrow' );
		} );

		test( 'PRESETS is exposed', () => {
			expect( typeof BuiltInPresets.PRESETS ).toBe( 'object' );
			expect( BuiltInPresets.PRESETS ).toHaveProperty( 'arrow' );
		} );
	} );

	describe( 'preset content validation', () => {
		test( 'arrow presets have correct style properties', () => {
			const presets = BuiltInPresets.getForTool( 'arrow' );
			presets.forEach( ( preset ) => {
				expect( preset.style ).toHaveProperty( 'fill' );
				expect( preset.style ).toHaveProperty( 'stroke' );
				expect( preset.style ).toHaveProperty( 'strokeWidth' );
				expect( preset.style ).toHaveProperty( 'arrowSize' );
			} );
		} );

		test( 'text presets have correct style properties', () => {
			const presets = BuiltInPresets.getForTool( 'text' );
			presets.forEach( ( preset ) => {
				expect( preset.style ).toHaveProperty( 'color' );
				expect( preset.style ).toHaveProperty( 'fontSize' );
				expect( preset.style ).toHaveProperty( 'fontFamily' );
			} );
		} );

		test( 'textbox presets have box and text properties', () => {
			const presets = BuiltInPresets.getForTool( 'textbox' );
			expect( presets.length ).toBeGreaterThan( 0 );
			presets.forEach( ( preset ) => {
				expect( preset.style ).toHaveProperty( 'fill' );
				expect( preset.style ).toHaveProperty( 'fontSize' );
			} );
		} );
	} );

	describe( 'getForTool - edge cases', () => {
		test( 'returns empty array for null tool', () => {
			expect( BuiltInPresets.getForTool( null ) ).toEqual( [] );
		} );

		test( 'returns empty array for undefined tool', () => {
			expect( BuiltInPresets.getForTool( undefined ) ).toEqual( [] );
		} );

		test( 'returns empty array for numeric tool', () => {
			expect( BuiltInPresets.getForTool( 42 ) ).toEqual( [] );
		} );

		test( 'returns presets for every supported tool', () => {
			const tools = BuiltInPresets.getSupportedTools();
			tools.forEach( ( tool ) => {
				const presets = BuiltInPresets.getForTool( tool );
				expect( Array.isArray( presets ) ).toBe( true );
			} );
		} );

		test( 'angleDimension is supported but has no built-in presets', () => {
			expect( BuiltInPresets.isToolSupported( 'angleDimension' ) ).toBe( true );
			expect( BuiltInPresets.getForTool( 'angleDimension' ) ).toEqual( [] );
		} );
	} );

	describe( 'getById - edge cases', () => {
		test( 'returns null for null tool', () => {
			expect( BuiltInPresets.getById( null, 'builtin-arrow-default' ) ).toBeNull();
		} );

		test( 'returns null for undefined tool', () => {
			expect( BuiltInPresets.getById( undefined, 'builtin-arrow-default' ) ).toBeNull();
		} );

		test( 'returns null for null presetId', () => {
			expect( BuiltInPresets.getById( 'arrow', null ) ).toBeNull();
		} );

		test( 'returns null for empty string presetId', () => {
			expect( BuiltInPresets.getById( 'arrow', '' ) ).toBeNull();
		} );

		test( 'returns null for unsupported tool with valid-looking ID', () => {
			expect( BuiltInPresets.getById( 'blur', 'builtin-blur-default' ) ).toBeNull();
		} );

		test( 'finds presets in each tool category', () => {
			const toolsWithPresets = [
				[ 'arrow', 'builtin-arrow-default' ],
				[ 'text', 'builtin-text-label' ],
				[ 'textbox', 'builtin-textbox-default' ],
				[ 'callout', 'builtin-callout-speech' ],
				[ 'rectangle', 'builtin-rect-outline' ],
				[ 'circle', 'builtin-circle-outline' ],
				[ 'ellipse', 'builtin-ellipse-outline' ],
				[ 'line', 'builtin-line-default' ],
				[ 'polygon', 'builtin-polygon-outline' ],
				[ 'star', 'builtin-star-filled' ],
				[ 'dimension', 'builtin-dimension-default' ],
				[ 'marker', 'builtin-marker-circled' ]
			];
			toolsWithPresets.forEach( ( [ tool, id ] ) => {
				const preset = BuiltInPresets.getById( tool, id );
				expect( preset ).not.toBeNull();
				expect( preset.id ).toBe( id );
				expect( preset.builtIn ).toBe( true );
			} );
		} );
	} );

	describe( 'getDefault - edge cases', () => {
		test( 'returns null for null tool', () => {
			expect( BuiltInPresets.getDefault( null ) ).toBeNull();
		} );

		test( 'returns null for undefined tool', () => {
			expect( BuiltInPresets.getDefault( undefined ) ).toBeNull();
		} );

		test( 'returns null for angleDimension (no presets defined)', () => {
			expect( BuiltInPresets.getDefault( 'angleDimension' ) ).toBeNull();
		} );

		test( 'returns first preset of each tool with presets', () => {
			const expected = {
				arrow: 'builtin-arrow-default',
				text: 'builtin-text-label',
				textbox: 'builtin-textbox-default',
				callout: 'builtin-callout-speech',
				rectangle: 'builtin-rect-outline',
				circle: 'builtin-circle-outline',
				ellipse: 'builtin-ellipse-outline',
				line: 'builtin-line-default',
				polygon: 'builtin-polygon-outline',
				star: 'builtin-star-filled',
				dimension: 'builtin-dimension-default',
				marker: 'builtin-marker-circled'
			};
			Object.entries( expected ).forEach( ( [ tool, expectedId ] ) => {
				const def = BuiltInPresets.getDefault( tool );
				expect( def ).not.toBeNull();
				expect( def.id ).toBe( expectedId );
			} );
		} );
	} );

	describe( 'isToolSupported - edge cases', () => {
		test( 'returns false for null', () => {
			expect( BuiltInPresets.isToolSupported( null ) ).toBe( false );
		} );

		test( 'returns false for undefined', () => {
			expect( BuiltInPresets.isToolSupported( undefined ) ).toBe( false );
		} );

		test( 'returns false for numeric input', () => {
			expect( BuiltInPresets.isToolSupported( 0 ) ).toBe( false );
		} );

		test( 'all 14 supported tools return true', () => {
			const expectedTools = [
				'arrow', 'text', 'textbox', 'callout', 'rectangle', 'circle',
				'ellipse', 'line', 'polygon', 'star', 'path', 'dimension', 'marker', 'angleDimension'
			];
			expectedTools.forEach( ( tool ) => {
				expect( BuiltInPresets.isToolSupported( tool ) ).toBe( true );
			} );
			expect( BuiltInPresets.getSupportedTools().length ).toBe( 14 );
		} );
	} );

	describe( 'isBuiltIn - edge cases', () => {
		test( 'throws for number input', () => {
			expect( () => BuiltInPresets.isBuiltIn( 123 ) ).toThrow();
		} );

		test( 'throws for object input', () => {
			expect( () => BuiltInPresets.isBuiltIn( {} ) ).toThrow();
		} );

		test( 'throws for boolean true input', () => {
			expect( () => BuiltInPresets.isBuiltIn( true ) ).toThrow();
		} );

		test( 'returns false for "builtin" without hyphen', () => {
			expect( BuiltInPresets.isBuiltIn( 'builtinarrow' ) ).toBe( false );
		} );

		test( 'returns true for minimal builtin- prefix', () => {
			expect( BuiltInPresets.isBuiltIn( 'builtin-x' ) ).toBe( true );
		} );

		test( 'returns false for "Builtin-" (case sensitive)', () => {
			expect( BuiltInPresets.isBuiltIn( 'Builtin-arrow' ) ).toBe( false );
		} );
	} );

	describe( 'getAll - deep clone integrity', () => {
		test( 'modifying returned value does not affect original', () => {
			const all = BuiltInPresets.getAll();
			all.arrow[ 0 ].name = 'MODIFIED';
			all.arrow.push( { id: 'extra', name: 'Extra' } );
			delete all.text;

			const fresh = BuiltInPresets.getAll();
			expect( fresh.arrow[ 0 ].name ).toBe( 'Default Arrow' );
			expect( fresh.arrow.length ).toBe( 2 );
			expect( fresh ).toHaveProperty( 'text' );
		} );

		test( 'includes all tool categories', () => {
			const all = BuiltInPresets.getAll();
			const keys = Object.keys( all );
			expect( keys ).toContain( 'arrow' );
			expect( keys ).toContain( 'path' );
			expect( keys ).toContain( 'dimension' );
			expect( keys ).toContain( 'marker' );
			expect( all.path ).toEqual( [] );
		} );
	} );

	describe( 'getCount - edge cases', () => {
		test( 'returns 0 for null tool', () => {
			expect( BuiltInPresets.getCount( null ) ).toBe( 0 );
		} );

		test( 'returns 0 for undefined tool', () => {
			expect( BuiltInPresets.getCount( undefined ) ).toBe( 0 );
		} );

		test( 'returns correct counts for all tools', () => {
			expect( BuiltInPresets.getCount( 'callout' ) ).toBe( 3 );
			expect( BuiltInPresets.getCount( 'dimension' ) ).toBe( 4 );
			expect( BuiltInPresets.getCount( 'marker' ) ).toBe( 4 );
			expect( BuiltInPresets.getCount( 'circle' ) ).toBe( 1 );
			expect( BuiltInPresets.getCount( 'ellipse' ) ).toBe( 1 );
			expect( BuiltInPresets.getCount( 'line' ) ).toBe( 1 );
			expect( BuiltInPresets.getCount( 'polygon' ) ).toBe( 1 );
			expect( BuiltInPresets.getCount( 'star' ) ).toBe( 1 );
			expect( BuiltInPresets.getCount( 'textbox' ) ).toBe( 1 );
		} );
	} );

	describe( 'getTotalCount - validation', () => {
		test( 'matches manual count of all presets', () => {
			const all = BuiltInPresets.getAll();
			let manual = 0;
			Object.values( all ).forEach( ( arr ) => {
				manual += arr.length;
			} );
			expect( BuiltInPresets.getTotalCount() ).toBe( manual );
		} );

		test( 'total is at least 20', () => {
			expect( BuiltInPresets.getTotalCount() ).toBeGreaterThanOrEqual( 20 );
		} );
	} );

	describe( 'SUPPORTED_TOOLS constant', () => {
		test( 'is not modifiable from outside (reference check)', () => {
			const original = BuiltInPresets.SUPPORTED_TOOLS;
			const originalLength = original.length;
			// Pushing to the constant array would affect all users
			// but the class returns copies via getSupportedTools()
			const copy = BuiltInPresets.getSupportedTools();
			copy.push( 'fakeTool' );
			expect( BuiltInPresets.getSupportedTools().length ).toBe( originalLength );
		} );
	} );

	describe( 'PRESETS constant', () => {
		test( 'has entries for all tools with presets', () => {
			const presets = BuiltInPresets.PRESETS;
			expect( presets.arrow.length ).toBeGreaterThan( 0 );
			expect( presets.text.length ).toBeGreaterThan( 0 );
			expect( presets.callout.length ).toBeGreaterThan( 0 );
			expect( presets.rectangle.length ).toBeGreaterThan( 0 );
			expect( presets.dimension.length ).toBeGreaterThan( 0 );
			expect( presets.marker.length ).toBeGreaterThan( 0 );
		} );

		test( 'does not include angleDimension key', () => {
			expect( BuiltInPresets.PRESETS ).not.toHaveProperty( 'angleDimension' );
		} );
	} );
} );
