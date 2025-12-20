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
				expect( preset.style ).toHaveProperty( 'stroke' );
				expect( preset.style ).toHaveProperty( 'strokeWidth' );
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
} );
