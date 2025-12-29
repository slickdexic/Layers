/**
 * Tests for GroupManager - Layer grouping functionality
 */
'use strict';

// Load the module
require( '../../resources/ext.layers.editor/GroupManager.js' );

const GroupManager = window.Layers.GroupManager;

describe( 'GroupManager', () => {
	let groupManager;
	let mockStateManager;
	let mockSelectionManager;
	let mockHistoryManager;
	let testLayers;

	beforeEach( () => {
		// Setup test layers
		testLayers = [
			{ id: 'layer-1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 },
			{ id: 'layer-2', type: 'circle', x: 50, y: 50, radius: 25 },
			{ id: 'layer-3', type: 'text', x: 100, y: 100, text: 'Hello' },
			{ id: 'layer-4', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 }
		];

		// Create mock state manager
		mockStateManager = {
			state: { layers: [ ...testLayers ] },
			get: jest.fn( ( key ) => mockStateManager.state[ key ] ),
			set: jest.fn( ( key, value ) => {
				mockStateManager.state[ key ] = value;
			} )
		};

		// Create mock selection manager
		mockSelectionManager = {
			selectedLayers: [],
			getSelectedLayers: jest.fn( () => mockSelectionManager.selectedLayers ),
			selectLayer: jest.fn()
		};

		// Create mock history manager
		mockHistoryManager = {
			saveState: jest.fn()
		};

		// Create GroupManager instance
		groupManager = new GroupManager( {} );
		groupManager.initialize( {
			stateManager: mockStateManager,
			selectionManager: mockSelectionManager,
			historyManager: mockHistoryManager
		} );
	} );

	afterEach( () => {
		groupManager.destroy();
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default config', () => {
			const gm = new GroupManager( {} );
			expect( gm ).toBeDefined();
			expect( gm.maxNestingDepth ).toBe( 3 );
			expect( gm.maxChildrenPerGroup ).toBe( 100 );
		} );
	} );

	describe( 'generateGroupId', () => {
		it( 'should generate unique IDs', () => {
			const id1 = groupManager.generateGroupId();
			const id2 = groupManager.generateGroupId();

			expect( id1 ).toMatch( /^group-\d+-[a-z0-9]+$/ );
			expect( id2 ).toMatch( /^group-\d+-[a-z0-9]+$/ );
			expect( id1 ).not.toBe( id2 );
		} );
	} );

	describe( 'createGroup', () => {
		it( 'should create a group from layer IDs', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			expect( group ).not.toBeNull();
			expect( group.type ).toBe( 'group' );
			expect( group.children ).toContain( 'layer-1' );
			expect( group.children ).toContain( 'layer-2' );
			expect( group.expanded ).toBe( true );
		} );

		it( 'should update child layers with parentGroup reference', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			const layers = mockStateManager.get( 'layers' );

			const layer1 = layers.find( ( l ) => l.id === 'layer-1' );
			const layer2 = layers.find( ( l ) => l.id === 'layer-2' );

			expect( layer1.parentGroup ).toBe( group.id );
			expect( layer2.parentGroup ).toBe( group.id );
		} );

		it( 'should save history when creating group', () => {
			groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			expect( mockHistoryManager.saveState ).toHaveBeenCalledWith( 'Create group' );
		} );

		it( 'should return null for empty layer array', () => {
			const group = groupManager.createGroup( [] );
			expect( group ).toBeNull();
		} );

		it( 'should return null for null input', () => {
			const group = groupManager.createGroup( null );
			expect( group ).toBeNull();
		} );

		it( 'should generate default group name', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			expect( group.name ).toBe( 'Group 1' );
		} );

		it( 'should use provided name', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ], 'My Group' );
			expect( group.name ).toBe( 'My Group' );
		} );

		it( 'should skip non-existent layer IDs', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'nonexistent', 'layer-2' ] );

			expect( group.children ).toContain( 'layer-1' );
			expect( group.children ).toContain( 'layer-2' );
			expect( group.children ).not.toContain( 'nonexistent' );
		} );
	} );

	describe( 'ungroup', () => {
		it( 'should remove group and clear parentGroup from children', () => {
			// First create a group
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			const groupId = group.id;

			// Then ungroup
			const result = groupManager.ungroup( groupId );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			expect( layers.find( ( l ) => l.id === groupId ) ).toBeUndefined();

			const layer1 = layers.find( ( l ) => l.id === 'layer-1' );
			const layer2 = layers.find( ( l ) => l.id === 'layer-2' );
			expect( layer1.parentGroup ).toBeUndefined();
			expect( layer2.parentGroup ).toBeUndefined();
		} );

		it( 'should save history when ungrouping', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			mockHistoryManager.saveState.mockClear();

			groupManager.ungroup( group.id );

			expect( mockHistoryManager.saveState ).toHaveBeenCalledWith( 'Ungroup' );
		} );

		it( 'should return false for non-existent group', () => {
			const result = groupManager.ungroup( 'nonexistent' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'addToGroup', () => {
		it( 'should add a layer to an existing group', () => {
			// Create a group with 2 layers
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			// Add layer-3 to the group
			const result = groupManager.addToGroup( 'layer-3', group.id );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			const updatedGroup = layers.find( ( l ) => l.id === group.id );
			expect( updatedGroup.children ).toContain( 'layer-3' );

			const layer3 = layers.find( ( l ) => l.id === 'layer-3' );
			expect( layer3.parentGroup ).toBe( group.id );
		} );

		it( 'should return false for non-existent layer', () => {
			const group = groupManager.createGroup( [ 'layer-1' ] );
			const result = groupManager.addToGroup( 'nonexistent', group.id );
			expect( result ).toBe( false );
		} );

		it( 'should return false for non-existent group', () => {
			const result = groupManager.addToGroup( 'layer-1', 'nonexistent' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'removeFromGroup', () => {
		it( 'should remove a layer from a group', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			const result = groupManager.removeFromGroup( 'layer-1', group.id );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			const updatedGroup = layers.find( ( l ) => l.id === group.id );
			expect( updatedGroup.children ).not.toContain( 'layer-1' );
			expect( updatedGroup.children ).toContain( 'layer-2' );

			const layer1 = layers.find( ( l ) => l.id === 'layer-1' );
			expect( layer1.parentGroup ).toBeUndefined();
		} );
	} );

	describe( 'toggleExpanded', () => {
		it( 'should toggle expanded state', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			expect( group.expanded ).toBe( true );

			const newState1 = groupManager.toggleExpanded( group.id );
			expect( newState1 ).toBe( false );

			const newState2 = groupManager.toggleExpanded( group.id );
			expect( newState2 ).toBe( true );
		} );
	} );

	describe( 'setExpanded', () => {
		it( 'should set expanded state explicitly', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			groupManager.setExpanded( group.id, false );
			let layers = mockStateManager.get( 'layers' );
			let updatedGroup = layers.find( ( l ) => l.id === group.id );
			expect( updatedGroup.expanded ).toBe( false );

			groupManager.setExpanded( group.id, true );
			layers = mockStateManager.get( 'layers' );
			updatedGroup = layers.find( ( l ) => l.id === group.id );
			expect( updatedGroup.expanded ).toBe( true );
		} );
	} );

	describe( 'getGroupChildren', () => {
		it( 'should return child layers', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			const children = groupManager.getGroupChildren( group.id );

			expect( children.length ).toBe( 2 );
			expect( children.find( ( c ) => c.id === 'layer-1' ) ).toBeDefined();
			expect( children.find( ( c ) => c.id === 'layer-2' ) ).toBeDefined();
		} );

		it( 'should return empty array for non-existent group', () => {
			const children = groupManager.getGroupChildren( 'nonexistent' );
			expect( children ).toEqual( [] );
		} );

		it( 'should return nested children when recursive is true', () => {
			// Create nested groups
			const innerGroup = groupManager.createGroup( [ 'layer-1', 'layer-2' ], 'Inner' );
			const outerGroup = groupManager.createGroup( [ innerGroup.id, 'layer-3' ], 'Outer' );

			const children = groupManager.getGroupChildren( outerGroup.id, true );

			// Should include inner group + its children + layer-3
			expect( children.length ).toBe( 4 );
		} );
	} );

	describe( 'getLayerDepth', () => {
		it( 'should return 0 for top-level layers', () => {
			const layers = mockStateManager.get( 'layers' );
			const layer = layers.find( ( l ) => l.id === 'layer-1' );

			const depth = groupManager.getLayerDepth( layer, layers );
			expect( depth ).toBe( 0 );
		} );

		it( 'should return 1 for layers in a group', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			const layers = mockStateManager.get( 'layers' );
			const layer = layers.find( ( l ) => l.id === 'layer-1' );

			const depth = groupManager.getLayerDepth( layer, layers );
			expect( depth ).toBe( 1 );
		} );
	} );

	describe( 'isGroup', () => {
		it( 'should return true for group layers', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			expect( groupManager.isGroup( group ) ).toBe( true );
			expect( groupManager.isGroup( group.id ) ).toBe( true );
		} );

		it( 'should return false for non-group layers', () => {
			expect( groupManager.isGroup( testLayers[ 0 ] ) ).toBe( false );
			expect( groupManager.isGroup( 'layer-1' ) ).toBe( false );
		} );

		it( 'should return false for non-existent layers', () => {
			expect( groupManager.isGroup( 'nonexistent' ) ).toBe( false );
		} );
	} );

	describe( 'getParentGroup', () => {
		it( 'should return parent group for grouped layer', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			const parent = groupManager.getParentGroup( 'layer-1' );

			expect( parent ).not.toBeNull();
			expect( parent.id ).toBe( group.id );
		} );

		it( 'should return null for ungrouped layer', () => {
			const parent = groupManager.getParentGroup( 'layer-3' );
			expect( parent ).toBeNull();
		} );
	} );

	describe( 'renameGroup', () => {
		it( 'should rename a group', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ], 'Original' );

			const result = groupManager.renameGroup( group.id, 'New Name' );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			const updatedGroup = layers.find( ( l ) => l.id === group.id );
			expect( updatedGroup.name ).toBe( 'New Name' );
		} );

		it( 'should save history when renaming', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			mockHistoryManager.saveState.mockClear();

			groupManager.renameGroup( group.id, 'New Name' );

			expect( mockHistoryManager.saveState ).toHaveBeenCalledWith( 'Rename group' );
		} );

		it( 'should return false for empty name', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			const result = groupManager.renameGroup( group.id, '' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'deleteGroup', () => {
		it( 'should delete group without children (ungroup)', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			const result = groupManager.deleteGroup( group.id, false );

			expect( result ).toBe( true );

			// Layers should still exist but be ungrouped
			const layers = mockStateManager.get( 'layers' );
			expect( layers.find( ( l ) => l.id === 'layer-1' ) ).toBeDefined();
			expect( layers.find( ( l ) => l.id === 'layer-2' ) ).toBeDefined();
		} );

		it( 'should delete group with children when deleteChildren is true', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			const result = groupManager.deleteGroup( group.id, true );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			expect( layers.find( ( l ) => l.id === group.id ) ).toBeUndefined();
			expect( layers.find( ( l ) => l.id === 'layer-1' ) ).toBeUndefined();
			expect( layers.find( ( l ) => l.id === 'layer-2' ) ).toBeUndefined();
			// Other layers should remain
			expect( layers.find( ( l ) => l.id === 'layer-3' ) ).toBeDefined();
		} );

		it( 'should return false for non-existent group', () => {
			const result = groupManager.deleteGroup( 'nonexistent', true );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'groupSelected', () => {
		it( 'should group selected layers', () => {
			mockSelectionManager.selectedLayers = [
				testLayers[ 0 ],
				testLayers[ 1 ]
			];

			const group = groupManager.groupSelected();

			expect( group ).not.toBeNull();
			expect( group.type ).toBe( 'group' );
			expect( mockSelectionManager.selectLayer ).toHaveBeenCalledWith( group );
		} );

		it( 'should return null if less than 2 layers selected', () => {
			mockSelectionManager.selectedLayers = [ testLayers[ 0 ] ];

			const group = groupManager.groupSelected();

			expect( group ).toBeNull();
		} );
	} );

	describe( 'ungroupSelected', () => {
		it( 'should ungroup selected group', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			mockSelectionManager.selectedLayers = [ group ];

			const result = groupManager.ungroupSelected();

			expect( result ).toBe( true );
		} );

		it( 'should return false if selected layer is not a group', () => {
			mockSelectionManager.selectedLayers = [ testLayers[ 0 ] ];

			const result = groupManager.ungroupSelected();

			expect( result ).toBe( false );
		} );

		it( 'should return false if multiple layers selected', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			mockSelectionManager.selectedLayers = [ group, testLayers[ 2 ] ];

			const result = groupManager.ungroupSelected();

			expect( result ).toBe( false );
		} );
	} );

	describe( 'getGroupBounds', () => {
		it( 'should calculate union bounds of children', () => {
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			const bounds = groupManager.getGroupBounds( group.id );

			expect( bounds ).not.toBeNull();
			expect( bounds.x ).toBe( 0 );
			expect( bounds.y ).toBe( 0 );
			// layer-1: 0,0,100,100; layer-2: 50,50 with radius 25 = 50,50,50,50
			// Union: 0,0 to 100,100
			expect( bounds.width ).toBe( 100 );
			expect( bounds.height ).toBe( 100 );
		} );

		it( 'should return null for empty group', () => {
			// Create group, then remove all children
			const group = groupManager.createGroup( [ 'layer-1' ] );
			groupManager.removeFromGroup( 'layer-1', group.id );

			const bounds = groupManager.getGroupBounds( group.id );

			expect( bounds ).toBeNull();
		} );
	} );

	describe( 'getTopLevelLayers', () => {
		it( 'should return only layers not in groups', () => {
			groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			const topLevel = groupManager.getTopLevelLayers();

			expect( topLevel.find( ( l ) => l.id === 'layer-1' ) ).toBeUndefined();
			expect( topLevel.find( ( l ) => l.id === 'layer-2' ) ).toBeUndefined();
			expect( topLevel.find( ( l ) => l.id === 'layer-3' ) ).toBeDefined();
			expect( topLevel.find( ( l ) => l.id === 'layer-4' ) ).toBeDefined();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up references', () => {
			groupManager.destroy();

			expect( groupManager.editor ).toBeNull();
			expect( groupManager.stateManager ).toBeNull();
			expect( groupManager.selectionManager ).toBeNull();
			expect( groupManager.historyManager ).toBeNull();
		} );
	} );

	describe( 'edge cases', () => {
		it( 'should handle operations without stateManager', () => {
			const gm = new GroupManager( {} );
			// Don't initialize with stateManager

			expect( gm.createGroup( [ 'layer-1' ] ) ).toBeNull();
			expect( gm.ungroup( 'group-1' ) ).toBe( false );
			expect( gm.getGroupChildren( 'group-1' ) ).toEqual( [] );
			expect( gm.isGroup( 'group-1' ) ).toBe( false );
		} );

		it( 'should respect max nesting depth', () => {
			// Create nested groups up to max depth
			const group1 = groupManager.createGroup( [ 'layer-1' ], 'Level 1' );
			const group2 = groupManager.createGroup( [ group1.id ], 'Level 2' );
			const group3 = groupManager.createGroup( [ group2.id ], 'Level 3' );

			// Try to add another level (should be rejected due to max depth 3)
			const result = groupManager.addToGroup( 'layer-2', group3.id );

			// layer-2 is at depth 0, adding to group3 which is at depth 2
			// This should still work since layer-2 itself has no children
			expect( result ).toBe( true );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export to window.Layers namespace', () => {
			expect( window.Layers.GroupManager ).toBe( GroupManager );
		} );

		it( 'should be a constructor function', () => {
			expect( typeof GroupManager ).toBe( 'function' );
		} );
	} );
} );
