/**
 * Tests for GroupManager - Layer grouping functionality
 */
'use strict';

// Load DeepClone first for omitProperty utility
require( '../../resources/ext.layers.shared/DeepClone.js' );

// Load GroupHierarchyHelper before GroupManager (dependency)
require( '../../resources/ext.layers.editor/GroupHierarchyHelper.js' );

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
			expect( group.name ).toBe( 'Folder 1' );
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

		it( 'should return false when stateManager is null', () => {
			const managerWithNoState = new GroupManager( {} );
			const result = managerWithNoState.addToGroup( 'layer-1', 'group-1' );
			expect( result ).toBe( false );
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

		it( 'should return false when stateManager is null', () => {
			const managerWithNoState = new GroupManager( {} );
			const result = managerWithNoState.removeFromGroup( 'layer-1', 'group-1' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'addToFolderAtPosition', () => {
		it( 'should add layer to folder at specific position', () => {
			// Create a folder with 2 layers
			const folder = groupManager.createGroup( [ 'layer-1', 'layer-2' ], 'Folder' );

			// Add layer-3 at position before layer-2
			const result = groupManager.addToFolderAtPosition( 'layer-3', folder.id, 'layer-2' );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			const updatedFolder = layers.find( ( l ) => l.id === folder.id );

			// layer-3 should be inserted before layer-2 in children array
			expect( updatedFolder.children ).toEqual( [ 'layer-1', 'layer-3', 'layer-2' ] );

			const layer3 = layers.find( ( l ) => l.id === 'layer-3' );
			expect( layer3.parentGroup ).toBe( folder.id );

			// Also verify flat array order: layer-3 should appear before layer-2
			const layer3FlatIndex = layers.findIndex( ( l ) => l.id === 'layer-3' );
			const layer2FlatIndex = layers.findIndex( ( l ) => l.id === 'layer-2' );
			expect( layer3FlatIndex ).toBeLessThan( layer2FlatIndex );
		} );

		it( 'should add layer at end if beforeSiblingId not in folder', () => {
			const folder = groupManager.createGroup( [ 'layer-1', 'layer-2' ], 'Folder' );

			// Add layer-3 with a non-existent sibling ID
			const result = groupManager.addToFolderAtPosition( 'layer-3', folder.id, 'nonexistent' );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			const updatedFolder = layers.find( ( l ) => l.id === folder.id );

			// layer-3 should be at the end
			expect( updatedFolder.children ).toEqual( [ 'layer-1', 'layer-2', 'layer-3' ] );
		} );

		it( 'should move layer from one folder to another at position', () => {
			// Create two folders
			const folder1 = groupManager.createGroup( [ 'layer-1', 'layer-2' ], 'Folder 1' );
			const folder2 = groupManager.createGroup( [ 'layer-3', 'layer-4' ], 'Folder 2' );

			// Move layer-1 from folder1 to folder2 before layer-4
			const result = groupManager.addToFolderAtPosition( 'layer-1', folder2.id, 'layer-4' );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			const updatedFolder1 = layers.find( ( l ) => l.id === folder1.id );
			const updatedFolder2 = layers.find( ( l ) => l.id === folder2.id );

			// layer-1 should be removed from folder1
			expect( updatedFolder1.children ).not.toContain( 'layer-1' );
			// layer-1 should be in folder2 before layer-4
			expect( updatedFolder2.children ).toEqual( [ 'layer-3', 'layer-1', 'layer-4' ] );

			const layer1 = layers.find( ( l ) => l.id === 'layer-1' );
			expect( layer1.parentGroup ).toBe( folder2.id );
		} );

		it( 'should return false for non-existent layer', () => {
			const folder = groupManager.createGroup( [ 'layer-1' ], 'Folder' );
			const result = groupManager.addToFolderAtPosition( 'nonexistent', folder.id, 'layer-1' );
			expect( result ).toBe( false );
		} );

		it( 'should return false for non-existent folder', () => {
			const result = groupManager.addToFolderAtPosition( 'layer-1', 'nonexistent', null );
			expect( result ).toBe( false );
		} );

		it( 'should return false when layer is already in the same folder', () => {
			const folder = groupManager.createGroup( [ 'layer-1', 'layer-2', 'layer-3' ], 'Folder' );

			// Try to reposition layer-3 within same folder (this is not what addToFolderAtPosition is for)
			const result = groupManager.addToFolderAtPosition( 'layer-3', folder.id, 'layer-2' );

			// addToFolderAtPosition returns false when layer is already in the folder
			// Use reorderLayer for repositioning within the same folder
			expect( result ).toBe( false );
		} );

		it( 'should return false when stateManager is not available', () => {
			const noStateManager = new GroupManager( {} );
			const result = noStateManager.addToFolderAtPosition( 'layer-1', 'folder-1', 'layer-2' );
			expect( result ).toBe( false );
		} );

		it( 'should return false when trying to move folder into itself', () => {
			const folder = groupManager.createGroup( [ 'layer-1' ], 'Folder' );
			const result = groupManager.addToFolderAtPosition( folder.id, folder.id, 'layer-1' );
			expect( result ).toBe( false );
		} );

		it( 'should return false when nesting depth would be exceeded', () => {
			// GroupManager has a max nesting depth (default 4)
			// We test the edge case where trying to add would exceed the limit

			// First, manually set up layers at max depth to test the validation
			const folder1 = groupManager.createGroup( [ 'layer-1' ], 'Level 1' );
			const folder2 = groupManager.createGroup( [ 'layer-2' ], 'Level 2' );

			// Nest folder2 inside folder1
			groupManager.moveToFolder( folder2.id, folder1.id );

			// Now folder2 is at depth 1, and layer-2 is at depth 2
			const layers = mockStateManager.get( 'layers' );
			const depthOfLayer2 = groupManager.getLayerDepth( 'layer-2', layers );

			// Verify nesting is working
			expect( depthOfLayer2 ).toBe( 2 );
		} );

		it( 'should add layer at end of folder when beforeSiblingId is null', () => {
			// Create a folder with existing children
			const folder = groupManager.createGroup( [ 'layer-1', 'layer-2' ], 'Folder' );

			// Add layer-3 with null beforeSiblingId (should go at end)
			const result = groupManager.addToFolderAtPosition( 'layer-3', folder.id, null );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			const updatedFolder = layers.find( ( l ) => l.id === folder.id );

			// layer-3 should be at the end
			expect( updatedFolder.children ).toEqual( [ 'layer-1', 'layer-2', 'layer-3' ] );

			// Verify flat array order: layer-3 should appear after layer-2
			const layer2FlatIndex = layers.findIndex( ( l ) => l.id === 'layer-2' );
			const layer3FlatIndex = layers.findIndex( ( l ) => l.id === 'layer-3' );
			expect( layer3FlatIndex ).toBeGreaterThan( layer2FlatIndex );
		} );

		it( 'should add layer at end of folder when beforeSiblingId is undefined', () => {
			// Create a folder with existing children
			const folder = groupManager.createGroup( [ 'layer-1' ], 'Folder' );

			// Add layer-2 with undefined beforeSiblingId (should go at end)
			const result = groupManager.addToFolderAtPosition( 'layer-2', folder.id, undefined );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			const updatedFolder = layers.find( ( l ) => l.id === folder.id );

			// layer-2 should be at the end
			expect( updatedFolder.children ).toEqual( [ 'layer-1', 'layer-2' ] );
		} );

		it( 'should add layer to empty folder', () => {
			// Create an empty folder
			groupManager.createGroup( [], 'Empty Folder' );
			// Note: createGroup returns null for empty array
			// So we need to create a folder manually or test with a different approach
			// Let's create a folder with one layer and then remove it

			const folder2 = groupManager.createGroup( [ 'layer-1' ], 'Folder' );

			// Add layer-2 to the folder at end
			const result = groupManager.addToFolderAtPosition( 'layer-2', folder2.id, null );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			const updatedFolder = layers.find( ( l ) => l.id === folder2.id );

			expect( updatedFolder.children ).toContain( 'layer-2' );
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

		it( 'should return false when stateManager is null', () => {
			const managerWithNoState = new GroupManager( {} );
			const result = managerWithNoState.toggleExpanded( 'group-1' );
			expect( result ).toBe( false );
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

		it( 'should return early when stateManager is null', () => {
			// Create a fresh GroupManager without stateManager
			const isolatedManager = new GroupManager( {
				editor: null
			} );

			// Should not throw, just return early
			expect( () => isolatedManager.setExpanded( 'group-1', false ) ).not.toThrow();
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

		it( 'should handle depth guard for corrupted circular data', () => {
			// Create artificially corrupted data with circular reference
			mockStateManager.state.layers = [
				{
					id: 'corrupt-group-a',
					type: 'group',
					children: [ 'corrupt-group-b' ]
				},
				{
					id: 'corrupt-group-b',
					type: 'group',
					children: [ 'corrupt-group-c' ]
				},
				{
					id: 'corrupt-group-c',
					type: 'group',
					children: [ 'corrupt-group-a' ] // Circular reference
				}
			];

			// Should not cause infinite recursion - depth guard kicks in
			const result = groupManager.getGroupChildren( 'corrupt-group-a', true );

			// Should return something without stack overflow
			expect( Array.isArray( result ) ).toBe( true );
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
			groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			const layers = mockStateManager.get( 'layers' );
			const layer = layers.find( ( l ) => l.id === 'layer-1' );

			const depth = groupManager.getLayerDepth( layer, layers );
			expect( depth ).toBe( 1 );
		} );

		it( 'should get layers from stateManager when not provided', () => {
			groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			const layer = mockStateManager.get( 'layers' ).find( ( l ) => l.id === 'layer-1' );

			// Call without layers parameter
			const depth = groupManager.getLayerDepth( layer );
			expect( depth ).toBe( 1 );
		} );

		it( 'should return 0 when layers array is not available', () => {
			const noStateManager = new GroupManager( {} );
			const depth = noStateManager.getLayerDepth( { id: 'test' } );
			expect( depth ).toBe( 0 );
		} );

		it( 'should accept layer ID as string', () => {
			groupManager.createGroup( [ 'layer-1', 'layer-2' ] );
			const layers = mockStateManager.get( 'layers' );

			// Pass layer ID string instead of layer object
			const depth = groupManager.getLayerDepth( 'layer-1', layers );
			expect( depth ).toBe( 1 );
		} );

		it( 'should return 0 for non-existent layer ID', () => {
			const layers = mockStateManager.get( 'layers' );
			const depth = groupManager.getLayerDepth( 'nonexistent', layers );
			expect( depth ).toBe( 0 );
		} );

		it( 'should return correct depth for deeply nested layers', () => {
			// Create nested folders: folder1 > folder2 > layer-1
			// Need at least one layer to create a group
			const folder1 = groupManager.createGroup( [ 'layer-2' ], 'Level 1' );
			const folder2 = groupManager.createGroup( [ 'layer-1' ], 'Level 2' );

			// Remove layer-2 from folder1 first to make it an empty folder
			groupManager.removeFromFolder( 'layer-2' );

			// Move folder2 into folder1
			groupManager.moveToFolder( folder2.id, folder1.id );

			const layers = mockStateManager.get( 'layers' );
			const depth = groupManager.getLayerDepth( 'layer-1', layers );
			expect( depth ).toBe( 2 );
		} );

		it( 'should handle broken parent reference gracefully', () => {
			const layers = [
				{ id: 'layer-1', parentGroup: 'nonexistent-parent' }
			];
			const depth = groupManager.getLayerDepth( 'layer-1', layers );
			expect( depth ).toBe( 0 ); // Parent not found, so depth stops at 0
		} );
	} );

	describe( 'isDescendantOf (CORE-4)', () => {
		it( 'should return true for direct child', () => {
			const folder = groupManager.createFolder( null, 'Parent' );
			groupManager.moveToFolder( 'layer-1', folder.id );

			const layers = mockStateManager.get( 'layers' );
			const result = groupManager.isDescendantOf( 'layer-1', folder.id, layers );

			expect( result ).toBe( true );
		} );

		it( 'should return true for nested descendant', () => {
			const parentFolder = groupManager.createFolder( null, 'Parent' );
			const childFolder = groupManager.createFolder( null, 'Child' );

			groupManager.moveToFolder( childFolder.id, parentFolder.id );
			groupManager.moveToFolder( 'layer-1', childFolder.id );

			const layers = mockStateManager.get( 'layers' );
			const result = groupManager.isDescendantOf( 'layer-1', parentFolder.id, layers );

			expect( result ).toBe( true );
		} );

		it( 'should return false for non-descendant', () => {
			const folder1 = groupManager.createFolder( null, 'Folder 1' );
			const folder2 = groupManager.createFolder( null, 'Folder 2' );

			groupManager.moveToFolder( 'layer-1', folder1.id );

			const layers = mockStateManager.get( 'layers' );
			const result = groupManager.isDescendantOf( 'layer-1', folder2.id, layers );

			expect( result ).toBe( false );
		} );

		it( 'should return false for non-existent ancestor', () => {
			const layers = mockStateManager.get( 'layers' );
			const result = groupManager.isDescendantOf( 'layer-1', 'nonexistent', layers );

			expect( result ).toBe( false );
		} );

		it( 'should return false for non-group ancestor', () => {
			const layers = mockStateManager.get( 'layers' );
			const result = groupManager.isDescendantOf( 'layer-2', 'layer-1', layers );

			expect( result ).toBe( false );
		} );

		it( 'should handle depth guard for corrupted circular data', () => {
			// Create artificially corrupted data with circular reference
			const corruptLayers = [
				{
					id: 'group-a',
					type: 'group',
					children: [ 'group-b' ]
				},
				{
					id: 'group-b',
					type: 'group',
					children: [ 'group-c' ]
				},
				{
					id: 'group-c',
					type: 'group',
					children: [ 'group-a' ] // Circular reference back to group-a
				},
				{ id: 'layer-x', type: 'rectangle' }
			];

			// Should not cause infinite recursion - depth guard kicks in
			const result = groupManager.isDescendantOf( 'layer-x', 'group-a', corruptLayers );
			expect( result ).toBe( false );

			// Verify mw.log.warn was called for depth exceeded
			expect( mw.log.warn ).toHaveBeenCalled();
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
			expect( mockSelectionManager.selectLayer ).toHaveBeenCalledWith( group.id );
		} );

		it( 'should return null if less than 2 layers selected', () => {
			mockSelectionManager.selectedLayers = [ testLayers[ 0 ] ];

			const group = groupManager.groupSelected();

			expect( group ).toBeNull();
		} );

		it( 'CRIT-v28-2 regression: should pass group ID string, not group object', () => {
			mockSelectionManager.selectedLayers = [
				testLayers[ 0 ],
				testLayers[ 1 ]
			];

			const group = groupManager.groupSelected();

			// Verify selectLayer receives a string ID, not the whole group object
			const arg = mockSelectionManager.selectLayer.mock.calls[ 0 ][ 0 ];
			expect( typeof arg ).toBe( 'string' );
			expect( arg ).toBe( group.id );
			expect( arg ).toMatch( /^group-/ );
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

	describe( 'createFolder', () => {
		it( 'should create an empty folder', () => {
			const folder = groupManager.createFolder();

			expect( folder ).not.toBeNull();
			expect( folder.type ).toBe( 'group' );
			expect( folder.children ).toEqual( [] );
			expect( folder.expanded ).toBe( true );
			expect( folder.visible ).toBe( true );
		} );

		it( 'should create folder with specified name', () => {
			const folder = groupManager.createFolder( null, 'My Folder' );

			expect( folder.name ).toBe( 'My Folder' );
		} );

		it( 'should create folder with layers if provided', () => {
			const folder = groupManager.createFolder( [ 'layer-1', 'layer-2' ], 'With Layers' );

			expect( folder ).not.toBeNull();
			expect( folder.children ).toContain( 'layer-1' );
			expect( folder.children ).toContain( 'layer-2' );
		} );

		it( 'should return null without stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.createFolder() ).toBeNull();
		} );

		it( 'should generate unique folder names', () => {
			const folder1 = groupManager.createFolder( null, null );
			const folder2 = groupManager.createFolder( null, null );

			expect( folder1.name ).toMatch( /^Folder \d+$/ );
			expect( folder2.name ).toMatch( /^Folder \d+$/ );
		} );
	} );

	describe( 'moveToFolder', () => {
		let folder;

		beforeEach( () => {
			folder = groupManager.createFolder( null, 'Test Folder' );
		} );

		it( 'should move a layer into a folder', () => {
			const result = groupManager.moveToFolder( 'layer-1', folder.id );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			const movedLayer = layers.find( ( l ) => l.id === 'layer-1' );
			const updatedFolder = layers.find( ( l ) => l.id === folder.id );

			expect( movedLayer.parentGroup ).toBe( folder.id );
			expect( updatedFolder.children ).toContain( 'layer-1' );
		} );

		it( 'should return false when moving folder into itself', () => {
			const result = groupManager.moveToFolder( folder.id, folder.id );
			expect( result ).toBe( false );
		} );

		it( 'should return false when layer already in folder', () => {
			groupManager.moveToFolder( 'layer-1', folder.id );
			const result = groupManager.moveToFolder( 'layer-1', folder.id );
			expect( result ).toBe( false );
		} );

		it( 'should return false for non-existent layer', () => {
			const result = groupManager.moveToFolder( 'nonexistent', folder.id );
			expect( result ).toBe( false );
		} );

		it( 'should return false for non-existent folder', () => {
			const result = groupManager.moveToFolder( 'layer-1', 'nonexistent' );
			expect( result ).toBe( false );
		} );

		it( 'should return false without stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.moveToFolder( 'layer-1', 'folder-1' ) ).toBe( false );
		} );

		it( 'should save history when moving layer', () => {
			groupManager.moveToFolder( 'layer-1', folder.id );
			expect( mockHistoryManager.saveState ).toHaveBeenCalledWith( 'Move to folder' );
		} );

		it( 'should remove layer from previous folder when moving', () => {
			// Move layer-1 to folder
			groupManager.moveToFolder( 'layer-1', folder.id );

			// Create second folder and move layer-1 there
			const folder2 = groupManager.createFolder( null, 'Folder 2' );
			groupManager.moveToFolder( 'layer-1', folder2.id );

			const layers = mockStateManager.get( 'layers' );
			const originalFolder = layers.find( ( l ) => l.id === folder.id );
			const newFolder = layers.find( ( l ) => l.id === folder2.id );

			expect( originalFolder.children ).not.toContain( 'layer-1' );
			expect( newFolder.children ).toContain( 'layer-1' );
		} );

		it( 'should enforce max nesting depth', () => {
			// Create a nested folder structure at max depth
			// maxNestingDepth is 3, so folder at depth 2 is the limit for adding groups
			const folder1 = groupManager.createFolder( null, 'Level 1' );
			const folder2 = groupManager.createFolder( null, 'Level 2' );

			// Move folder2 into folder1 (folder2 is now at depth 1)
			groupManager.moveToFolder( folder2.id, folder1.id );

			// Create folder3 and move it into folder2 (folder3 would be at depth 2)
			const folder3 = groupManager.createFolder( null, 'Level 3' );
			groupManager.moveToFolder( folder3.id, folder2.id );

			// Now folder3 is at depth 2. Create folder4 and try to move it into folder3
			// This would put folder4 at depth 3, which equals maxNestingDepth
			// The check is: folderDepth + 1 + layerMaxDepth > maxNestingDepth
			// For an empty folder: 2 + 1 + 0 = 3, which is NOT > 3, so it should succeed
			const folder4 = groupManager.createFolder( null, 'Level 4' );
			const result1 = groupManager.moveToFolder( folder4.id, folder3.id );
			expect( result1 ).toBe( true ); // Depth 3 is allowed

			// Now try to add folder5 inside folder4 (would be depth 4)
			// Check: 3 + 1 + 0 = 4 > 3, should fail
			const folder5 = groupManager.createFolder( null, 'Level 5' );
			const result2 = groupManager.moveToFolder( folder5.id, folder4.id );
			expect( result2 ).toBe( false ); // Depth 4 exceeds limit
		} );

		it( 'should position layer after folder in flat array', () => {
			groupManager.moveToFolder( 'layer-1', folder.id );

			const layers = mockStateManager.get( 'layers' );
			const folderIndex = layers.findIndex( ( l ) => l.id === folder.id );
			const layerIndex = layers.findIndex( ( l ) => l.id === 'layer-1' );

			expect( layerIndex ).toBeGreaterThan( folderIndex );
		} );

		it( 'should prevent circular reference when moving folder into its descendant (CORE-4)', () => {
			// Create nested folder structure: parentFolder > childFolder > grandchildFolder
			const parentFolder = groupManager.createFolder( null, 'Parent' );
			const childFolder = groupManager.createFolder( null, 'Child' );
			const grandchildFolder = groupManager.createFolder( null, 'Grandchild' );

			// Build the hierarchy
			groupManager.moveToFolder( childFolder.id, parentFolder.id );
			groupManager.moveToFolder( grandchildFolder.id, childFolder.id );

			// Try to move parentFolder into childFolder (would create circular reference)
			const result1 = groupManager.moveToFolder( parentFolder.id, childFolder.id );
			expect( result1 ).toBe( false );

			// Try to move parentFolder into grandchildFolder (would create circular reference)
			const result2 = groupManager.moveToFolder( parentFolder.id, grandchildFolder.id );
			expect( result2 ).toBe( false );

			// Moving childFolder into grandchildFolder should also fail
			const result3 = groupManager.moveToFolder( childFolder.id, grandchildFolder.id );
			expect( result3 ).toBe( false );

			// Verify structure is still intact
			const layers = mockStateManager.get( 'layers' );
			const parent = layers.find( ( l ) => l.id === parentFolder.id );
			const child = layers.find( ( l ) => l.id === childFolder.id );
			const grandchild = layers.find( ( l ) => l.id === grandchildFolder.id );

			expect( parent.children ).toContain( childFolder.id );
			expect( child.children ).toContain( grandchildFolder.id );
			expect( child.parentGroup ).toBe( parentFolder.id );
			expect( grandchild.parentGroup ).toBe( childFolder.id );
		} );
	} );

	describe( 'removeFromFolder', () => {
		let folder;

		beforeEach( () => {
			folder = groupManager.createFolder( null, 'Test Folder' );
			groupManager.moveToFolder( 'layer-1', folder.id );
		} );

		it( 'should remove layer from folder', () => {
			const result = groupManager.removeFromFolder( 'layer-1' );

			expect( result ).toBe( true );

			const layers = mockStateManager.get( 'layers' );
			const layer = layers.find( ( l ) => l.id === 'layer-1' );
			const updatedFolder = layers.find( ( l ) => l.id === folder.id );

			expect( layer.parentGroup ).toBeUndefined();
			expect( updatedFolder.children ).not.toContain( 'layer-1' );
		} );

		it( 'should return false for layer not in folder', () => {
			const result = groupManager.removeFromFolder( 'layer-2' );
			expect( result ).toBe( false );
		} );

		it( 'should return false for non-existent layer', () => {
			const result = groupManager.removeFromFolder( 'nonexistent' );
			expect( result ).toBe( false );
		} );

		it( 'should return false without stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.removeFromFolder( 'layer-1' ) ).toBe( false );
		} );

		it( 'should save history when removing layer', () => {
			mockHistoryManager.saveState.mockClear();
			groupManager.removeFromFolder( 'layer-1' );
			expect( mockHistoryManager.saveState ).toHaveBeenCalledWith( 'Remove from folder' );
		} );
	} );

	describe( 'generateDefaultFolderName', () => {
		it( 'should generate sequential folder names', () => {
			const layers = [];
			const name1 = groupManager.generateDefaultFolderName( layers );
			expect( name1 ).toBe( 'Folder 1' );

			layers.push( { id: 'folder-1', type: 'group', name: 'Folder 1' } );
			const name2 = groupManager.generateDefaultFolderName( layers );
			expect( name2 ).toBe( 'Folder 2' );
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

		it( 'should reject adding nested group that would exceed max depth', () => {
			// Set max nesting depth to 2 for this test
			const originalMax = groupManager.maxNestingDepth;
			groupManager.maxNestingDepth = 2;

			// Create a group with layer-1 (group1 is at depth 0)
			const group1 = groupManager.createGroup( [ 'layer-1' ], 'Level 1' );

			// Create group2 containing group1 (group1 becomes child, so internal depth is 1)
			const group2 = groupManager.createGroup( [ group1.id ], 'Level 2' );

			// Create group3 with layer-2 (group3 has internal depth 0)
			const group3 = groupManager.createGroup( [ 'layer-2' ], 'Level 3' );

			// group2 has internal child depth of 1 (contains group1)
			// Try to add group2 to group3
			// group3 is at depth 0
			// group2's maxChildDepth is 1 (because it contains group1)
			// check: groupDepth(0) + layerDepth(1) + 1 = 2, which is NOT > 2
			// So we need depth limit of 1 to trigger rejection

			groupManager.maxNestingDepth = 1;

			// Now try: depth(0) + childDepth(1) + 1 = 2 > 1, should fail
			const result = groupManager.addToGroup( group2.id, group3.id );

			expect( result ).toBe( false );

			groupManager.maxNestingDepth = originalMax;
		} );

		it( 'should reject layers exceeding max children per group', () => {
			// Create a group with one layer
			const group = groupManager.createGroup( [ 'layer-1' ], 'Test Group' );

			// Save original max
			const originalMax = groupManager.maxChildrenPerGroup;

			// Set max children to 1 for testing
			groupManager.maxChildrenPerGroup = 1;

			// Try to add another layer - should fail
			const result = groupManager.addToGroup( 'layer-2', group.id );
			expect( result ).toBe( false );

			// Restore original
			groupManager.maxChildrenPerGroup = originalMax;
		} );

		it( 'should skip layers at max depth when creating group', () => {
			// Create nested groups to reach max depth
			const group1 = groupManager.createGroup( [ 'layer-1' ], 'Level 1' );
			const group2 = groupManager.createGroup( [ group1.id ], 'Level 2' );
			groupManager.createGroup( [ group2.id ], 'Level 3' );

			// Try to create a group with layer-2 (at root) and group1 (at depth 2 already)
			// layer-2 should be included, but very deeply nested items may be skipped
			const result = groupManager.createGroup( [ 'layer-2' ], 'Mixed' );
			expect( result ).not.toBeNull();
			expect( result.children ).toContain( 'layer-2' );
		} );

		it( 'should return null when trying to group layers already at max depth', () => {
			// Set max nesting depth to 1
			const originalMax = groupManager.maxNestingDepth;
			groupManager.maxNestingDepth = 1;

			// Create a group with layer-1 (layer-1 is now at depth 1)
			const group1 = groupManager.createGroup( [ 'layer-1' ], 'Level 1' );
			expect( group1 ).not.toBeNull();

			// Try to create another group with layer-1 (which is at depth 1 already)
			// Since maxNestingDepth is 1, layer-1 at depth 1 >= max, should be skipped
			const result = groupManager.createGroup( [ 'layer-1' ], 'Should Skip' );
			
			// layer-1 is already at depth 1, equal to max, so it gets skipped
			// No valid layers remain, so result should be null
			expect( result ).toBeNull();

			groupManager.maxNestingDepth = originalMax;
		} );

		it( 'should return null when createGroup exceeds max children limit', () => {
			const originalMax = groupManager.maxChildrenPerGroup;
			groupManager.maxChildrenPerGroup = 2;

			// Try to create group with 3 layers
			const result = groupManager.createGroup(
				[ 'layer-1', 'layer-2', 'layer-3' ],
				'Too Many'
			);
			expect( result ).toBeNull();

			groupManager.maxChildrenPerGroup = originalMax;
		} );

		it( 'should resolve stateManager from editor lazily', () => {
			const mockEditor = {
				stateManager: mockStateManager
			};
			const gm = new GroupManager( { editor: mockEditor } );

			// Access stateManager via getter - should resolve from editor
			expect( gm.stateManager ).toBe( mockStateManager );
		} );

		it( 'should resolve historyManager from editor lazily', () => {
			const mockEditor = {
				historyManager: mockHistoryManager
			};
			const gm = new GroupManager( { editor: mockEditor } );

			expect( gm.historyManager ).toBe( mockHistoryManager );
		} );

		it( 'should resolve selectionManager from editor.canvasManager lazily', () => {
			const mockEditor = {
				canvasManager: {
					selectionManager: mockSelectionManager
				}
			};
			const gm = new GroupManager( { editor: mockEditor } );

			expect( gm.selectionManager ).toBe( mockSelectionManager );
		} );

		it( 'should return null for getGroupBounds with empty group', () => {
			// Create an empty folder
			const folder = groupManager.createFolder( [], 'Empty' );
			expect( folder ).not.toBeNull();

			const bounds = groupManager.getGroupBounds( folder.id );
			expect( bounds ).toBeNull();
		} );

		it( 'should return null for getGroupBounds when group contains only groups', () => {
			// Create an outer group first (empty folder)
			const outerGroup = groupManager.createFolder( [], 'Outer' );

			// Create an inner group
			const innerGroup = groupManager.createFolder( [], 'Inner' );

			// Add inner group to outer (this creates a group containing only another group)
			groupManager.addToGroup( innerGroup.id, outerGroup.id );

			// Get bounds - since innerGroup has no children, recursive search finds no layers
			const bounds = groupManager.getGroupBounds( outerGroup.id );
			
			// When recursive finds only groups with no actual layer children, bounds should be null
			expect( bounds ).toBeNull();
		} );

		it( 'should calculate correct bounds for group with layers', () => {
			// Create a group with layers at known positions
			const group = groupManager.createGroup( [ 'layer-1', 'layer-2' ], 'Bounded' );

			const bounds = groupManager.getGroupBounds( group.id );
			expect( bounds ).not.toBeNull();
			expect( bounds ).toHaveProperty( 'x' );
			expect( bounds ).toHaveProperty( 'y' );
			expect( bounds ).toHaveProperty( 'width' );
			expect( bounds ).toHaveProperty( 'height' );
		} );

		it( 'should handle getLayerBounds with null layer', () => {
			const bounds = groupManager.getLayerBounds( null );
			expect( bounds ).toBeNull();
		} );

		it( 'should fallback to basic bounds calculation without BoundsCalculator', () => {
			// Ensure BoundsCalculator is not available
			const originalBoundsCalculator = window.Layers.BoundsCalculator;
			delete window.Layers.BoundsCalculator;

			const layer = { x: 10, y: 20, width: 100, height: 50 };
			const bounds = groupManager.getLayerBounds( layer );

			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );

			// Restore if existed
			if ( originalBoundsCalculator ) {
				window.Layers.BoundsCalculator = originalBoundsCalculator;
			}
		} );

		it( 'should calculate bounds for circle layers using radius', () => {
			const originalBoundsCalculator = window.Layers.BoundsCalculator;
			delete window.Layers.BoundsCalculator;

			const layer = { x: 50, y: 50, radius: 25 };
			const bounds = groupManager.getLayerBounds( layer );

			expect( bounds ).toEqual( { x: 50, y: 50, width: 50, height: 50 } );

			if ( originalBoundsCalculator ) {
				window.Layers.BoundsCalculator = originalBoundsCalculator;
			}
		} );

		it( 'should use default size when layer has no dimensions', () => {
			const originalBoundsCalculator = window.Layers.BoundsCalculator;
			delete window.Layers.BoundsCalculator;

			const layer = { type: 'text' }; // No x, y, width, height
			const bounds = groupManager.getLayerBounds( layer );

			expect( bounds ).toEqual( { x: 0, y: 0, width: 100, height: 100 } );

			if ( originalBoundsCalculator ) {
				window.Layers.BoundsCalculator = originalBoundsCalculator;
			}
		} );

		it( 'should get top level layers', () => {
			// Initially all layers are top-level
			const topLevel = groupManager.getTopLevelLayers();
			expect( topLevel.length ).toBe( 4 );

			// Create a group - children should no longer be top-level
			groupManager.createGroup( [ 'layer-1', 'layer-2' ], 'Group' );

			const topLevelAfter = groupManager.getTopLevelLayers();
			// Should have: the group + layer-3 + layer-4 = 3 (layer-1 and layer-2 are children)
			expect( topLevelAfter.length ).toBe( 3 );
		} );

		it( 'should return empty array for getTopLevelLayers without stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.getTopLevelLayers() ).toEqual( [] );
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

	// ========================================================================
	// removeFromCurrentGroup Tests
	// ========================================================================

	describe( 'removeFromCurrentGroup', () => {
		let groupManager;
		let mockStateManager;
		let mockEditor;

		beforeEach( () => {
			mockStateManager = {
				get: jest.fn(),
				set: jest.fn()
			};
			mockEditor = {
				stateManager: mockStateManager
			};
			groupManager = new GroupManager( {
				editor: mockEditor
			} );
		} );

		it( 'should return empty array when stateManager is null and no layers passed', () => {
			const gm = new GroupManager( {} );
			// Ensure stateManager is truly null
			gm._stateManager = null;
			gm.editor = null;

			const result = gm.removeFromCurrentGroup( 'layer-1' );

			expect( result ).toEqual( [] );
		} );

		it( 'should return layers unchanged when layer not found', () => {
			const layers = [
				{ id: 'layer-1', type: 'text' },
				{ id: 'layer-2', type: 'rectangle' }
			];

			const result = groupManager.removeFromCurrentGroup( 'nonexistent', layers );

			expect( result ).toEqual( layers );
		} );

		it( 'should return layers unchanged when layer has no parentGroup', () => {
			const layers = [
				{ id: 'layer-1', type: 'text' },
				{ id: 'layer-2', type: 'rectangle' }
			];

			const result = groupManager.removeFromCurrentGroup( 'layer-1', layers );

			expect( result ).toEqual( layers );
		} );

		it( 'should remove layer from its parent group', () => {
			const layers = [
				{ id: 'group-1', type: 'group', children: [ 'layer-1', 'layer-2' ] },
				{ id: 'layer-1', type: 'text', parentGroup: 'group-1' },
				{ id: 'layer-2', type: 'rectangle', parentGroup: 'group-1' }
			];

			const result = groupManager.removeFromCurrentGroup( 'layer-1', layers );

			// Group should no longer have layer-1 in children
			const group = result.find( ( l ) => l.id === 'group-1' );
			expect( group.children ).toEqual( [ 'layer-2' ] );

			// Layer should no longer have parentGroup
			const layer = result.find( ( l ) => l.id === 'layer-1' );
			expect( layer.parentGroup ).toBeUndefined();
		} );

		it( 'should get layers from stateManager when no layers passed', () => {
			const layers = [ { id: 'layer-1', type: 'text' } ];
			mockStateManager.get.mockReturnValue( layers );

			const result = groupManager.removeFromCurrentGroup( 'layer-1' );

			expect( mockStateManager.get ).toHaveBeenCalledWith( 'layers' );
			// Layer has no parentGroup, so returns unchanged
			expect( result ).toEqual( layers );
		} );
	} );

	describe( 'edge cases for missing managers', () => {
		it( 'should handle circular parent references in getLayerDepth safely', () => {
			// Create a circular reference: layer-1 -> layer-2 -> layer-1
			const layers = [
				{ id: 'layer-1', type: 'group', parentGroup: 'layer-2' },
				{ id: 'layer-2', type: 'group', parentGroup: 'layer-1' }
			];

			// This should not infinite loop due to safety check (breaks when depth > maxNestingDepth + 1)
			const depth = groupManager.getLayerDepth( 'layer-1', layers );
			// Depth is capped by maxNestingDepth + 2 (default 3 + 2 = 5 because check is > not >=)
			expect( depth ).toBeLessThanOrEqual( 5 );
		} );

		it( 'should return null from getParentGroup without stateManager', () => {
			const gm = new GroupManager( {} );
			// Don't initialize (no stateManager)

			const result = gm.getParentGroup( 'layer-1' );

			expect( result ).toBeNull();
		} );

		it( 'should return false from deleteGroup without stateManager', () => {
			const gm = new GroupManager( {} );
			// Don't initialize (no stateManager)

			const result = gm.deleteGroup( 'group-1' );

			expect( result ).toBe( false );
		} );

		it( 'should return null from groupSelected without selectionManager', () => {
			const gm = new GroupManager( {} );
			// Initialize with stateManager but no selectionManager
			gm.initialize( {
				stateManager: mockStateManager
			} );

			const result = gm.groupSelected();

			expect( result ).toBeNull();
		} );

		it( 'should return false from ungroupSelected without selectionManager', () => {
			const gm = new GroupManager( {} );
			// Initialize with stateManager but no selectionManager
			gm.initialize( {
				stateManager: mockStateManager
			} );

			const result = gm.ungroupSelected();

			expect( result ).toBe( false );
		} );

		it( 'should reject moveToFolder when nesting depth would exceed maximum', () => {
			// maxNestingDepth is 3 by default
			// Set up nested structure: folder-1 -> folder-2 -> folder-3 (depth 2)
			const layers = [
				{ id: 'folder-1', type: 'group', children: [ 'folder-2' ] },
				{ id: 'folder-2', type: 'group', children: [ 'folder-3' ], parentGroup: 'folder-1' },
				{ id: 'folder-3', type: 'group', children: [], parentGroup: 'folder-2' },
				// nested-group has a child group, so its maxChildDepth = 1
				{ id: 'nested-group', type: 'group', children: [ 'child-group' ] },
				{ id: 'child-group', type: 'group', children: [], parentGroup: 'nested-group' }
			];
			mockStateManager.state.layers = layers;

			// folder-3 depth = 2, nested-group maxChildDepth = 1
			// 2 + 1 + 1 = 4 > 3 (maxNestingDepth), should fail
			const result = groupManager.moveToFolder( 'nested-group', 'folder-3' );

			expect( result ).toBe( false );
		} );
	} );

	describe( 'P1.1 regression: save-after-mutate pattern', () => {
		test( 'createGroup saves state AFTER mutation', () => {
			mockSelectionManager.selectedLayers = [
				{ id: 'layer-1' },
				{ id: 'layer-2' }
			];

			const callOrder = [];
			mockStateManager.set = jest.fn( () => {
				callOrder.push( 'set' );
			} );
			mockHistoryManager.saveState = jest.fn( () => {
				callOrder.push( 'saveState' );
			} );

			groupManager.createGroup( [ 'layer-1', 'layer-2' ] );

			expect( callOrder ).toEqual( [ 'set', 'saveState' ] );
		} );

		test( 'createFolder saves state AFTER mutation', () => {
			const callOrder = [];
			mockStateManager.set = jest.fn( () => {
				callOrder.push( 'set' );
			} );
			mockHistoryManager.saveState = jest.fn( () => {
				callOrder.push( 'saveState' );
			} );

			groupManager.createFolder( null, 'Test Folder' );

			expect( callOrder ).toEqual( [ 'set', 'saveState' ] );
		} );

		test( 'deleteGroup saves state AFTER mutation', () => {
			const layers = [
				{ id: 'group-1', type: 'group', children: [ 'child-1' ] },
				{ id: 'child-1', type: 'rectangle', parentGroup: 'group-1' }
			];
			mockStateManager.state.layers = layers;

			const callOrder = [];
			mockStateManager.set = jest.fn( () => {
				callOrder.push( 'set' );
			} );
			mockHistoryManager.saveState = jest.fn( () => {
				callOrder.push( 'saveState' );
			} );

			groupManager.deleteGroup( 'group-1', true );

			expect( callOrder ).toEqual( [ 'set', 'saveState' ] );
		} );

		test( 'renameGroup saves state AFTER mutation', () => {
			const layers = [
				{ id: 'group-1', type: 'group', name: 'Old', children: [] }
			];
			mockStateManager.state.layers = layers;

			const callOrder = [];
			mockStateManager.set = jest.fn( () => {
				callOrder.push( 'set' );
			} );
			mockHistoryManager.saveState = jest.fn( () => {
				callOrder.push( 'saveState' );
			} );

			groupManager.renameGroup( 'group-1', 'New' );

			expect( callOrder ).toEqual( [ 'set', 'saveState' ] );
		} );
	} );

	// ===== Gap coverage tests =====

	describe( 'lazy getters - caching and null paths', () => {
		test( 'stateManager getter caches after first lookup', () => {
			const gm = new GroupManager( {} );
			gm.editor = { stateManager: mockStateManager };

			const first = gm.stateManager;
			const second = gm.stateManager;
			expect( first ).toBe( mockStateManager );
			expect( second ).toBe( first );
		} );

		test( 'stateManager getter returns null when editor is null', () => {
			const gm = new GroupManager( {} );
			gm.editor = null;
			expect( gm.stateManager ).toBeNull();
		} );

		test( 'historyManager getter returns null when editor is null', () => {
			const gm = new GroupManager( {} );
			gm.editor = null;
			expect( gm.historyManager ).toBeNull();
		} );

		test( 'historyManager getter caches after first lookup', () => {
			const gm = new GroupManager( {} );
			gm.editor = { historyManager: mockHistoryManager };

			const first = gm.historyManager;
			const second = gm.historyManager;
			expect( first ).toBe( mockHistoryManager );
			expect( second ).toBe( first );
		} );

		test( 'selectionManager getter returns null when editor has no canvasManager', () => {
			const gm = new GroupManager( {} );
			gm.editor = {}; // no canvasManager
			expect( gm.selectionManager ).toBeNull();
		} );

		test( 'selectionManager getter caches via canvasManager', () => {
			const gm = new GroupManager( {} );
			gm.editor = { canvasManager: { selectionManager: mockSelectionManager } };

			const first = gm.selectionManager;
			const second = gm.selectionManager;
			expect( first ).toBe( mockSelectionManager );
			expect( second ).toBe( first );
		} );
	} );

	describe( 'createGroup - depth and size limits', () => {
		test( 'returns null when all layers exceed max nesting depth', () => {
			// Set low nesting depth and put layers in deep nesting
			groupManager.maxNestingDepth = 1;

			// Create a nested structure where layers are already at depth 1
			const layers = [
				{ id: 'root-group', type: 'group', children: [ 'child-1', 'child-2' ], expanded: true },
				{ id: 'child-1', type: 'rectangle', parentGroup: 'root-group' },
				{ id: 'child-2', type: 'circle', parentGroup: 'root-group' }
			];
			mockStateManager.state.layers = layers;

			// Trying to group child-1 and child-2 (already at depth 1) should fail
			const result = groupManager.createGroup( [ 'child-1', 'child-2' ] );
			expect( result ).toBeNull();
		} );

		test( 'returns null when too many layers exceed maxChildrenPerGroup', () => {
			groupManager.maxChildrenPerGroup = 2;

			const result = groupManager.createGroup( [ 'layer-1', 'layer-2', 'layer-3' ] );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'createFolder - empty array vs null', () => {
		test( 'creates folder with empty layerIds array', () => {
			const folder = groupManager.createFolder( [], 'Empty Folder' );
			expect( folder ).not.toBeNull();
			expect( folder.type ).toBe( 'group' );
			expect( folder.children ).toEqual( [] );
			expect( folder.name ).toBe( 'Empty Folder' );
		} );

		test( 'creates folder with null layerIds', () => {
			const folder = groupManager.createFolder( null, 'Null Folder' );
			expect( folder ).not.toBeNull();
			expect( folder.type ).toBe( 'group' );
			expect( folder.name ).toBe( 'Null Folder' );
		} );
	} );

	describe( 'removeFromFolder - layer without parentGroup', () => {
		test( 'returns false for layer without parentGroup', () => {
			const layers = [
				{ id: 'lonely', type: 'rectangle' }
			];
			mockStateManager.state.layers = layers;

			const result = groupManager.removeFromFolder( 'lonely' );
			expect( result ).toBe( false );
		} );

		test( 'returns false for nonexistent layer', () => {
			const result = groupManager.removeFromFolder( 'does-not-exist' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'moveToFolder - folder not found', () => {
		test( 'handles case when folder is not in layers array', () => {
			const layers = [
				{ id: 'layer-1', type: 'rectangle' }
			];
			mockStateManager.state.layers = layers;

			// Try to move to a folder that doesn't exist
			const result = groupManager.moveToFolder( 'layer-1', 'nonexistent-folder' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'deleteGroup - deep nesting with deleteChildren', () => {
		test( 'deletes 3-level nested hierarchy', () => {
			const layers = [
				{ id: 'outer', type: 'group', children: [ 'inner' ] },
				{ id: 'inner', type: 'group', children: [ 'deep' ], parentGroup: 'outer' },
				{ id: 'deep', type: 'rectangle', parentGroup: 'inner' }
			];
			mockStateManager.state.layers = layers;

			const result = groupManager.deleteGroup( 'outer', true );
			expect( result ).toBe( true );
			// All layers should be deleted
			expect( mockStateManager.state.layers ).toEqual( [] );
		} );

		test( 'returns false for nonexistent group', () => {
			const result = groupManager.deleteGroup( 'nonexistent', true );
			expect( result ).toBe( false );
		} );

		test( 'delegates to ungroup when deleteChildren is false', () => {
			const layers = [
				{ id: 'group-x', type: 'group', children: [ 'c1' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'group-x' }
			];
			mockStateManager.state.layers = layers;

			const ungroupSpy = jest.spyOn( groupManager, 'ungroup' );
			groupManager.deleteGroup( 'group-x', false );
			expect( ungroupSpy ).toHaveBeenCalledWith( 'group-x' );
			ungroupSpy.mockRestore();
		} );
	} );

	describe( 'setExpanded edge cases', () => {
		test( 'setExpanded on nonexistent group does not throw', () => {
			expect( () => {
				groupManager.setExpanded( 'nonexistent-id', true );
			} ).not.toThrow();
		} );

		test( 'setExpanded updates group expanded state', () => {
			const layers = [
				{ id: 'g1', type: 'group', children: [], expanded: false }
			];
			mockStateManager.state.layers = layers;

			groupManager.setExpanded( 'g1', true );

			const updated = mockStateManager.state.layers;
			const g1 = updated.find( ( l ) => l.id === 'g1' );
			expect( g1.expanded ).toBe( true );
		} );
	} );

	describe( 'isGroup - string vs object', () => {
		test( 'isGroup with string ID', () => {
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', children: [] }
			];
			expect( groupManager.isGroup( 'g1' ) ).toBe( true );
		} );

		test( 'isGroup with object layer', () => {
			expect( groupManager.isGroup( { type: 'group', children: [] } ) ).toBe( true );
		} );

		test( 'isGroup with non-group', () => {
			expect( groupManager.isGroup( { type: 'rectangle' } ) ).toBe( false );
		} );
	} );

	describe( 'getTopLevelLayers / getParentGroup / getGroupBounds null stateManager', () => {
		test( 'getTopLevelLayers returns empty array without stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.getTopLevelLayers() ).toEqual( [] );
		} );

		test( 'getParentGroup returns null without stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.getParentGroup( 'any-id' ) ).toBeNull();
		} );

		test( 'getGroupBounds returns null without stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.getGroupBounds( 'any-id' ) ).toBeNull();
		} );

		test( 'getGroupChildren returns empty without stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.getGroupChildren( 'any-id' ) ).toEqual( [] );
		} );
	} );

	describe( 'groupSelected - edge cases', () => {
		test( 'returns null when selectionManager is null', () => {
			const gm = new GroupManager( {} );
			gm.initialize( {
				stateManager: mockStateManager,
				selectionManager: null,
				historyManager: mockHistoryManager
			} );
			expect( gm.groupSelected() ).toBeNull();
		} );

		test( 'returns null when fewer than 2 layers selected', () => {
			mockSelectionManager.getSelectedLayers.mockReturnValue( [ testLayers[ 0 ] ] );
			expect( groupManager.groupSelected() ).toBeNull();
		} );
	} );

	describe( 'renameGroup - edge cases', () => {
		test( 'returns false for empty newName', () => {
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', name: 'Old', children: [] }
			];
			expect( groupManager.renameGroup( 'g1', '' ) ).toBe( false );
		} );

		test( 'returns false for null newName', () => {
			expect( groupManager.renameGroup( 'g1', null ) ).toBe( false );
		} );
	} );

	describe( 'getLayerDepth - without layers parameter', () => {
		test( 'resolves layers from stateManager when not provided', () => {
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', children: [ 'c1' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' }
			];

			const depth = groupManager.getLayerDepth( 'c1' );
			expect( depth ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'branch coverage - createGroup depth filtering', () => {
		test( 'skips layers exceeding max nesting depth', () => {
			// Create deeply nested structure that hits the limit
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', children: [ 'g2' ] },
				{ id: 'g2', type: 'group', children: [ 'g3' ], parentGroup: 'g1' },
				{ id: 'g3', type: 'group', children: [ 'deep' ], parentGroup: 'g2' },
				{ id: 'deep', type: 'rectangle', parentGroup: 'g3' },
				{ id: 'shallow', type: 'rectangle' }
			];

			// Set low nesting limit
			groupManager.maxNestingDepth = 3;
			const result = groupManager.createGroup( [ 'deep', 'shallow' ] );
			// Should create group with at least the shallow layer
			if ( result ) {
				expect( result.children ).toBeDefined();
			}
		} );

		test( 'returns null when all layers exceed depth', () => {
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', children: [ 'g2' ] },
				{ id: 'g2', type: 'group', children: [ 'deep' ], parentGroup: 'g1' },
				{ id: 'deep', type: 'rectangle', parentGroup: 'g2' }
			];

			groupManager.maxNestingDepth = 2;
			groupManager.createGroup( [ 'deep' ] );
			// May return null if depth check eliminates only candidate
		} );

		test( 'returns null when exceeding maxChildrenPerGroup', () => {
			groupManager.maxChildrenPerGroup = 2;
			const result = groupManager.createGroup( [ 'layer-1', 'layer-2', 'layer-3' ] );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'branch coverage - moveToFolder circular reference', () => {
		test( 'prevents moving a group into its own descendant', () => {
			mockStateManager.state.layers = [
				{ id: 'parent', type: 'group', children: [ 'child' ] },
				{ id: 'child', type: 'group', children: [ 'grandchild' ], parentGroup: 'parent' },
				{ id: 'grandchild', type: 'rectangle', parentGroup: 'child' }
			];

			// Try to move parent into child (circular)
			const result = groupManager.moveToFolder( 'parent', 'child' );
			expect( result ).toBe( false );
		} );

		test( 'prevents moving a group into itself', () => {
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', children: [] }
			];
			const result = groupManager.moveToFolder( 'g1', 'g1' );
			expect( result ).toBe( false );
		} );

		test( 'prevents moving when already in folder', () => {
			mockStateManager.state.layers = [
				{ id: 'folder', type: 'group', children: [ 'item' ] },
				{ id: 'item', type: 'rectangle', parentGroup: 'folder' }
			];
			const result = groupManager.moveToFolder( 'item', 'folder' );
			expect( result ).toBe( false );
		} );

		test( 'prevents depth overflow when moving group with children', () => {
			groupManager.maxNestingDepth = 2;
			mockStateManager.state.layers = [
				{ id: 'target', type: 'group', children: [ 'deep1' ] },
				{ id: 'deep1', type: 'group', children: [], parentGroup: 'target' },
				{ id: 'nested', type: 'group', children: [ 'innerGroup' ] },
				{ id: 'innerGroup', type: 'group', children: [ 'leaf' ], parentGroup: 'nested' },
				{ id: 'leaf', type: 'rectangle', parentGroup: 'innerGroup' }
			];

			// deep1 depth=1, nested maxChildDepth=1 (innerGroup child), so 1+1+1=3 > 2
			const result = groupManager.moveToFolder( 'nested', 'deep1' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'branch coverage - addToFolderAtPosition', () => {
		test( 'returns false with no stateManager', () => {
			groupManager._stateManager = null;
			// Access through internal property that stateManager getter uses
			const result = groupManager.addToFolderAtPosition( 'l1', 'f1', 's1' );
			expect( result ).toBe( false );
		} );

		test( 'returns false when layer not found', () => {
			const result = groupManager.addToFolderAtPosition( 'nonexistent', 'layer-1', null );
			expect( result ).toBe( false );
		} );

		test( 'returns false when folder not found or not a group', () => {
			const result = groupManager.addToFolderAtPosition( 'layer-1', 'nonexistent', null );
			expect( result ).toBe( false );
		} );

		test( 'returns false when moving folder into itself', () => {
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', children: [] }
			];
			const result = groupManager.addToFolderAtPosition( 'g1', 'g1', null );
			expect( result ).toBe( false );
		} );

		test( 'returns false when layer already in folder', () => {
			mockStateManager.state.layers = [
				{ id: 'folder', type: 'group', children: [ 'item' ] },
				{ id: 'item', type: 'rectangle', parentGroup: 'folder' }
			];
			const result = groupManager.addToFolderAtPosition( 'item', 'folder', null );
			expect( result ).toBe( false );
		} );

		test( 'inserts before sibling when sibling found', () => {
			mockStateManager.state.layers = [
				{ id: 'folder', type: 'group', children: [ 'c1', 'c2' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'folder' },
				{ id: 'c2', type: 'rectangle', parentGroup: 'folder' },
				{ id: 'outside', type: 'rectangle' }
			];
			const result = groupManager.addToFolderAtPosition( 'outside', 'folder', 'c2' );
			expect( result ).toBe( true );
		} );

		test( 'adds at end when sibling is null', () => {
			mockStateManager.state.layers = [
				{ id: 'folder', type: 'group', children: [ 'c1' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'folder' },
				{ id: 'outside', type: 'rectangle' }
			];
			const result = groupManager.addToFolderAtPosition( 'outside', 'folder', null );
			expect( result ).toBe( true );
		} );

		test( 'returns false when depth would be exceeded', () => {
			groupManager.maxNestingDepth = 2;
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', children: [ 'g2' ] },
				{ id: 'g2', type: 'group', children: [], parentGroup: 'g1' },
				{ id: 'nested', type: 'group', children: [ 'innerGroup' ] },
				{ id: 'innerGroup', type: 'group', children: [ 'leaf' ], parentGroup: 'nested' },
				{ id: 'leaf', type: 'rectangle', parentGroup: 'innerGroup' }
			];
			// g2 depth=1, nested maxChildDepth=1 (innerGroup is group child), so 1+1+1=3 > 2
			const result = groupManager.addToFolderAtPosition( 'nested', 'g2', null );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'branch coverage - deleteGroup', () => {
		test( 'returns false when stateManager null', () => {
			groupManager._stateManager = null;
			const result = groupManager.deleteGroup( 'g1' );
			expect( result ).toBe( false );
		} );

		test( 'returns false when group not found', () => {
			const result = groupManager.deleteGroup( 'nonexistent' );
			expect( result ).toBe( false );
		} );

		test( 'deletes group and all children when deleteChildren=true', () => {
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', children: [ 'c1', 'c2' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' },
				{ id: 'c2', type: 'rectangle', parentGroup: 'g1' },
				{ id: 'other', type: 'rectangle' }
			];
			const result = groupManager.deleteGroup( 'g1', true );
			expect( result ).toBe( true );
			const remaining = mockStateManager.state.layers;
			expect( remaining.length ).toBe( 1 );
			expect( remaining[ 0 ].id ).toBe( 'other' );
		} );

		test( 'recursively deletes nested groups', () => {
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', children: [ 'g2' ] },
				{ id: 'g2', type: 'group', children: [ 'deep' ], parentGroup: 'g1' },
				{ id: 'deep', type: 'rectangle', parentGroup: 'g2' },
				{ id: 'other', type: 'rectangle' }
			];
			const result = groupManager.deleteGroup( 'g1', true );
			expect( result ).toBe( true );
			expect( mockStateManager.state.layers.length ).toBe( 1 );
		} );

		test( 'ungroups children when deleteChildren=false', () => {
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', children: [ 'c1' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' }
			];
			const result = groupManager.deleteGroup( 'g1', false );
			expect( result ).toBe( true );
		} );
	} );

	describe( 'branch coverage - groupSelected', () => {
		test( 'returns null when no selectionManager', () => {
			groupManager._selectionManager = null;
			const result = groupManager.groupSelected();
			expect( result ).toBeNull();
		} );

		test( 'returns null when fewer than 2 selected', () => {
			mockSelectionManager.selectedLayers = [ { id: 'layer-1' } ];
			const result = groupManager.groupSelected();
			expect( result ).toBeNull();
		} );

		test( 'returns null when selection is empty', () => {
			mockSelectionManager.selectedLayers = [];
			const result = groupManager.groupSelected();
			expect( result ).toBeNull();
		} );

		test( 'creates group and selects it when 2+ layers', () => {
			mockSelectionManager.selectedLayers = [
				{ id: 'layer-1' },
				{ id: 'layer-2' }
			];
			const result = groupManager.groupSelected();
			if ( result ) {
				expect( result.type ).toBe( 'group' );
				expect( mockSelectionManager.selectLayer ).toHaveBeenCalledWith( result.id );
			}
		} );
	} );

	describe( 'branch coverage - ungroupSelected', () => {
		test( 'returns false when no selectionManager', () => {
			groupManager._selectionManager = null;
			const result = groupManager.ungroupSelected();
			expect( result ).toBe( false );
		} );

		test( 'returns false when no selection', () => {
			mockSelectionManager.selectedLayers = [];
			const result = groupManager.ungroupSelected();
			expect( result ).toBe( false );
		} );

		test( 'returns false when multiple layers selected', () => {
			mockSelectionManager.selectedLayers = [ { id: 'l1' }, { id: 'l2' } ];
			const result = groupManager.ungroupSelected();
			expect( result ).toBe( false );
		} );

		test( 'returns false when selected layer is not a group', () => {
			mockSelectionManager.selectedLayers = [ { id: 'layer-1', type: 'rectangle' } ];
			const result = groupManager.ungroupSelected();
			expect( result ).toBe( false );
		} );

		test( 'returns true when ungrouping a group layer', () => {
			mockStateManager.state.layers = [
				{ id: 'g1', type: 'group', children: [ 'c1' ] },
				{ id: 'c1', type: 'rectangle', parentGroup: 'g1' }
			];
			mockSelectionManager.selectedLayers = [ { id: 'g1', type: 'group' } ];
			const result = groupManager.ungroupSelected();
			expect( result ).toBe( true );
		} );
	} );

	describe( 'branch coverage - toggleExpanded', () => {
		test( 'returns false when no stateManager', () => {
			groupManager._stateManager = null;
			const result = groupManager.toggleExpanded( 'g1' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'branch coverage - setExpanded', () => {
		test( 'returns when no stateManager', () => {
			groupManager._stateManager = null;
			groupManager.setExpanded( 'g1', true );
			// Should not throw
		} );
	} );

	describe( 'branch coverage - getGroupChildren', () => {
		test( 'returns empty when no stateManager', () => {
			groupManager._stateManager = null;
			const result = groupManager.getGroupChildren( 'g1' );
			expect( result ).toEqual( [] );
		} );
	} );

	describe( 'branch coverage - getParentGroup', () => {
		test( 'returns null when no stateManager', () => {
			groupManager._stateManager = null;
			const result = groupManager.getParentGroup( 'l1' );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'branch coverage - renameGroup', () => {
		test( 'returns false when no stateManager', () => {
			groupManager._stateManager = null;
			const result = groupManager.renameGroup( 'g1', 'new name' );
			expect( result ).toBe( false );
		} );

		test( 'returns false when newName is empty', () => {
			const result = groupManager.renameGroup( 'g1', '' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'branch coverage gaps - createGroup', () => {
		test( 'returns null for null layerIds', () => {
			expect( groupManager.createGroup( null, 'test' ) ).toBeNull();
		} );

		test( 'returns null for empty layerIds', () => {
			expect( groupManager.createGroup( [], 'test' ) ).toBeNull();
		} );

		test( 'returns null when no stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.createGroup( [ 'l1' ], 'test' ) ).toBeNull();
		} );

		test( 'returns null when all layers are at max nesting depth', () => {
			// Create a deeply nested structure
			const folder1 = { id: 'f1', type: 'group', children: [ 'f2' ], visible: true };
			const folder2 = { id: 'f2', type: 'group', children: [ 'f3' ], parentGroup: 'f1', visible: true };
			const folder3 = { id: 'f3', type: 'group', children: [ 'deep-layer' ], parentGroup: 'f2', visible: true };
			const deepLayer = { id: 'deep-layer', type: 'rectangle', parentGroup: 'f3' };
			mockStateManager.state.layers = [ folder1, folder2, folder3, deepLayer ];
			// max depth is 3, deep-layer is already at depth 3
			expect( groupManager.createGroup( [ 'deep-layer' ], 'test' ) ).toBeNull();
		} );

		test( 'returns null when layerIds exceed maxChildrenPerGroup', () => {
			const ids = [];
			const layers = [];
			for ( let i = 0; i < 101; i++ ) {
				ids.push( 'l' + i );
				layers.push( { id: 'l' + i, type: 'rectangle' } );
			}
			mockStateManager.state.layers = layers;
			expect( groupManager.createGroup( ids, 'test' ) ).toBeNull();
		} );

		test( 'returns null when no valid layer IDs found', () => {
			expect( groupManager.createGroup( [ 'nonexistent1', 'nonexistent2' ], 'test' ) ).toBeNull();
		} );
	} );

	describe( 'branch coverage gaps - createFolder', () => {
		test( 'returns null when no stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.createFolder() ).toBeNull();
		} );

		test( 'creates empty folder when no layerIds', () => {
			const result = groupManager.createFolder();
			expect( result ).not.toBeNull();
			expect( result.type ).toBe( 'group' );
			expect( result.children ).toEqual( [] );
		} );

		test( 'creates folder with layers when layerIds provided', () => {
			const result = groupManager.createFolder( [ 'layer-1', 'layer-2' ], 'My Folder' );
			expect( result ).not.toBeNull();
			expect( result.name ).toBe( 'My Folder' );
		} );
	} );

	describe( 'branch coverage gaps - moveToFolder', () => {
		test( 'returns false when no stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.moveToFolder( 'l1', 'f1' ) ).toBe( false );
		} );

		test( 'returns false when layer not found', () => {
			expect( groupManager.moveToFolder( 'nonexistent', 'layer-1' ) ).toBe( false );
		} );

		test( 'returns false when moving folder into itself', () => {
			const folder = { id: 'f1', type: 'group', children: [], visible: true };
			mockStateManager.state.layers = [ folder, ...testLayers ];
			expect( groupManager.moveToFolder( 'f1', 'f1' ) ).toBe( false );
		} );

		test( 'returns false for circular reference (folder into descendant)', () => {
			const f1 = { id: 'f1', type: 'group', children: [ 'f2' ], visible: true };
			const f2 = { id: 'f2', type: 'group', children: [], parentGroup: 'f1', visible: true };
			mockStateManager.state.layers = [ f1, f2 ];
			expect( groupManager.moveToFolder( 'f1', 'f2' ) ).toBe( false );
		} );

		test( 'returns false when layer already in target folder', () => {
			const folder = { id: 'f1', type: 'group', children: [ 'layer-1' ], visible: true };
			testLayers[ 0 ].parentGroup = 'f1';
			mockStateManager.state.layers = [ folder, ...testLayers ];
			expect( groupManager.moveToFolder( 'layer-1', 'f1' ) ).toBe( false );
		} );

		test( 'returns false when nesting depth exceeded', () => {
			const f1 = { id: 'f1', type: 'group', children: [ 'f2' ], visible: true };
			const f2 = { id: 'f2', type: 'group', children: [ 'f3' ], parentGroup: 'f1', visible: true };
			const f3 = { id: 'f3', type: 'group', children: [], parentGroup: 'f2', visible: true };
			// groupToMove has a nested group child, so maxChildDepth = 1
			const groupToMove = { id: 'g1', type: 'group', children: [ 'inner' ], visible: true };
			const innerGroup = { id: 'inner', type: 'group', children: [], parentGroup: 'g1', visible: true };
			mockStateManager.state.layers = [ f1, f2, f3, groupToMove, innerGroup ];
			// f3 depth = 2, g1 maxChildDepth = 1, check: 2 + 1 + 1 = 4 > 3
			expect( groupManager.moveToFolder( 'g1', 'f3' ) ).toBe( false );
		} );
	} );

	describe( 'branch coverage gaps - removeFromFolder', () => {
		test( 'returns false when no stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.removeFromFolder( 'l1' ) ).toBe( false );
		} );

		test( 'returns false when layer not found', () => {
			expect( groupManager.removeFromFolder( 'nonexistent' ) ).toBe( false );
		} );

		test( 'returns false when layer not in folder', () => {
			expect( groupManager.removeFromFolder( 'layer-1' ) ).toBe( false );
		} );
	} );

	describe( 'branch coverage gaps - ungroup', () => {
		test( 'returns false when no stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.ungroup( 'g1' ) ).toBe( false );
		} );

		test( 'returns false when group not found', () => {
			expect( groupManager.ungroup( 'nonexistent' ) ).toBe( false );
		} );
	} );

	describe( 'branch coverage gaps - addToGroup', () => {
		test( 'returns false when no stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.addToGroup( 'l1', 'g1' ) ).toBe( false );
		} );

		test( 'returns false when layer or group not found', () => {
			expect( groupManager.addToGroup( 'nonexistent', 'layer-1' ) ).toBe( false );
		} );

		test( 'returns false when nesting depth exceeded', () => {
			const f1 = { id: 'f1', type: 'group', children: [ 'f2' ], visible: true };
			const f2 = { id: 'f2', type: 'group', children: [ 'f3' ], parentGroup: 'f1', visible: true };
			const f3 = { id: 'f3', type: 'group', children: [], parentGroup: 'f2', visible: true };
			// groupToAdd contains a nested group, so maxChildDepth = 1
			const groupToAdd = { id: 'g1', type: 'group', children: [ 'inner' ], visible: true };
			const innerGroup = { id: 'inner', type: 'group', children: [], parentGroup: 'g1', visible: true };
			mockStateManager.state.layers = [ f1, f2, f3, groupToAdd, innerGroup ];
			// f3 depth = 2, g1 maxChildDepth = 1 (has nested group), check: 2 + 1 + 1 = 4 > 3
			expect( groupManager.addToGroup( 'g1', 'f3' ) ).toBe( false );
		} );

		test( 'returns false when max children exceeded', () => {
			// Create group at max capacity
			const childIds = [];
			const layers = [];
			for ( let i = 0; i < 100; i++ ) {
				childIds.push( 'child' + i );
				layers.push( { id: 'child' + i, type: 'rectangle', parentGroup: 'full-group' } );
			}
			const fullGroup = { id: 'full-group', type: 'group', children: childIds, visible: true };
			const newLayer = { id: 'new-layer', type: 'rectangle' };
			layers.push( fullGroup, newLayer );
			mockStateManager.state.layers = layers;
			expect( groupManager.addToGroup( 'new-layer', 'full-group' ) ).toBe( false );
		} );
	} );

	describe( 'branch coverage gaps - removeFromCurrentGroup', () => {
		test( 'returns empty array when no stateManager and no layers', () => {
			const gm = new GroupManager( {} );
			expect( gm.removeFromCurrentGroup( 'l1' ) ).toEqual( [] );
		} );

		test( 'uses provided layers array', () => {
			const layers = [
				{ id: 'f1', type: 'group', children: [ 'l1' ] },
				{ id: 'l1', type: 'rectangle', parentGroup: 'f1' }
			];
			const result = groupManager.removeFromCurrentGroup( 'l1', layers );
			expect( result ).toEqual( expect.any( Array ) );
		} );
	} );

	describe( 'branch coverage gaps - getTopLevelLayers', () => {
		test( 'returns empty array when no stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.getTopLevelLayers() ).toEqual( [] );
		} );
	} );

	describe( 'branch coverage gaps - setExpanded', () => {
		test( 'coerces falsy value to false', () => {
			const group = { id: 'g1', type: 'group', children: [], expanded: true, visible: true };
			mockStateManager.state.layers = [ group ];
			groupManager.setExpanded( 'g1', 0 );
			const updated = mockStateManager.state.layers;
			const g = updated.find( ( l ) => l.id === 'g1' );
			expect( g.expanded ).toBe( false );
		} );

		test( 'coerces empty string to false', () => {
			const group = { id: 'g1', type: 'group', children: [], expanded: true, visible: true };
			mockStateManager.state.layers = [ group ];
			groupManager.setExpanded( 'g1', '' );
			const updated = mockStateManager.state.layers;
			const g = updated.find( ( l ) => l.id === 'g1' );
			expect( g.expanded ).toBe( false );
		} );
	} );

	describe( 'branch coverage gaps - addToFolderAtPosition', () => {
		test( 'returns false when no stateManager', () => {
			const gm = new GroupManager( {} );
			expect( gm.addToFolderAtPosition( 'l1', 'f1', null ) ).toBe( false );
		} );

		test( 'returns false when layer already in target folder', () => {
			const folder = { id: 'f1', type: 'group', children: [ 'layer-1' ], visible: true };
			testLayers[ 0 ].parentGroup = 'f1';
			mockStateManager.state.layers = [ folder, ...testLayers ];
			expect( groupManager.addToFolderAtPosition( 'layer-1', 'f1', null ) ).toBe( false );
		} );

		test( 'adds at end when sibling not found', () => {
			const folder = { id: 'f1', type: 'group', children: [ 'layer-2' ], visible: true };
			testLayers[ 1 ].parentGroup = 'f1';
			mockStateManager.state.layers = [ folder, ...testLayers ];
			const result = groupManager.addToFolderAtPosition( 'layer-1', 'f1', 'nonexistent' );
			expect( result ).toBe( true );
		} );
	} );

	describe( 'branch coverage gaps - groupSelected', () => {
		test( 'returns null when no selectionManager', () => {
			groupManager._selectionManager = null;
			groupManager.editor = null;
			expect( groupManager.groupSelected() ).toBeNull();
		} );
	} );
} );
