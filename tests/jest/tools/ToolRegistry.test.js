/**
 * Tests for ToolRegistry module
 *
 * @jest-environment jsdom
 */

'use strict';

const ToolRegistry = require( '../../../resources/ext.layers.editor/tools/ToolRegistry.js' );

describe( 'ToolRegistry', () => {
	let registry;

	beforeEach( () => {
		registry = new ToolRegistry();
		// Clear defaults for isolated testing
		registry.clear();
	} );

	describe( 'constructor', () => {
		it( 'should create with tools map', () => {
			expect( registry.tools ).toBeInstanceOf( Map );
		} );

		it( 'should register default tools on creation', () => {
			const freshRegistry = new ToolRegistry();
			expect( freshRegistry.has( 'pointer' ) ).toBe( true );
			expect( freshRegistry.has( 'rectangle' ) ).toBe( true );
		} );

		it( 'should have categories as Map', () => {
			expect( registry.categories ).toBeInstanceOf( Map );
		} );
	} );

	describe( 'register', () => {
		it( 'should register a basic tool', () => {
			registry.register( 'pen', { cursor: 'crosshair', category: 'drawing' } );
			expect( registry.tools.has( 'pen' ) ).toBe( true );
		} );

		it( 'should store tool properties', () => {
			registry.register( 'pen', {
				cursor: 'crosshair',
				category: 'drawing',
				createsLayer: true
			} );

			const tool = registry.tools.get( 'pen' );
			expect( tool.cursor ).toBe( 'crosshair' );
			expect( tool.category ).toBe( 'drawing' );
			expect( tool.createsLayer ).toBe( true );
		} );

		it( 'should allow overwriting existing tools', () => {
			registry.register( 'pen', { cursor: 'crosshair' } );
			registry.register( 'pen', { cursor: 'pointer' } );

			expect( registry.getCursor( 'pen' ) ).toBe( 'pointer' );
		} );

		it( 'should add tool to category', () => {
			registry.register( 'pen', { category: 'drawing' } );
			registry.register( 'rectangle', { category: 'shape' } );
			registry.register( 'circle', { category: 'shape' } );

			expect( registry.getToolsByCategory( 'drawing' ) ).toContain( 'pen' );
			expect( registry.getToolsByCategory( 'shape' ) ).toContain( 'rectangle' );
			expect( registry.getToolsByCategory( 'shape' ) ).toContain( 'circle' );
		} );
	} );

	describe( 'get', () => {
		beforeEach( () => {
			registry.register( 'pen', {
				cursor: 'crosshair',
				category: 'drawing'
			} );
		} );

		it( 'should return tool config for registered tool', () => {
			const tool = registry.get( 'pen' );
			expect( tool.cursor ).toBe( 'crosshair' );
		} );

		it( 'should return null for unregistered tool', () => {
			expect( registry.get( 'unknown' ) ).toBeNull();
		} );
	} );

	describe( 'getCursor', () => {
		beforeEach( () => {
			registry.register( 'pen', { cursor: 'crosshair' } );
			registry.register( 'pointer', { cursor: 'default' } );
		} );

		it( 'should return cursor for registered tool', () => {
			expect( registry.getCursor( 'pen' ) ).toBe( 'crosshair' );
		} );

		it( 'should return "default" for unregistered tool', () => {
			expect( registry.getCursor( 'unknown' ) ).toBe( 'default' );
		} );

		it( 'should return "default" for tool without cursor', () => {
			registry.register( 'nocursor', {} );
			expect( registry.getCursor( 'nocursor' ) ).toBe( 'default' );
		} );
	} );

	describe( 'getDisplayName', () => {
		beforeEach( () => {
			registry.register( 'pen', { cursor: 'crosshair' } );
			registry.register( 'rectangle', { cursor: 'crosshair' } );
		} );

		it( 'should return capitalized tool name as fallback', () => {
			expect( registry.getDisplayName( 'pen' ) ).toBe( 'Pen' );
		} );

		it( 'should return capitalized tool name for unregistered tool', () => {
			expect( registry.getDisplayName( 'unknown' ) ).toBe( 'Unknown' );
		} );

		it( 'should handle empty string tool name', () => {
			expect( registry.getDisplayName( '' ) ).toBe( '' );
		} );
	} );

	describe( 'isDrawingTool', () => {
		beforeEach( () => {
			registry.register( 'pen', { category: 'drawing' } );
			registry.register( 'rectangle', { category: 'shape' } );
			registry.register( 'arrow', { category: 'line' } );
			registry.register( 'highlight', { category: 'annotation' } );
			registry.register( 'pointer', { category: 'selection' } );
		} );

		it( 'should return true for drawing category tools', () => {
			expect( registry.isDrawingTool( 'pen' ) ).toBe( true );
		} );

		it( 'should return true for shape category tools', () => {
			expect( registry.isDrawingTool( 'rectangle' ) ).toBe( true );
		} );

		it( 'should return true for line category tools', () => {
			expect( registry.isDrawingTool( 'arrow' ) ).toBe( true );
		} );

		it( 'should return true for annotation category tools', () => {
			expect( registry.isDrawingTool( 'highlight' ) ).toBe( true );
		} );

		it( 'should return false for non-drawing tools', () => {
			expect( registry.isDrawingTool( 'pointer' ) ).toBe( false );
		} );

		it( 'should return false for unregistered tools', () => {
			expect( registry.isDrawingTool( 'unknown' ) ).toBe( false );
		} );
	} );

	describe( 'isSelectionTool', () => {
		beforeEach( () => {
			registry.register( 'pointer', { category: 'selection' } );
			registry.register( 'pen', { category: 'drawing' } );
		} );

		it( 'should return true for selection category tools', () => {
			expect( registry.isSelectionTool( 'pointer' ) ).toBe( true );
		} );

		it( 'should return false for non-selection tools', () => {
			expect( registry.isSelectionTool( 'pen' ) ).toBe( false );
		} );
	} );

	describe( 'getToolsByCategory', () => {
		beforeEach( () => {
			registry.register( 'pen', { category: 'drawing' } );
			registry.register( 'rectangle', { category: 'shape' } );
			registry.register( 'circle', { category: 'shape' } );
			registry.register( 'pointer', { category: 'selection' } );
		} );

		it( 'should return all tools in a category', () => {
			const shapes = registry.getToolsByCategory( 'shape' );
			expect( shapes ).toContain( 'rectangle' );
			expect( shapes ).toContain( 'circle' );
			expect( shapes ).toHaveLength( 2 );
		} );

		it( 'should return empty array for unknown category', () => {
			expect( registry.getToolsByCategory( 'unknown' ) ).toEqual( [] );
		} );
	} );

	describe( 'getToolNames', () => {
		beforeEach( () => {
			registry.register( 'pen', { cursor: 'crosshair' } );
			registry.register( 'rectangle', { cursor: 'crosshair' } );
		} );

		it( 'should return array of all tool names', () => {
			const tools = registry.getToolNames();
			expect( tools ).toContain( 'pen' );
			expect( tools ).toContain( 'rectangle' );
		} );
	} );

	describe( 'has', () => {
		beforeEach( () => {
			registry.register( 'pen', { cursor: 'crosshair' } );
		} );

		it( 'should return true for registered tool', () => {
			expect( registry.has( 'pen' ) ).toBe( true );
		} );

		it( 'should return false for unregistered tool', () => {
			expect( registry.has( 'unknown' ) ).toBe( false );
		} );
	} );

	describe( 'unregister', () => {
		beforeEach( () => {
			registry.register( 'pen', { category: 'drawing' } );
		} );

		it( 'should remove tool from registry', () => {
			registry.unregister( 'pen' );
			expect( registry.has( 'pen' ) ).toBe( false );
		} );

		it( 'should remove tool from category', () => {
			registry.unregister( 'pen' );
			expect( registry.getToolsByCategory( 'drawing' ) ).not.toContain( 'pen' );
		} );

		it( 'should return true when tool was removed', () => {
			expect( registry.unregister( 'pen' ) ).toBe( true );
		} );

		it( 'should return false when tool did not exist', () => {
			expect( registry.unregister( 'unknown' ) ).toBe( false );
		} );
	} );

	describe( 'clear', () => {
		beforeEach( () => {
			registry.register( 'pen', { category: 'drawing' } );
			registry.register( 'rectangle', { category: 'shape' } );
		} );

		it( 'should remove all tools', () => {
			registry.clear();
			expect( registry.tools.size ).toBe( 0 );
		} );

		it( 'should clear all categories', () => {
			registry.clear();
			expect( registry.categories.size ).toBe( 0 );
		} );
	} );

	describe( 'reset', () => {
		it( 'should restore default tools', () => {
			registry.clear();
			expect( registry.has( 'pointer' ) ).toBe( false );

			registry.reset();
			expect( registry.has( 'pointer' ) ).toBe( true );
			expect( registry.has( 'rectangle' ) ).toBe( true );
		} );
	} );

	describe( 'createsLayer', () => {
		beforeEach( () => {
			registry.register( 'pointer', { createsLayer: false } );
			registry.register( 'rectangle', { createsLayer: true } );
		} );

		it( 'should return true for tools that create layers', () => {
			expect( registry.createsLayer( 'rectangle' ) ).toBe( true );
		} );

		it( 'should return false for tools that do not create layers', () => {
			expect( registry.createsLayer( 'pointer' ) ).toBe( false );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export ToolRegistry class', () => {
			expect( typeof ToolRegistry ).toBe( 'function' );
		} );

		it( 'should allow creating new instances', () => {
			const instance = new ToolRegistry();
			expect( instance ).toBeInstanceOf( ToolRegistry );
		} );
	} );
} );
