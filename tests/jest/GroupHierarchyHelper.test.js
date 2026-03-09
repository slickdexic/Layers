/**
 * Unit tests for GroupHierarchyHelper
 */

describe( 'GroupHierarchyHelper', () => {
	let GroupHierarchyHelper;

	beforeEach( () => {
		jest.resetModules();

		global.window = {
			Layers: {}
		};
		global.mw = {
			ext: { layers: {} },
			log: { warn: jest.fn() }
		};

		GroupHierarchyHelper = require( '../../resources/ext.layers.editor/GroupHierarchyHelper.js' );
	} );

	afterEach( () => {
		delete global.window;
		delete global.mw;
	} );

	describe( 'generateGroupId', () => {
		it( 'should return a string starting with "group-"', () => {
			const id = GroupHierarchyHelper.generateGroupId();
			expect( typeof id ).toBe( 'string' );
			expect( id ).toMatch( /^group-/ );
		} );

		it( 'should generate unique IDs', () => {
			const id1 = GroupHierarchyHelper.generateGroupId();
			const id2 = GroupHierarchyHelper.generateGroupId();
			expect( id1 ).not.toBe( id2 );
		} );
	} );

	describe( 'generateDefaultFolderName', () => {
		it( 'should return "Folder 1" for no groups', () => {
			expect( GroupHierarchyHelper.generateDefaultFolderName( [] ) ).toBe( 'Folder 1' );
		} );

		it( 'should return "Folder 2" when one group exists', () => {
			const layers = [ { id: 'g1', type: 'group' } ];
			expect( GroupHierarchyHelper.generateDefaultFolderName( layers ) ).toBe( 'Folder 2' );
		} );

		it( 'should count only group-type layers', () => {
			const layers = [
				{ id: '1', type: 'rectangle' },
				{ id: '2', type: 'group' },
				{ id: '3', type: 'text' }
			];
			expect( GroupHierarchyHelper.generateDefaultFolderName( layers ) ).toBe( 'Folder 2' );
		} );
	} );

	describe( 'generateDefaultGroupName', () => {
		it( 'should return "Folder 1" for no groups', () => {
			expect( GroupHierarchyHelper.generateDefaultGroupName( [] ) ).toBe( 'Folder 1' );
		} );
	} );

	describe( 'isDescendantOf', () => {
		const maxDepth = 5;

		it( 'should return true for direct child', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'c1' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' }
			];
			expect( GroupHierarchyHelper.isDescendantOf( 'c1', 'g1', layers, maxDepth ) ).toBe( true );
		} );

		it( 'should return true for nested descendant', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'g2' ] },
				{ id: 'g2', type: 'group', children: [ 'c1' ], parentGroup: 'g1' },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g2' }
			];
			expect( GroupHierarchyHelper.isDescendantOf( 'c1', 'g1', layers, maxDepth ) ).toBe( true );
		} );

		it( 'should return false for non-descendant', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'c1' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' },
				{ id: 'c2', type: 'rectangle' }
			];
			expect( GroupHierarchyHelper.isDescendantOf( 'c2', 'g1', layers, maxDepth ) ).toBe( false );
		} );

		it( 'should return false for non-existent ancestor', () => {
			const layers = [ { id: 'c1', type: 'rectangle' } ];
			expect( GroupHierarchyHelper.isDescendantOf( 'c1', 'missing', layers, maxDepth ) ).toBe( false );
		} );

		it( 'should return false when ancestor is not a group', () => {
			const layers = [ { id: 'r1', type: 'rectangle' } ];
			expect( GroupHierarchyHelper.isDescendantOf( 'c1', 'r1', layers, maxDepth ) ).toBe( false );
		} );

		it( 'should bail out at max recursion depth', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'g2' ] },
				{ id: 'g2', type: 'group', children: [ 'g1' ], parentGroup: 'g1' }
			];
			// Force deep recursion with circular reference
			expect( GroupHierarchyHelper.isDescendantOf( 'target', 'g1', layers, 2 ) ).toBe( false );
			expect( global.mw.log.warn ).toHaveBeenCalled();
		} );
	} );

	describe( 'getGroupChildren', () => {
		const maxDepth = 5;

		it( 'should return direct children', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'c1', 'c2' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' },
				{ id: 'c2', type: 'text', parentGroup: 'g1' }
			];
			const children = GroupHierarchyHelper.getGroupChildren( 'g1', layers, maxDepth, false );
			expect( children ).toHaveLength( 2 );
			expect( children.map( ( c ) => c.id ) ).toEqual( [ 'c1', 'c2' ] );
		} );

		it( 'should return nested children recursively', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'g2', 'c1' ] },
				{ id: 'g2', type: 'group', children: [ 'c2' ], parentGroup: 'g1' },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' },
				{ id: 'c2', type: 'text', parentGroup: 'g2' }
			];
			const children = GroupHierarchyHelper.getGroupChildren( 'g1', layers, maxDepth, true );
			expect( children ).toHaveLength( 3 );
			const ids = children.map( ( c ) => c.id );
			expect( ids ).toContain( 'g2' );
			expect( ids ).toContain( 'c1' );
			expect( ids ).toContain( 'c2' );
		} );

		it( 'should return empty array for non-existent group', () => {
			expect( GroupHierarchyHelper.getGroupChildren( 'missing', [], maxDepth ) ).toEqual( [] );
		} );

		it( 'should return empty array for non-group', () => {
			const layers = [ { id: 'r1', type: 'rectangle' } ];
			expect( GroupHierarchyHelper.getGroupChildren( 'r1', layers, maxDepth ) ).toEqual( [] );
		} );

		it( 'should skip missing children gracefully', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'c1', 'missing' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' }
			];
			const children = GroupHierarchyHelper.getGroupChildren( 'g1', layers, maxDepth );
			expect( children ).toHaveLength( 1 );
		} );

		it( 'should bail out at max recursion depth', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'g2' ] },
				{ id: 'g2', type: 'group', children: [ 'g1' ], parentGroup: 'g1' }
			];
			const children = GroupHierarchyHelper.getGroupChildren( 'g1', layers, 2, true );
			expect( Array.isArray( children ) ).toBe( true );
		} );
	} );

	describe( 'getLayerDepth', () => {
		const maxDepth = 5;

		it( 'should return 0 for root-level layers', () => {
			const layers = [ { id: 'c1', type: 'rectangle' } ];
			expect( GroupHierarchyHelper.getLayerDepth( 'c1', layers, maxDepth ) ).toBe( 0 );
		} );

		it( 'should return 1 for direct group child', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'c1' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' }
			];
			expect( GroupHierarchyHelper.getLayerDepth( 'c1', layers, maxDepth ) ).toBe( 1 );
		} );

		it( 'should return 2 for nested child', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'g2' ] },
				{ id: 'g2', type: 'group', children: [ 'c1' ], parentGroup: 'g1' },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g2' }
			];
			expect( GroupHierarchyHelper.getLayerDepth( 'c1', layers, maxDepth ) ).toBe( 2 );
		} );

		it( 'should accept layer object instead of ID', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'c1' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' }
			];
			expect( GroupHierarchyHelper.getLayerDepth( layers[ 1 ], layers, maxDepth ) ).toBe( 1 );
		} );

		it( 'should return 0 for non-existent layer', () => {
			expect( GroupHierarchyHelper.getLayerDepth( 'missing', [], maxDepth ) ).toBe( 0 );
		} );

		it( 'should return 0 for null layers', () => {
			expect( GroupHierarchyHelper.getLayerDepth( 'c1', null, maxDepth ) ).toBe( 0 );
		} );

		it( 'should handle broken parent chain gracefully', () => {
			const layers = [
				{ id: 'c1', type: 'rectangle', parentGroup: 'missing' }
			];
			expect( GroupHierarchyHelper.getLayerDepth( 'c1', layers, maxDepth ) ).toBe( 0 );
		} );
	} );

	describe( 'getMaxChildDepth', () => {
		const maxDepth = 5;

		it( 'should return 0 for non-group', () => {
			const layer = { id: 'r1', type: 'rectangle' };
			expect( GroupHierarchyHelper.getMaxChildDepth( layer, [], maxDepth ) ).toBe( 0 );
		} );

		it( 'should return 0 for empty group', () => {
			const group = { id: 'g1', type: 'group', children: [] };
			expect( GroupHierarchyHelper.getMaxChildDepth( group, [], maxDepth ) ).toBe( 0 );
		} );

		it( 'should return 0 for group with only leaf children', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'c1' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' }
			];
			expect( GroupHierarchyHelper.getMaxChildDepth( layers[ 0 ], layers, maxDepth ) ).toBe( 0 );
		} );

		it( 'should return 1 for group with nested subgroup', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'g2' ] },
				{ id: 'g2', type: 'group', children: [ 'c1' ], parentGroup: 'g1' },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g2' }
			];
			expect( GroupHierarchyHelper.getMaxChildDepth( layers[ 0 ], layers, maxDepth ) ).toBe( 1 );
		} );

		it( 'should return max depth among multiple branches', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'g2', 'g3' ] },
				{ id: 'g2', type: 'group', children: [ 'g4' ], parentGroup: 'g1' },
				{ id: 'g3', type: 'group', children: [], parentGroup: 'g1' },
				{ id: 'g4', type: 'group', children: [], parentGroup: 'g2' }
			];
			// g1 -> g2 -> g4 = depth 2; g1 -> g3 = depth 1
			expect( GroupHierarchyHelper.getMaxChildDepth( layers[ 0 ], layers, maxDepth ) ).toBe( 2 );
		} );
	} );

	describe( 'getGroupBounds', () => {
		const maxDepth = 5;

		it( 'should return null for empty group', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [] }
			];
			expect( GroupHierarchyHelper.getGroupBounds( 'g1', layers, maxDepth ) ).toBeNull();
		} );

		it( 'should return null for non-existent group', () => {
			expect( GroupHierarchyHelper.getGroupBounds( 'missing', [], maxDepth ) ).toBeNull();
		} );

		it( 'should compute bounds from child layers', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'c1', 'c2' ] },
				{ id: 'c1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50, parentGroup: 'g1' },
				{ id: 'c2', type: 'rectangle', x: 50, y: 30, width: 80, height: 60, parentGroup: 'g1' }
			];
			const bounds = GroupHierarchyHelper.getGroupBounds( 'g1', layers, maxDepth );
			expect( bounds ).toEqual( {
				x: 10,
				y: 20,
				width: 120, // max(110, 130) - 10
				height: 70 // max(70, 90) - 20
			} );
		} );

		it( 'should skip group children in bounds calculation', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'g2', 'c1' ] },
				{ id: 'g2', type: 'group', children: [ 'c2' ], parentGroup: 'g1' },
				{ id: 'c1', type: 'rectangle', x: 0, y: 0, width: 50, height: 50, parentGroup: 'g1' },
				{ id: 'c2', type: 'rectangle', x: 100, y: 100, width: 50, height: 50, parentGroup: 'g2' }
			];
			const bounds = GroupHierarchyHelper.getGroupBounds( 'g1', layers, maxDepth );
			expect( bounds.x ).toBe( 0 );
			expect( bounds.y ).toBe( 0 );
			expect( bounds.width ).toBe( 150 );
			expect( bounds.height ).toBe( 150 );
		} );
	} );

	describe( 'getLayerBounds', () => {
		it( 'should return null for null input', () => {
			expect( GroupHierarchyHelper.getLayerBounds( null ) ).toBeNull();
		} );

		it( 'should calculate bounds from x/y/width/height', () => {
			const bounds = GroupHierarchyHelper.getLayerBounds( {
				x: 10, y: 20, width: 100, height: 50
			} );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );

		it( 'should use radius for circle-like layers', () => {
			const bounds = GroupHierarchyHelper.getLayerBounds( {
				x: 50, y: 50, radius: 25
			} );
			expect( bounds.width ).toBe( 50 );
			expect( bounds.height ).toBe( 50 );
		} );

		it( 'should default to 100 for missing dimensions', () => {
			const bounds = GroupHierarchyHelper.getLayerBounds( { x: 0, y: 0 } );
			expect( bounds.width ).toBe( 100 );
			expect( bounds.height ).toBe( 100 );
		} );
	} );

	describe( 'getTopLevelLayers', () => {
		it( 'should return all layers with no parentGroup', () => {
			const layers = [
				{ id: 'c1', type: 'rectangle' },
				{ id: 'g1', type: 'group', children: [ 'c2' ] },
				{ id: 'c2', type: 'text', parentGroup: 'g1' }
			];
			const topLevel = GroupHierarchyHelper.getTopLevelLayers( layers );
			expect( topLevel ).toHaveLength( 2 );
			expect( topLevel.map( ( l ) => l.id ) ).toEqual( [ 'c1', 'g1' ] );
		} );

		it( 'should return empty for no layers', () => {
			expect( GroupHierarchyHelper.getTopLevelLayers( [] ) ).toEqual( [] );
		} );
	} );

	describe( 'isGroup', () => {
		it( 'should return true for group layer object', () => {
			expect( GroupHierarchyHelper.isGroup( { type: 'group' } ) ).toBe( true );
		} );

		it( 'should return false for non-group layer object', () => {
			expect( GroupHierarchyHelper.isGroup( { type: 'rectangle' } ) ).toBe( false );
		} );

		it( 'should return true for group layer by ID', () => {
			const layers = [ { id: 'g1', type: 'group' } ];
			expect( GroupHierarchyHelper.isGroup( 'g1', layers ) ).toBe( true );
		} );

		it( 'should return false for non-group by ID', () => {
			const layers = [ { id: 'r1', type: 'rectangle' } ];
			expect( GroupHierarchyHelper.isGroup( 'r1', layers ) ).toBe( false );
		} );

		it( 'should return false for missing ID', () => {
			expect( GroupHierarchyHelper.isGroup( 'missing', [] ) ).toBe( false );
		} );

		it( 'should return false for ID without layers array', () => {
			expect( GroupHierarchyHelper.isGroup( 'g1' ) ).toBe( false );
		} );

		it( 'should return falsy for null', () => {
			expect( GroupHierarchyHelper.isGroup( null ) ).toBeFalsy();
		} );
	} );

	describe( 'getParentGroup', () => {
		it( 'should return parent group layer', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [ 'c1' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' }
			];
			const parent = GroupHierarchyHelper.getParentGroup( 'c1', layers );
			expect( parent ).toBeTruthy();
			expect( parent.id ).toBe( 'g1' );
		} );

		it( 'should return null for root-level layer', () => {
			const layers = [ { id: 'c1', type: 'rectangle' } ];
			expect( GroupHierarchyHelper.getParentGroup( 'c1', layers ) ).toBeNull();
		} );

		it( 'should return null for non-existent layer', () => {
			expect( GroupHierarchyHelper.getParentGroup( 'missing', [] ) ).toBeNull();
		} );

		it( 'should return null if parent is not a group', () => {
			const layers = [
				{ id: 'r1', type: 'rectangle' },
				{ id: 'c1', type: 'rectangle', parentGroup: 'r1' }
			];
			expect( GroupHierarchyHelper.getParentGroup( 'c1', layers ) ).toBeNull();
		} );

		it( 'should return null if parent does not exist', () => {
			const layers = [
				{ id: 'c1', type: 'rectangle', parentGroup: 'missing' }
			];
			expect( GroupHierarchyHelper.getParentGroup( 'c1', layers ) ).toBeNull();
		} );
	} );
} );
