/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests for FolderOperationsController
 *
 * Tests folder operations: create, delete, toggle visibility, ungroup
 */

'use strict';

describe( 'FolderOperationsController', () => {
	let FolderOperationsController;
	let controller;
	let mockEditor;
	let mockCallbacks;
	let mockLayers;

	beforeEach( () => {
		// Set up mock layers
		mockLayers = [
			{ id: 'layer1', type: 'rectangle', name: 'Layer 1', visible: true },
			{ id: 'layer2', type: 'circle', name: 'Layer 2', visible: true },
			{ id: 'folder1', type: 'group', name: 'Folder 1', visible: true, children: [ 'layer3', 'layer4' ] },
			{ id: 'layer3', type: 'text', name: 'Layer 3', visible: true, parentGroup: 'folder1' },
			{ id: 'layer4', type: 'arrow', name: 'Layer 4', visible: false, parentGroup: 'folder1' }
		];

		// Setup window globals
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};

		// Mock mw object
		global.mw = {
			log: Object.assign( jest.fn(), {
				error: jest.fn(),
				warn: jest.fn()
			} ),
			config: {
				get: jest.fn( () => false )
			},
			notify: jest.fn()
		};

		// Create mock editor
		mockEditor = {
			stateManager: {
				get: jest.fn( ( key ) => {
					if ( key === 'layers' ) {
						return mockLayers;
					}
					if ( key === 'selectedLayerIds' ) {
						return [];
					}
					return null;
				} ),
				set: jest.fn()
			},
			historyManager: {
				startBatch: jest.fn(),
				endBatch: jest.fn()
			},
			canvasManager: {
				renderLayers: jest.fn(),
				setSelectedLayerIds: jest.fn()
			},
			groupManager: {
				createFolder: jest.fn( () => ( { id: 'new-folder', type: 'group', children: [] } ) ),
				ungroup: jest.fn( () => true ),
				getLayerDepth: jest.fn( () => 0 )
			},
			getLayerById: jest.fn( ( id ) => mockLayers.find( ( l ) => l.id === id ) ),
			removeLayer: jest.fn(),
			saveState: jest.fn(),
			layers: mockLayers
		};

		// Create mock callbacks
		mockCallbacks = {
			msg: jest.fn( ( key, fallback ) => fallback ),
			getSelectedLayerIds: jest.fn( () => [] ),
			renderLayerList: jest.fn(),
			updateCodePanel: jest.fn(),
			updatePropertiesPanel: jest.fn(),
			registerDialogCleanup: jest.fn()
		};

		// Reset module cache and load
		jest.resetModules();

		FolderOperationsController = require( '../../resources/ext.layers.editor/ui/FolderOperationsController.js' );

		controller = new FolderOperationsController( {
			editor: mockEditor,
			msg: mockCallbacks.msg,
			getSelectedLayerIds: mockCallbacks.getSelectedLayerIds,
			renderLayerList: mockCallbacks.renderLayerList,
			updateCodePanel: mockCallbacks.updateCodePanel,
			updatePropertiesPanel: mockCallbacks.updatePropertiesPanel,
			registerDialogCleanup: mockCallbacks.registerDialogCleanup
		} );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete global.mw;
	} );

	describe( 'constructor', () => {
		it( 'should store editor reference', () => {
			expect( controller.editor ).toBe( mockEditor );
		} );

		it( 'should store callback functions', () => {
			expect( typeof controller.msg ).toBe( 'function' );
			expect( typeof controller.getSelectedLayerIds ).toBe( 'function' );
			expect( typeof controller.renderLayerList ).toBe( 'function' );
		} );

		it( 'should use default fallbacks when config callbacks are missing', () => {
			const minimalController = new FolderOperationsController( {
				editor: mockEditor
			} );

			// Default msg should return key or fallback
			expect( minimalController.msg( 'test-key', 'fallback' ) ).toBe( 'fallback' );
			expect( minimalController.msg( 'test-key' ) ).toBe( 'test-key' );

			// Default getSelectedLayerIds returns empty array
			expect( minimalController.getSelectedLayerIds() ).toEqual( [] );

			// Default callbacks should not throw
			expect( () => minimalController.renderLayerList() ).not.toThrow();
			expect( () => minimalController.updateCodePanel() ).not.toThrow();
			expect( () => minimalController.updatePropertiesPanel() ).not.toThrow();
			expect( () => minimalController.registerDialogCleanup() ).not.toThrow();
		} );
	} );

	describe( 'createFolder', () => {
		it( 'should call groupManager.createFolder with selected layers', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );

			controller.createFolder();

			expect( mockEditor.groupManager.createFolder ).toHaveBeenCalledWith( [ 'layer1', 'layer2' ] );
		} );

		it( 'should call createFolder with empty array when no layers selected', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [] );

			controller.createFolder();

			expect( mockEditor.groupManager.createFolder ).toHaveBeenCalledWith( [] );
		} );

		it( 'should show success notification after creating folder', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [ 'layer1' ] );

			controller.createFolder();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'success' } )
			);
		} );

		it( 'should call renderLayerList after creating folder', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [] );

			controller.createFolder();

			expect( mockCallbacks.renderLayerList ).toHaveBeenCalled();
		} );

		it( 'should not throw when groupManager is not available', () => {
			mockEditor.groupManager = null;

			expect( () => controller.createFolder() ).not.toThrow();
		} );

		it( 'should show error notification when folder creation fails', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [] );
			// Mock createFolder returning null/undefined to simulate failure
			mockEditor.groupManager.createFolder.mockReturnValue( null );

			controller.createFolder();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'error' } )
			);
		} );

		it( 'should return null when folder creation fails', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [] );
			mockEditor.groupManager.createFolder.mockReturnValue( null );

			const result = controller.createFolder();

			expect( result ).toBeNull();
		} );

		it( 'should work when mw.notify is not available', () => {
			delete global.mw.notify;
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [] );

			// Should not throw when mw.notify is undefined
			expect( () => controller.createFolder() ).not.toThrow();
		} );

		it( 'should select the new folder after creation', () => {
			mockCallbacks.getSelectedLayerIds.mockReturnValue( [] );
			mockEditor.groupManager.createFolder.mockReturnValue( { id: 'new-folder', type: 'group', children: [] } );

			controller.createFolder();

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'selectedLayerIds', [ 'new-folder' ] );
		} );
	} );

	describe( 'toggleLayerVisibility', () => {
		it( 'should toggle layer visibility from true to false', () => {
			const layer = mockLayers[ 0 ]; // visible: true
			mockEditor.getLayerById.mockReturnValue( layer );

			controller.toggleLayerVisibility( 'layer1' );

			expect( layer.visible ).toBe( false );
		} );

		it( 'should toggle layer visibility from false to true', () => {
			const layer = { ...mockLayers[ 4 ], visible: false }; // layer4
			mockEditor.getLayerById.mockReturnValue( layer );

			controller.toggleLayerVisibility( 'layer4' );

			expect( layer.visible ).toBe( true );
		} );

		it( 'should cascade visibility to children when toggling a group', () => {
			const folder = mockLayers[ 2 ]; // folder1 with children
			const child1 = mockLayers[ 3 ];
			const child2 = mockLayers[ 4 ];

			mockEditor.getLayerById
				.mockReturnValueOnce( folder )
				.mockReturnValueOnce( child1 )
				.mockReturnValueOnce( child2 );

			controller.toggleLayerVisibility( 'folder1' );

			expect( folder.visible ).toBe( false );
			expect( child1.visible ).toBe( false );
			expect( child2.visible ).toBe( false );
		} );

		it( 'should call renderLayerList after toggling', () => {
			mockEditor.getLayerById.mockReturnValue( mockLayers[ 0 ] );

			controller.toggleLayerVisibility( 'layer1' );

			expect( mockCallbacks.renderLayerList ).toHaveBeenCalled();
		} );

		it( 'should call updateCodePanel after toggling', () => {
			mockEditor.getLayerById.mockReturnValue( mockLayers[ 0 ] );

			controller.toggleLayerVisibility( 'layer1' );

			expect( mockCallbacks.updateCodePanel ).toHaveBeenCalled();
		} );

		it( 'should call editor.saveState with correct message', () => {
			const layer = { ...mockLayers[ 0 ], visible: true };
			mockEditor.getLayerById.mockReturnValue( layer );

			controller.toggleLayerVisibility( 'layer1' );

			expect( mockEditor.saveState ).toHaveBeenCalledWith( 'Hide Layer' );
		} );

		it( 'should do nothing when layer not found', () => {
			mockEditor.getLayerById.mockReturnValue( null );

			controller.toggleLayerVisibility( 'nonexistent' );

			expect( mockCallbacks.renderLayerList ).not.toHaveBeenCalled();
		} );

		it( 'should work when canvasManager is not available', () => {
			mockEditor.canvasManager = null;
			const layer = { ...mockLayers[ 0 ], visible: true };
			mockEditor.getLayerById.mockReturnValue( layer );

			expect( () => controller.toggleLayerVisibility( 'layer1' ) ).not.toThrow();
			expect( layer.visible ).toBe( false );
		} );

		it( 'should work when stateManager is not available for layer retrieval', () => {
			mockEditor.stateManager = null;
			const layer = { ...mockLayers[ 0 ], visible: true };
			mockEditor.getLayerById.mockReturnValue( layer );

			expect( () => controller.toggleLayerVisibility( 'layer1' ) ).not.toThrow();
		} );
	} );

	describe( 'deleteLayer', () => {
		it( 'should call createConfirmDialog for non-group layers', () => {
			const layer = mockLayers[ 0 ];
			mockEditor.getLayerById.mockReturnValue( layer );
			const mockConfirmDialog = jest.fn();

			controller.deleteLayer( 'layer1', mockConfirmDialog );

			expect( mockConfirmDialog ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.any( Function )
			);
		} );

		it( 'should execute callback and saveState when confirmation is accepted', () => {
			const layer = mockLayers[ 0 ];
			mockEditor.getLayerById.mockReturnValue( layer );
			// Create a mock that executes the callback immediately
			const mockConfirmDialog = jest.fn( ( _message, callback ) => {
				callback();
			} );

			controller.deleteLayer( 'layer1', mockConfirmDialog );

			// Callback should have been executed
			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'layer1' );
			expect( mockEditor.saveState ).toHaveBeenCalledWith( 'Delete Layer' );
		} );

		it( 'should saveState with "Delete Folder" message for empty group deletion', () => {
			const emptyFolder = { id: 'empty', type: 'group', children: [] };
			mockEditor.getLayerById.mockReturnValue( emptyFolder );
			const mockConfirmDialog = jest.fn( ( _message, callback ) => {
				callback();
			} );

			controller.deleteLayer( 'empty', mockConfirmDialog );

			expect( mockEditor.saveState ).toHaveBeenCalledWith( 'Delete Folder' );
		} );

		it( 'should show folder delete dialog for groups with children', () => {
			const folder = mockLayers[ 2 ]; // folder1 with children
			mockEditor.getLayerById.mockReturnValue( folder );
			const mockConfirmDialog = jest.fn();

			controller.deleteLayer( 'folder1', mockConfirmDialog );

			// Should create a special folder delete dialog (added to body)
			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeTruthy();
		} );

		it( 'should not call confirm dialog for empty groups', () => {
			const emptyFolder = { id: 'empty', type: 'group', children: [] };
			mockEditor.getLayerById.mockReturnValue( emptyFolder );
			const mockConfirmDialog = jest.fn();

			controller.deleteLayer( 'empty', mockConfirmDialog );

			// Should use standard confirm dialog for empty groups
			expect( mockConfirmDialog ).toHaveBeenCalled();
		} );

		it( 'should do nothing when layer not found', () => {
			mockEditor.getLayerById.mockReturnValue( null );
			const mockConfirmDialog = jest.fn();

			controller.deleteLayer( 'nonexistent', mockConfirmDialog );

			expect( mockConfirmDialog ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'performLayerDelete', () => {
		it( 'should call editor.removeLayer', () => {
			controller.performLayerDelete( 'layer1' );

			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should call renderLayerList', () => {
			controller.performLayerDelete( 'layer1' );

			expect( mockCallbacks.renderLayerList ).toHaveBeenCalled();
		} );

		it( 'should call updateCodePanel', () => {
			controller.performLayerDelete( 'layer1' );

			expect( mockCallbacks.updateCodePanel ).toHaveBeenCalled();
		} );

		it( 'should clear selection when deleting selected layer', () => {
			// Set up stateManager to return the layer being deleted as selected
			mockEditor.stateManager.get.mockReturnValue( [ 'layer1' ] );

			controller.performLayerDelete( 'layer1' );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'selectedLayerIds', [] );
		} );

		it( 'should not clear selection when deleting non-selected layer', () => {
			// Set up stateManager to return a different layer as selected
			mockEditor.stateManager.get.mockReturnValue( [ 'layer2' ] );

			controller.performLayerDelete( 'layer1' );

			// set should not be called to clear selection
			expect( mockEditor.stateManager.set ).not.toHaveBeenCalledWith( 'selectedLayerIds', [] );
		} );
	} );

	describe( 'ungroupLayer', () => {
		it( 'should call groupManager.ungroup', () => {
			controller.ungroupLayer( 'folder1' );

			expect( mockEditor.groupManager.ungroup ).toHaveBeenCalledWith( 'folder1' );
		} );

		it( 'should show success notification after ungrouping', () => {
			controller.ungroupLayer( 'folder1' );

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'success' } )
			);
		} );

		it( 'should call renderLayerList after ungrouping', () => {
			controller.ungroupLayer( 'folder1' );

			expect( mockCallbacks.renderLayerList ).toHaveBeenCalled();
		} );

		it( 'should call saveState after ungrouping', () => {
			controller.ungroupLayer( 'folder1' );

			expect( mockEditor.saveState ).toHaveBeenCalledWith( 'Ungroup' );
		} );

		it( 'should do nothing when groupId is null', () => {
			controller.ungroupLayer( null );

			expect( mockEditor.groupManager.ungroup ).not.toHaveBeenCalled();
		} );

		it( 'should do nothing when groupId is undefined', () => {
			controller.ungroupLayer( undefined );

			expect( mockEditor.groupManager.ungroup ).not.toHaveBeenCalled();
		} );

		it( 'should do nothing when groupManager is not available', () => {
			mockEditor.groupManager = null;

			expect( () => controller.ungroupLayer( 'folder1' ) ).not.toThrow();
		} );

		it( 'should not show notification or call callbacks when ungroup returns false', () => {
			mockEditor.groupManager.ungroup.mockReturnValue( false );

			controller.ungroupLayer( 'folder1' );

			expect( mw.notify ).not.toHaveBeenCalled();
			expect( mockCallbacks.renderLayerList ).not.toHaveBeenCalled();
			expect( mockEditor.saveState ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'setChildrenVisibility', () => {
		it( 'should set visibility on all child layers', () => {
			const child1 = mockLayers[ 3 ];
			const child2 = mockLayers[ 4 ];
			mockEditor.getLayerById
				.mockReturnValueOnce( child1 )
				.mockReturnValueOnce( child2 );

			controller.setChildrenVisibility( [ 'layer3', 'layer4' ], false );

			expect( child1.visible ).toBe( false );
			expect( child2.visible ).toBe( false );
		} );

		it( 'should recursively set visibility for nested groups', () => {
			const nestedFolder = {
				id: 'nested',
				type: 'group',
				children: [ 'deep-layer' ],
				visible: true
			};
			const deepLayer = { id: 'deep-layer', type: 'text', visible: true };

			mockEditor.getLayerById
				.mockReturnValueOnce( nestedFolder )
				.mockReturnValueOnce( deepLayer );

			controller.setChildrenVisibility( [ 'nested' ], false );

			expect( nestedFolder.visible ).toBe( false );
			expect( deepLayer.visible ).toBe( false );
		} );

		it( 'should skip non-existent children', () => {
			mockEditor.getLayerById.mockReturnValue( null );

			expect( () => controller.setChildrenVisibility( [ 'nonexistent' ], false ) ).not.toThrow();
		} );
	} );

	describe( 'deleteFolderKeepChildren', () => {
		it( 'should unparent all children and delete folder', () => {
			const folder = { id: 'folder1', type: 'group', children: [ 'layer3', 'layer4' ] };
			const child1 = { id: 'layer3', parentGroup: 'folder1' };
			const child2 = { id: 'layer4', parentGroup: 'folder1' };

			mockEditor.getLayerById
				.mockReturnValueOnce( child1 )
				.mockReturnValueOnce( child2 );

			controller.deleteFolderKeepChildren( 'folder1', folder );

			expect( child1.parentGroup ).toBeUndefined();
			expect( child2.parentGroup ).toBeUndefined();
			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'folder1' );
		} );

		it( 'should use batch mode for history', () => {
			const folder = { id: 'folder1', type: 'group', children: [] };

			controller.deleteFolderKeepChildren( 'folder1', folder );

			expect( mockEditor.historyManager.startBatch ).toHaveBeenCalledWith( 'Delete Folder (Keep Layers)' );
			expect( mockEditor.historyManager.endBatch ).toHaveBeenCalled();
		} );

		it( 'should handle folder with no children', () => {
			const folder = { id: 'folder1', type: 'group', children: [] };

			controller.deleteFolderKeepChildren( 'folder1', folder );

			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'folder1' );
		} );

		it( 'should work when historyManager is not available', () => {
			mockEditor.historyManager = null;
			const folder = { id: 'folder1', type: 'group', children: [] };

			expect( () => controller.deleteFolderKeepChildren( 'folder1', folder ) ).not.toThrow();
			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'folder1' );
		} );
	} );

	describe( 'deleteFolderAndContents', () => {
		it( 'should delete children and folder', () => {
			const folder = { id: 'folder1', type: 'group', children: [ 'layer3' ] };
			const child = { id: 'layer3', type: 'text' };

			mockEditor.getLayerById.mockReturnValue( child );

			controller.deleteFolderAndContents( 'folder1', folder );

			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'layer3' );
			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'folder1' );
		} );

		it( 'should use batch mode for history', () => {
			const folder = { id: 'folder1', type: 'group', children: [] };

			controller.deleteFolderAndContents( 'folder1', folder );

			expect( mockEditor.historyManager.startBatch ).toHaveBeenCalledWith( 'Delete Folder and Contents' );
			expect( mockEditor.historyManager.endBatch ).toHaveBeenCalled();
		} );

		it( 'should work when historyManager is not available', () => {
			mockEditor.historyManager = null;
			const folder = { id: 'folder1', type: 'group', children: [] };

			expect( () => controller.deleteFolderAndContents( 'folder1', folder ) ).not.toThrow();
			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'folder1' );
		} );
	} );

	describe( 'deleteChildrenRecursively', () => {
		it( 'should delete children', () => {
			const child = { id: 'layer3', type: 'text' };
			mockEditor.getLayerById.mockReturnValue( child );

			controller.deleteChildrenRecursively( [ 'layer3' ] );

			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'layer3' );
		} );

		it( 'should recursively delete nested groups', () => {
			const nestedFolder = { id: 'nested', type: 'group', children: [ 'deep' ] };
			const deepLayer = { id: 'deep', type: 'text' };

			mockEditor.getLayerById
				.mockReturnValueOnce( nestedFolder )
				.mockReturnValueOnce( deepLayer );

			controller.deleteChildrenRecursively( [ 'nested' ] );

			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'deep' );
			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'nested' );
		} );

		it( 'should skip non-existent children', () => {
			mockEditor.getLayerById.mockReturnValue( null );

			expect( () => controller.deleteChildrenRecursively( [ 'nonexistent' ] ) ).not.toThrow();
		} );
	} );

	describe( 'folder delete dialog', () => {
		beforeEach( () => {
			document.body.innerHTML = '';
		} );

		it( 'should create dialog with three buttons', () => {
			const folder = mockLayers[ 2 ];
			mockEditor.getLayerById.mockReturnValue( folder );

			controller.deleteLayer( 'folder1', jest.fn() );

			const buttons = document.querySelectorAll( '.layers-modal-dialog button' );
			expect( buttons.length ).toBe( 3 );
		} );

		it( 'should close dialog when cancel button clicked', () => {
			const folder = mockLayers[ 2 ];
			mockEditor.getLayerById.mockReturnValue( folder );

			controller.deleteLayer( 'folder1', jest.fn() );

			const cancelBtn = document.querySelector( '.layers-btn:not(.layers-btn-secondary):not(.layers-btn-danger)' );
			cancelBtn.click();

			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeFalsy();
		} );

		it( 'should have accessible attributes', () => {
			const folder = mockLayers[ 2 ];
			mockEditor.getLayerById.mockReturnValue( folder );

			controller.deleteLayer( 'folder1', jest.fn() );

			const dialog = document.querySelector( '.layers-modal-dialog' );
			expect( dialog.getAttribute( 'role' ) ).toBe( 'alertdialog' );
			expect( dialog.getAttribute( 'aria-modal' ) ).toBe( 'true' );
		} );

		it( 'should call deleteFolderKeepChildren when "Keep Layers" button clicked', () => {
			const folder = { id: 'folder1', type: 'group', children: [ 'layer3' ] };
			mockEditor.getLayerById.mockReturnValue( folder );

			controller.deleteLayer( 'folder1', jest.fn() );

			// Find "Keep Layers" button (secondary style)
			const keepBtn = document.querySelector( '.layers-btn-secondary' );
			keepBtn.click();

			// Verify folder was processed (via performLayerDelete call)
			expect( mockEditor.removeLayer ).toHaveBeenCalled();
		} );

		it( 'should call deleteFolderAndContents when "Delete All" button clicked', () => {
			const folder = { id: 'folder1', type: 'group', children: [ 'layer3' ] };
			const child = { id: 'layer3', type: 'text' };
			mockEditor.getLayerById
				.mockReturnValueOnce( folder )
				.mockReturnValueOnce( child );

			controller.deleteLayer( 'folder1', jest.fn() );

			// Find "Delete All" button (danger style)
			const deleteBtn = document.querySelector( '.layers-btn-danger' );
			deleteBtn.click();

			// Verify child and folder were deleted
			expect( mockEditor.removeLayer ).toHaveBeenCalled();
		} );

		it( 'should close dialog when clicking overlay', () => {
			const folder = mockLayers[ 2 ];
			mockEditor.getLayerById.mockReturnValue( folder );

			controller.deleteLayer( 'folder1', jest.fn() );

			const overlay = document.querySelector( '.layers-modal-overlay' );
			overlay.click();

			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeFalsy();
		} );
	} );
} );
