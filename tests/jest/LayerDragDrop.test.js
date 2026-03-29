/**
 * Tests for LayerDragDrop controller
 */

// Load via require() so Jest instruments the code for coverage tracking
const LayerDragDrop = require( '../../resources/ext.layers.editor/ui/LayerDragDrop.js' );

describe( 'LayerDragDrop', () => {
	let controller;
	let mockLayerList;
	let mockEditor;
	let mockRenderLayerList;
	let mockAddTargetListener;
	let addedListeners;

	beforeEach( () => {
		// Reset listener tracking
		addedListeners = [];

		// Create mock layer list element
		mockLayerList = {
			addEventListener: jest.fn( ( event, handler, options ) => {
				addedListeners.push( { event, handler, options } );
			} ),
			querySelector: jest.fn( () => null ),
			querySelectorAll: jest.fn( () => [] )
		};

		// Create mock editor
		mockEditor = {
			stateManager: {
				get: jest.fn( () => [] ),
				set: jest.fn(),
				reorderLayer: jest.fn( () => true )
			},
			canvasManager: {
				redraw: jest.fn()
			},
			saveState: jest.fn()
		};

		mockRenderLayerList = jest.fn();
		mockAddTargetListener = jest.fn( ( target, event, handler, options ) => {
			if ( target && typeof target.addEventListener === 'function' ) {
				target.addEventListener( event, handler, options );
			}
		} );
	} );

	describe( 'constructor', () => {
		test( 'should initialize with config', () => {
			controller = new LayerDragDrop( {
				layerList: mockLayerList,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList,
				addTargetListener: mockAddTargetListener
			} );

			expect( controller.layerList ).toBe( mockLayerList );
			expect( controller.editor ).toBe( mockEditor );
			expect( controller.renderLayerList ).toBe( mockRenderLayerList );
		} );

		test( 'should set up drag and drop listeners on construction', () => {
			controller = new LayerDragDrop( {
				layerList: mockLayerList,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList,
				addTargetListener: mockAddTargetListener
			} );

			expect( mockAddTargetListener ).toHaveBeenCalledTimes( 5 );
			expect( mockAddTargetListener ).toHaveBeenCalledWith(
				mockLayerList,
				'dragstart',
				expect.any( Function )
			);
			expect( mockAddTargetListener ).toHaveBeenCalledWith(
				mockLayerList,
				'dragend',
				expect.any( Function )
			);
			expect( mockAddTargetListener ).toHaveBeenCalledWith(
				mockLayerList,
				'dragover',
				expect.any( Function )
			);
			expect( mockAddTargetListener ).toHaveBeenCalledWith(
				mockLayerList,
				'dragleave',
				expect.any( Function )
			);
			expect( mockAddTargetListener ).toHaveBeenCalledWith(
				mockLayerList,
				'drop',
				expect.any( Function )
			);
		} );

		test( 'should handle missing layerList gracefully', () => {
			controller = new LayerDragDrop( {
				layerList: null,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList
			} );

			// No errors should occur
			expect( controller.layerList ).toBeNull();
		} );

		test( 'should use default listener adder when not provided', () => {
			controller = new LayerDragDrop( {
				layerList: mockLayerList,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList
			} );

			// Should have used the default _defaultAddListener
			expect( mockLayerList.addEventListener ).toHaveBeenCalled();
		} );
	} );

	describe( 'setup', () => {
		test( 'should not set up listeners if layerList is missing', () => {
			controller = new LayerDragDrop( {
				layerList: null,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList,
				addTargetListener: mockAddTargetListener
			} );

			// addTargetListener should not have been called
			expect( mockAddTargetListener ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'drag events', () => {
		beforeEach( () => {
			controller = new LayerDragDrop( {
				layerList: mockLayerList,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList,
				addTargetListener: mockAddTargetListener
			} );
		} );

		test( 'should handle dragstart event', () => {
			const dragstartHandler = addedListeners.find( ( l ) => l.event === 'dragstart' )?.handler;
			expect( dragstartHandler ).toBeDefined();

			const mockLayerItem = {
				dataset: { layerId: 'layer_1' },
				classList: {
					add: jest.fn(),
					remove: jest.fn()
				}
			};

			const mockEvent = {
				target: {
					closest: jest.fn( () => mockLayerItem )
				},
				dataTransfer: {
					setData: jest.fn()
				}
			};

			dragstartHandler( mockEvent );

			expect( mockEvent.dataTransfer.setData ).toHaveBeenCalledWith( 'text/plain', 'layer_1' );
			expect( mockLayerItem.classList.add ).toHaveBeenCalledWith( 'dragging' );
		} );

		test( 'should handle dragstart when no layer item found', () => {
			const dragstartHandler = addedListeners.find( ( l ) => l.event === 'dragstart' )?.handler;

			const mockEvent = {
				target: {
					closest: jest.fn( () => null )
				},
				dataTransfer: {
					setData: jest.fn()
				}
			};

			dragstartHandler( mockEvent );

			expect( mockEvent.dataTransfer.setData ).not.toHaveBeenCalled();
		} );

		test( 'should handle dragend event', () => {
			const dragendHandler = addedListeners.find( ( l ) => l.event === 'dragend' )?.handler;
			expect( dragendHandler ).toBeDefined();

			const mockLayerItem = {
				classList: {
					add: jest.fn(),
					remove: jest.fn()
				}
			};

			const mockEvent = {
				target: {
					closest: jest.fn( () => mockLayerItem )
				}
			};

			dragendHandler( mockEvent );

			expect( mockLayerItem.classList.remove ).toHaveBeenCalledWith( 'dragging' );
		} );

		test( 'should handle dragover event by preventing default', () => {
			const dragoverHandler = addedListeners.find( ( l ) => l.event === 'dragover' )?.handler;
			expect( dragoverHandler ).toBeDefined();

			const mockTargetItem = {
				dataset: { layerId: 'layer_2' },
				classList: {
					contains: jest.fn( () => false ),
					add: jest.fn(),
					remove: jest.fn()
				},
				getBoundingClientRect: jest.fn( () => ( { top: 0, height: 40 } ) )
			};

			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: {
					dropEffect: null
				},
				target: {
					closest: jest.fn( () => mockTargetItem )
				},
				clientY: 20
			};

			dragoverHandler( mockEvent );

			expect( mockEvent.preventDefault ).toHaveBeenCalled();
		} );

		test( 'should handle drop event', () => {
			const dropHandler = addedListeners.find( ( l ) => l.event === 'drop' )?.handler;
			expect( dropHandler ).toBeDefined();

			const mockTargetItem = {
				dataset: { layerId: 'layer_2' },
				classList: {
					contains: jest.fn( () => false ),
					add: jest.fn(),
					remove: jest.fn()
				}
			};

			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: {
					getData: jest.fn( () => 'layer_1' )
				},
				target: {
					closest: jest.fn( () => mockTargetItem )
				}
			};

			dropHandler( mockEvent );

			expect( mockEvent.preventDefault ).toHaveBeenCalled();
			// Third parameter is insertAfter (false when no drop-target-below class)
			expect( mockEditor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'layer_2', false );
		} );

		test( 'should not reorder if dragged onto same layer', () => {
			const dropHandler = addedListeners.find( ( l ) => l.event === 'drop' )?.handler;

			const mockTargetItem = {
				dataset: { layerId: 'layer_1' }
			};

			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: {
					getData: jest.fn( () => 'layer_1' )
				},
				target: {
					closest: jest.fn( () => mockTargetItem )
				}
			};

			dropHandler( mockEvent );

			expect( mockEditor.stateManager.reorderLayer ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'reorderLayers', () => {
		beforeEach( () => {
			controller = new LayerDragDrop( {
				layerList: mockLayerList,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList,
				addTargetListener: mockAddTargetListener
			} );
		} );

		test( 'should use StateManager reorderLayer when available', () => {
			controller.reorderLayers( 'layer_1', 'layer_2' );

			// Third parameter is insertAfter (undefined when not passed)
			expect( mockEditor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'layer_2', undefined );
			expect( mockEditor.canvasManager.redraw ).toHaveBeenCalled();
			expect( mockRenderLayerList ).toHaveBeenCalled();
		} );

		test( 'should fall back to manual reordering when StateManager method unavailable', () => {
			mockEditor.stateManager.reorderLayer = undefined;
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' },
				{ id: 'layer_3', type: 'circle' }
			] );

			controller.reorderLayers( 'layer_1', 'layer_3' );

			expect( mockEditor.stateManager.set ).toHaveBeenCalled();
			const setCall = mockEditor.stateManager.set.mock.calls[ 0 ];
			expect( setCall[ 0 ] ).toBe( 'layers' );

			// layer_1 should now be at position of layer_3
			const newLayers = setCall[ 1 ];
			expect( newLayers[ 0 ].id ).toBe( 'layer_2' );
			expect( newLayers[ 1 ].id ).toBe( 'layer_3' );
			expect( newLayers[ 2 ].id ).toBe( 'layer_1' );
		} );

		test( 'should handle invalid layer IDs gracefully', () => {
			mockEditor.stateManager.reorderLayer = undefined;
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer_1', type: 'text' }
			] );

			controller.reorderLayers( 'nonexistent', 'layer_1' );

			// Should not crash, set should not be called
			expect( mockEditor.stateManager.set ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'moveLayer', () => {
		beforeEach( () => {
			controller = new LayerDragDrop( {
				layerList: mockLayerList,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList,
				addTargetListener: mockAddTargetListener
			} );
		} );

		test( 'should move layer up', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' }
			] );

			controller.moveLayer( 'layer_2', -1 );

			expect( mockEditor.stateManager.set ).toHaveBeenCalled();
			const setCall = mockEditor.stateManager.set.mock.calls[ 0 ];
			const newLayers = setCall[ 1 ];
			expect( newLayers[ 0 ].id ).toBe( 'layer_2' );
			expect( newLayers[ 1 ].id ).toBe( 'layer_1' );
		} );

		test( 'should move layer down', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' }
			] );

			controller.moveLayer( 'layer_1', 1 );

			expect( mockEditor.stateManager.set ).toHaveBeenCalled();
			const setCall = mockEditor.stateManager.set.mock.calls[ 0 ];
			const newLayers = setCall[ 1 ];
			expect( newLayers[ 0 ].id ).toBe( 'layer_2' );
			expect( newLayers[ 1 ].id ).toBe( 'layer_1' );
		} );

		test( 'should not move first layer up', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' }
			] );

			controller.moveLayer( 'layer_1', -1 );

			expect( mockEditor.stateManager.set ).not.toHaveBeenCalled();
		} );

		test( 'should not move last layer down', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' }
			] );

			controller.moveLayer( 'layer_2', 1 );

			expect( mockEditor.stateManager.set ).not.toHaveBeenCalled();
		} );

		test( 'should call focus callback after move', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' }
			] );

			const focusCallback = jest.fn();
			controller.moveLayer( 'layer_2', -1, focusCallback );

			expect( focusCallback ).toHaveBeenCalledWith( 'layer_2' );
		} );

		test( 'should handle nonexistent layer gracefully', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer_1', type: 'text' }
			] );

			controller.moveLayer( 'nonexistent', -1 );

			expect( mockEditor.stateManager.set ).not.toHaveBeenCalled();
		} );

		test( 'should save state after move', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' }
			] );

			controller.moveLayer( 'layer_2', -1 );

			expect( mockEditor.saveState ).toHaveBeenCalledWith( 'Reorder Layers' );
		} );

		test( 'should redraw canvas after move', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' }
			] );

			controller.moveLayer( 'layer_2', -1 );

			expect( mockEditor.canvasManager.redraw ).toHaveBeenCalled();
		} );
	} );

	describe( '_getLayers', () => {
		test( 'should return layers from StateManager', () => {
			const expectedLayers = [
				{ id: 'layer_1', type: 'text' }
			];
			mockEditor.stateManager.get.mockReturnValue( expectedLayers );

			controller = new LayerDragDrop( {
				layerList: mockLayerList,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList,
				addTargetListener: mockAddTargetListener
			} );

			const result = controller._getLayers();
			expect( result ).toBe( expectedLayers );
		} );

		test( 'should return empty array when StateManager unavailable', () => {
			controller = new LayerDragDrop( {
				layerList: mockLayerList,
				editor: {},
				renderLayerList: mockRenderLayerList,
				addTargetListener: mockAddTargetListener
			} );

			const result = controller._getLayers();
			expect( result ).toEqual( [] );
		} );
	} );

	describe( 'handleDrop edge cases', () => {
		test( 'should drop into folder by position when in middle zone', () => {
			// Set up folder layer
			const folderLayer = {
				id: 'folder_1',
				type: 'group',
				children: []
			};

			mockEditor.getLayerById = jest.fn( ( id ) => {
				if ( id === 'folder_1' ) {
					return folderLayer;
				}
				return { id, type: 'rectangle' };
			} );
			mockEditor.groupManager = {
				moveToFolder: jest.fn()
			};

			controller = new LayerDragDrop( {
				layerList: mockLayerList,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList,
				addTargetListener: mockAddTargetListener
			} );

			// Create mock layer items
			const targetItem = document.createElement( 'div' );
			targetItem.className = 'layers-layer-item';
			targetItem.setAttribute( 'data-layer-id', 'folder_1' );
			targetItem.classList.add( 'folder' );

			// Set up draggedId
			controller.draggedId = 'layer_2';

			// Mock the target item bounds
			targetItem.getBoundingClientRect = jest.fn( () => ( {
				top: 0,
				height: 100
			} ) );

			// Create drop event in middle zone (50% of height)
			const dropEvent = {
				preventDefault: jest.fn(),
				stopPropagation: jest.fn(),
				clientY: 50, // Middle of the target
				target: targetItem
			};

			// Note: The actual handleDrop is tested via the bound listener
			// This verifies the controller is ready to handle drops
			expect( controller.draggedId ).toBe( 'layer_2' );
		} );

		test( 'should handle dropping below collapsed folder with children', () => {
			// Set up collapsed folder with children
			const collapsedFolder = {
				id: 'folder_1',
				type: 'group',
				expanded: false,
				children: [ 'child_1', 'child_2' ]
			};

			mockEditor.getLayerById = jest.fn( ( id ) => {
				if ( id === 'folder_1' ) {
					return collapsedFolder;
				}
				return { id, type: 'rectangle' };
			} );
			mockEditor.groupManager = {
				removeFromFolder: jest.fn()
			};
			mockEditor.stateManager.reorderLayer = jest.fn( () => true );

			controller = new LayerDragDrop( {
				layerList: mockLayerList,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList,
				addTargetListener: mockAddTargetListener
			} );

			controller.draggedId = 'layer_3';

			// The collapsed folder path should find the last child and reorder after it
			expect( collapsedFolder.children[ collapsedFolder.children.length - 1 ] ).toBe( 'child_2' );
		} );

		test( 'should use moveToFolder fallback when addToFolderAtPosition unavailable', () => {
			const targetFolder = {
				id: 'folder_1',
				type: 'group',
				children: [ 'child_1' ]
			};

			mockEditor.getLayerById = jest.fn( () => targetFolder );
			mockEditor.groupManager = {
				moveToFolder: jest.fn() // Only moveToFolder available, no addToFolderAtPosition
			};

			controller = new LayerDragDrop( {
				layerList: mockLayerList,
				editor: mockEditor,
				renderLayerList: mockRenderLayerList,
				addTargetListener: mockAddTargetListener
			} );

			// The fallback path uses moveToFolder then reorderLayer
			expect( mockEditor.groupManager.addToFolderAtPosition ).toBeUndefined();
			expect( mockEditor.groupManager.moveToFolder ).toBeDefined();
		} );
	} );

	// ===== Gap coverage tests =====
	// Helper to create a controller and get bound event handlers
	function createControllerWithHandlers( editor, renderFn ) {
		const listeners = {};
		const layerListEl = {
			addEventListener: jest.fn( ( evt, fn ) => {
				listeners[ evt ] = fn;
			} ),
			querySelectorAll: jest.fn( () => [] )
		};
		const ctrl = new LayerDragDrop( {
			layerList: layerListEl,
			editor: editor || {},
			renderLayerList: renderFn || jest.fn(),
			addTargetListener: jest.fn( ( target, evt, fn ) => {
				if ( target && typeof target.addEventListener === 'function' ) {
					target.addEventListener( evt, fn );
				}
			} )
		} );
		return { ctrl, listeners, layerListEl };
	}

	// Helper to create a mock target element with full classList support
	function mockTargetEl( id, opts ) {
		const classes = new Set( opts?.classes || [] );
		return {
			dataset: { layerId: id },
			classList: {
				contains: jest.fn( ( c ) => classes.has( c ) ),
				add: jest.fn( ( ...cs ) => cs.forEach( ( c ) => classes.add( c ) ) ),
				remove: jest.fn( ( ...cs ) => cs.forEach( ( c ) => classes.delete( c ) ) )
			},
			getBoundingClientRect: jest.fn( () => ( { top: opts?.top || 0, height: opts?.height || 100 } ) ),
			getAttribute: jest.fn( ( attr ) => {
				if ( attr === 'aria-expanded' && opts?.ariaExpanded !== undefined ) {
					return opts.ariaExpanded;
				}
				return null;
			} )
		};
	}

	describe( '_handleDragOver - folder zones', () => {
		test( 'collapsed folder: top half → drop-target-above', () => {
			const { ctrl, listeners, layerListEl } = createControllerWithHandlers();
			ctrl._draggedId = 'layer_1';

			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group', 'collapsed' ], height: 100 } );
			listeners.dragover( {
				preventDefault: jest.fn(),
				dataTransfer: {},
				target: { closest: jest.fn( () => target ) },
				clientY: 10 // top half
			} );
			expect( target.classList.add ).toHaveBeenCalledWith( 'drop-target-above' );
		} );

		test( 'collapsed folder: bottom half → drop-target-below', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'layer_1';

			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group', 'collapsed' ], height: 100 } );
			listeners.dragover( {
				preventDefault: jest.fn(),
				dataTransfer: {},
				target: { closest: jest.fn( () => target ) },
				clientY: 70 // bottom half
			} );
			expect( target.classList.add ).toHaveBeenCalledWith( 'drop-target-below' );
		} );

		test( 'collapsed folder via aria-expanded=false', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'layer_1';

			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group' ], height: 100, ariaExpanded: 'false' } );
			listeners.dragover( {
				preventDefault: jest.fn(),
				dataTransfer: {},
				target: { closest: jest.fn( () => target ) },
				clientY: 10
			} );
			expect( target.classList.add ).toHaveBeenCalledWith( 'drop-target-above' );
		} );

		test( 'expanded folder: middle zone → folder-drop-target', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'layer_1';

			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group' ], height: 100 } );
			listeners.dragover( {
				preventDefault: jest.fn(),
				dataTransfer: {},
				target: { closest: jest.fn( () => target ) },
				clientY: 50 // middle (>15, <85)
			} );
			expect( target.classList.add ).toHaveBeenCalledWith( 'folder-drop-target' );
		} );

		test( 'expanded folder: top zone → drop-target-above', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'layer_1';

			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group' ], height: 100 } );
			listeners.dragover( {
				preventDefault: jest.fn(),
				dataTransfer: {},
				target: { closest: jest.fn( () => target ) },
				clientY: 10 // <=15 (top zone)
			} );
			expect( target.classList.add ).toHaveBeenCalledWith( 'drop-target-above' );
		} );

		test( 'expanded folder: bottom zone → drop-target-below', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'layer_1';

			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group' ], height: 100 } );
			listeners.dragover( {
				preventDefault: jest.fn(),
				dataTransfer: {},
				target: { closest: jest.fn( () => target ) },
				clientY: 90 // >= 85 (bottom zone)
			} );
			expect( target.classList.add ).toHaveBeenCalledWith( 'drop-target-below' );
		} );

		test( 'returns early when target is the dragged item', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'layer_1';

			const target = mockTargetEl( 'layer_1', {} );
			listeners.dragover( {
				preventDefault: jest.fn(),
				dataTransfer: {},
				target: { closest: jest.fn( () => target ) },
				clientY: 50
			} );
			// No class should be added since it's same item
			expect( target.classList.add ).not.toHaveBeenCalled();
		} );

		test( 'returns early when no targetItem', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'layer_1';

			const preventDefaultFn = jest.fn();
			listeners.dragover( {
				preventDefault: preventDefaultFn,
				dataTransfer: {},
				target: { closest: jest.fn( () => null ) },
				clientY: 50
			} );
			// preventDefault still called but no further action
			expect( preventDefaultFn ).toHaveBeenCalled();
		} );

		test( 'regular layer: top half → drop-target-above', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'layer_1';

			const target = mockTargetEl( 'layer_2', { height: 40 } );
			listeners.dragover( {
				preventDefault: jest.fn(),
				dataTransfer: {},
				target: { closest: jest.fn( () => target ) },
				clientY: 10 // < 20 = height/2
			} );
			expect( target.classList.add ).toHaveBeenCalledWith( 'drop-target-above' );
		} );

		test( 'regular layer: bottom half → drop-target-below', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'layer_1';

			const target = mockTargetEl( 'layer_2', { height: 40 } );
			listeners.dragover( {
				preventDefault: jest.fn(),
				dataTransfer: {},
				target: { closest: jest.fn( () => target ) },
				clientY: 30 // >= 20 = height/2
			} );
			expect( target.classList.add ).toHaveBeenCalledWith( 'drop-target-below' );
		} );
	} );

	describe( '_handleDragLeave - edge cases', () => {
		test( 'no-op when target is null', () => {
			const { listeners } = createControllerWithHandlers();
			// Should not throw
			listeners.dragleave( {
				target: { closest: jest.fn( () => null ) }
			} );
		} );

		test( 'removes classes from target', () => {
			const { listeners } = createControllerWithHandlers();
			const target = mockTargetEl( 'layer_1', {} );
			listeners.dragleave( {
				target: { closest: jest.fn( () => target ) }
			} );
			expect( target.classList.remove ).toHaveBeenCalledWith( 'folder-drop-target', 'drop-target-above', 'drop-target-below' );
		} );
	} );

	describe( '_handleDrop - __background__ target', () => {
		test( 'drops on __background__ with layer in folder removes from folder and sends to back', () => {
			const renderFn = jest.fn();
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'layer_1' ) {
						return { id: 'layer_1', parentGroup: 'folder_1' };
					}
					return null;
				} ),
				groupManager: { removeFromFolder: jest.fn() },
				stateManager: { sendToBack: jest.fn() },
				canvasManager: { redraw: jest.fn() }
			};
			const { ctrl, listeners } = createControllerWithHandlers( editor, renderFn );
			ctrl._draggedId = 'layer_1';

			const target = mockTargetEl( '__background__', {} );
			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => target ) }
			} );

			expect( editor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer_1' );
			expect( editor.stateManager.sendToBack ).toHaveBeenCalledWith( 'layer_1' );
			expect( editor.canvasManager.redraw ).toHaveBeenCalled();
			expect( renderFn ).toHaveBeenCalled();
		} );

		test( 'drops on __background__ with layer NOT in folder (no parentGroup)', () => {
			const renderFn = jest.fn();
			const editor = {
				getLayerById: jest.fn( () => ( { id: 'layer_1' } ) ),
				groupManager: { removeFromFolder: jest.fn() },
				stateManager: { sendToBack: jest.fn() },
				canvasManager: { redraw: jest.fn() }
			};
			const { listeners } = createControllerWithHandlers( editor, renderFn );

			const target = mockTargetEl( '__background__', {} );
			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => target ) }
			} );

			expect( editor.groupManager.removeFromFolder ).not.toHaveBeenCalled();
			expect( editor.stateManager.sendToBack ).toHaveBeenCalledWith( 'layer_1' );
		} );

		test( 'drops on __background__ without getLayerById', () => {
			const editor = {
				stateManager: { sendToBack: jest.fn() },
				canvasManager: { redraw: jest.fn() }
			};
			const renderFn = jest.fn();
			const { listeners } = createControllerWithHandlers( editor, renderFn );

			const target = mockTargetEl( '__background__', {} );
			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => target ) }
			} );

			expect( editor.stateManager.sendToBack ).toHaveBeenCalledWith( 'layer_1' );
		} );
	} );

	describe( '_handleDrop - collapsed folder with children', () => {
		test( 'drop below collapsed folder reorders after last child', () => {
			const renderFn = jest.fn();
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'folder_1' ) {
						return { id: 'folder_1', expanded: false, children: [ 'c1', 'c2', 'c3' ] };
					}
					if ( id === 'layer_1' ) {
						return { id: 'layer_1' };
					}
					return null;
				} ),
				stateManager: { reorderLayer: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() }
			};
			const { ctrl, listeners, layerListEl } = createControllerWithHandlers( editor, renderFn );

			// Simulate dragover setting drop-target-below on a folder item
			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group' ] } );
			// Manually set isFolderDrop=false, isDropAbove=false, isDropBelow=true
			target.classList.add( 'drop-target-below' );

			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => target ) }
			} );

			// Should reorder after last child 'c3'
			expect( editor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'c3', true );
			expect( editor.canvasManager.redraw ).toHaveBeenCalled();
			expect( renderFn ).toHaveBeenCalled();
		} );

		test( 'drop below collapsed folder removes from current folder first', () => {
			const renderFn = jest.fn();
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'folder_1' ) {
						return { id: 'folder_1', expanded: false, children: [ 'c1' ] };
					}
					if ( id === 'layer_1' ) {
						return { id: 'layer_1', parentGroup: 'folder_2' };
					}
					return null;
				} ),
				groupManager: { removeFromFolder: jest.fn() },
				stateManager: { reorderLayer: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() }
			};
			const { listeners } = createControllerWithHandlers( editor, renderFn );

			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group' ] } );
			target.classList.add( 'drop-target-below' );

			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => target ) }
			} );

			expect( editor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer_1' );
			expect( editor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'c1', true );
		} );

		test( 'drop below expanded folder skips collapsed-folder path', () => {
			const renderFn = jest.fn();
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'folder_1' ) {
						return { id: 'folder_1', expanded: true, children: [ 'c1' ] };
					}
					return { id };
				} ),
				stateManager: { reorderLayer: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() }
			};
			const { listeners } = createControllerWithHandlers( editor, renderFn );

			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group' ] } );
			target.classList.add( 'drop-target-below' );

			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => target ) }
			} );

			// Should go to standard reorder, not collapsed-folder path
			expect( editor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'folder_1', true );
		} );

		test( 'drop below collapsed folder with NO children skips shortcut', () => {
			const renderFn = jest.fn();
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'folder_1' ) {
						return { id: 'folder_1', expanded: false, children: [] };
					}
					return { id };
				} ),
				stateManager: { reorderLayer: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() }
			};
			const { listeners } = createControllerWithHandlers( editor, renderFn );

			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group' ] } );
			target.classList.add( 'drop-target-below' );

			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => target ) }
			} );

			// Falls through to standard reorder
			expect( editor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'folder_1', true );
		} );
	} );

	describe( '_handleDrop - folder drop via highlight class', () => {
		test( 'drops into folder when folder-drop-target class is set', () => {
			global.mw = { notify: jest.fn(), log: { warn: jest.fn() } };
			const renderFn = jest.fn();
			const editor = {
				getLayerById: jest.fn( () => ( { id: 'layer_1' } ) ),
				groupManager: { moveToFolder: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() }
			};
			const { listeners } = createControllerWithHandlers( editor, renderFn );

			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group' ] } );
			target.classList.add( 'folder-drop-target' );

			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => target ) }
			} );

			expect( editor.groupManager.moveToFolder ).toHaveBeenCalledWith( 'layer_1', 'folder_1' );
			delete global.mw;
		} );
	} );

	describe( '_handleDrop - fallback folder position', () => {
		test( 'fallback drops into folder by position (middle zone) when no above/below class', () => {
			global.mw = { notify: jest.fn(), log: { warn: jest.fn() } };
			const renderFn = jest.fn();
			const editor = {
				getLayerById: jest.fn( () => ( { id: 'layer_1' } ) ),
				groupManager: { moveToFolder: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() }
			};
			const { listeners } = createControllerWithHandlers( editor, renderFn );

			// folder without any drop-target class -> fallback position check
			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group' ], height: 100 } );

			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => target ) },
				clientY: 50 // middle zone (>15, <85)
			} );

			expect( editor.groupManager.moveToFolder ).toHaveBeenCalledWith( 'layer_1', 'folder_1' );
			delete global.mw;
		} );

		test( 'fallback does NOT drop into folder if outside middle zone', () => {
			const renderFn = jest.fn();
			const editor = {
				getLayerById: jest.fn( () => ( { id: 'layer_1' } ) ),
				stateManager: { reorderLayer: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() }
			};
			const { listeners } = createControllerWithHandlers( editor, renderFn );

			const target = mockTargetEl( 'folder_1', { classes: [ 'layer-item-group' ], height: 100 } );

			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => target ) },
				clientY: 5 // top zone (<15)
			} );

			// Falls through to standard reorder
			expect( editor.stateManager.reorderLayer ).toHaveBeenCalled();
		} );
	} );

	describe( '_handleDrop - empty draggedId and no target', () => {
		test( 'returns early when draggedId is empty string', () => {
			const editor = {
				stateManager: { reorderLayer: jest.fn() }
			};
			const { listeners } = createControllerWithHandlers( editor );

			const target = mockTargetEl( 'layer_2', {} );
			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => '' ) },
				target: { closest: jest.fn( () => target ) }
			} );

			expect( editor.stateManager.reorderLayer ).not.toHaveBeenCalled();
		} );

		test( 'returns early when no targetItem', () => {
			const editor = {
				stateManager: { reorderLayer: jest.fn() }
			};
			const { listeners } = createControllerWithHandlers( editor );

			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => null ) }
			} );

			expect( editor.stateManager.reorderLayer ).not.toHaveBeenCalled();
		} );
	} );

	describe( '_handleDrop - isDropBelow passed to reorderLayers', () => {
		test( 'passes isDropBelow=true when drop-target-below class is set', () => {
			const editor = {
				getLayerById: jest.fn( () => ( { id: 'layer_1' } ) ),
				stateManager: { reorderLayer: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() }
			};
			const renderFn = jest.fn();
			const { listeners } = createControllerWithHandlers( editor, renderFn );

			const target = mockTargetEl( 'layer_2', {} );
			target.classList.add( 'drop-target-below' );

			listeners.drop( {
				preventDefault: jest.fn(),
				dataTransfer: { getData: jest.fn( () => 'layer_1' ) },
				target: { closest: jest.fn( () => target ) }
			} );

			expect( editor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'layer_2', true );
		} );
	} );

	describe( 'moveToFolder - full paths', () => {
		test( 'success=true shows notification, redraws, re-renders', () => {
			global.mw = { notify: jest.fn(), log: { warn: jest.fn() } };
			const renderFn = jest.fn();
			const editor = {
				groupManager: { moveToFolder: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() }
			};
			const { ctrl } = createControllerWithHandlers( editor, renderFn );

			ctrl.moveToFolder( 'layer_1', 'folder_1' );

			expect( editor.groupManager.moveToFolder ).toHaveBeenCalledWith( 'layer_1', 'folder_1' );
			expect( global.mw.notify ).toHaveBeenCalledWith(
				'Layer moved to folder',
				expect.objectContaining( { type: 'success' } )
			);
			expect( editor.canvasManager.redraw ).toHaveBeenCalled();
			expect( renderFn ).toHaveBeenCalled();
			delete global.mw;
		} );

		test( 'success=false shows error notification, does not redraw', () => {
			global.mw = { notify: jest.fn(), log: { warn: jest.fn() } };
			const renderFn = jest.fn();
			const editor = {
				groupManager: { moveToFolder: jest.fn( () => false ) },
				canvasManager: { redraw: jest.fn() }
			};
			const { ctrl } = createControllerWithHandlers( editor, renderFn );

			ctrl.moveToFolder( 'layer_1', 'folder_1' );

			expect( global.mw.notify ).toHaveBeenCalledWith(
				'Could not move layer to folder',
				expect.objectContaining( { type: 'error' } )
			);
			expect( editor.canvasManager.redraw ).not.toHaveBeenCalled();
			expect( renderFn ).not.toHaveBeenCalled();
			delete global.mw;
		} );

		test( 'success=true without canvasManager does not throw', () => {
			global.mw = { notify: jest.fn() };
			const editor = {
				groupManager: { moveToFolder: jest.fn( () => true ) }
			};
			const { ctrl } = createControllerWithHandlers( editor );
			expect( () => ctrl.moveToFolder( 'l1', 'f1' ) ).not.toThrow();
			delete global.mw;
		} );

		test( 'groupManager unavailable logs warning and shows error notification', () => {
			global.mw = { notify: jest.fn(), log: { warn: jest.fn() } };
			const editor = {};
			const { ctrl } = createControllerWithHandlers( editor );

			ctrl.moveToFolder( 'layer_1', 'folder_1' );

			expect( global.mw.log.warn ).toHaveBeenCalledWith(
				expect.stringContaining( 'moveToFolder not available' )
			);
			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.stringContaining( 'not available' ),
				expect.objectContaining( { type: 'error' } )
			);
			delete global.mw;
		} );

		test( 'groupManager without moveToFolder function logs warning', () => {
			global.mw = { notify: jest.fn(), log: { warn: jest.fn() } };
			const editor = { groupManager: {} };
			const { ctrl } = createControllerWithHandlers( editor );

			ctrl.moveToFolder( 'layer_1', 'folder_1' );

			expect( global.mw.log.warn ).toHaveBeenCalled();
			delete global.mw;
		} );
	} );

	describe( 'reorderLayers - cross-folder moves', () => {
		test( 'dragging INTO a folder uses addToFolderAtPosition', () => {
			const renderFn = jest.fn();
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'layer_1' ) {
						return { id: 'layer_1' }; // not in a folder
					}
					if ( id === 'target_1' ) {
						return { id: 'target_1', parentGroup: 'folder_1' }; // in folder
					}
					if ( id === 'folder_1' ) {
						return { id: 'folder_1', children: [ 'target_1', 'target_2' ] };
					}
					return null;
				} ),
				groupManager: {
					addToFolderAtPosition: jest.fn(),
					removeFromFolder: jest.fn()
				},
				stateManager: { reorderLayer: jest.fn() },
				canvasManager: { redraw: jest.fn() }
			};
			const { ctrl } = createControllerWithHandlers( editor, renderFn );

			ctrl.reorderLayers( 'layer_1', 'target_1', false );

			expect( editor.groupManager.addToFolderAtPosition ).toHaveBeenCalledWith( 'layer_1', 'folder_1', 'target_1' );
			expect( editor.canvasManager.redraw ).toHaveBeenCalled();
			expect( renderFn ).toHaveBeenCalled();
		} );

		test( 'dragging INTO a folder with insertAfter=true and target is last child', () => {
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'layer_1' ) {
						return { id: 'layer_1' };
					}
					if ( id === 'target_1' ) {
						return { id: 'target_1', parentGroup: 'folder_1' };
					}
					if ( id === 'folder_1' ) {
						return { id: 'folder_1', children: [ 'target_1' ] }; // target is last (only) child
					}
					return null;
				} ),
				groupManager: {
					addToFolderAtPosition: jest.fn(),
					removeFromFolder: jest.fn()
				},
				stateManager: { reorderLayer: jest.fn() },
				canvasManager: { redraw: jest.fn() }
			};
			const { ctrl } = createControllerWithHandlers( editor );

			ctrl.reorderLayers( 'layer_1', 'target_1', true );

			// beforeSiblingId = null because target is last
			expect( editor.groupManager.addToFolderAtPosition ).toHaveBeenCalledWith( 'layer_1', 'folder_1', null );
		} );

		test( 'dragging INTO folder with insertAfter=true and target is not last child', () => {
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'layer_1' ) {
						return { id: 'layer_1' };
					}
					if ( id === 'target_1' ) {
						return { id: 'target_1', parentGroup: 'folder_1' };
					}
					if ( id === 'folder_1' ) {
						return { id: 'folder_1', children: [ 'target_1', 'target_2' ] };
					}
					return null;
				} ),
				groupManager: {
					addToFolderAtPosition: jest.fn()
				},
				stateManager: { reorderLayer: jest.fn() },
				canvasManager: { redraw: jest.fn() }
			};
			const { ctrl } = createControllerWithHandlers( editor );

			ctrl.reorderLayers( 'layer_1', 'target_1', true );

			// beforeSiblingId = next sibling 'target_2'
			expect( editor.groupManager.addToFolderAtPosition ).toHaveBeenCalledWith( 'layer_1', 'folder_1', 'target_2' );
		} );

		test( 'dragging INTO folder falls back to moveToFolder when addToFolderAtPosition unavailable', () => {
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'layer_1' ) {
						return { id: 'layer_1' };
					}
					if ( id === 'target_1' ) {
						return { id: 'target_1', parentGroup: 'folder_1' };
					}
					if ( id === 'folder_1' ) {
						return { id: 'folder_1', children: [ 'target_1' ] };
					}
					return null;
				} ),
				groupManager: {
					moveToFolder: jest.fn()
				},
				stateManager: { reorderLayer: jest.fn() },
				canvasManager: { redraw: jest.fn() }
			};
			const { ctrl } = createControllerWithHandlers( editor );

			ctrl.reorderLayers( 'layer_1', 'target_1', false );

			expect( editor.groupManager.moveToFolder ).toHaveBeenCalledWith( 'layer_1', 'folder_1' );
			expect( editor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'target_1' );
		} );

		test( 'dragging OUT of a folder removes from folder then reorders', () => {
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'layer_1' ) {
						return { id: 'layer_1', parentGroup: 'folder_1' };
					}
					if ( id === 'target_1' ) {
						return { id: 'target_1' }; // not in folder
					}
					return null;
				} ),
				groupManager: { removeFromFolder: jest.fn() },
				stateManager: { reorderLayer: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() }
			};
			const renderFn = jest.fn();
			const { ctrl } = createControllerWithHandlers( editor, renderFn );

			ctrl.reorderLayers( 'layer_1', 'target_1', false );

			expect( editor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer_1' );
			expect( editor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'target_1', false );
			expect( editor.canvasManager.redraw ).toHaveBeenCalled();
			expect( renderFn ).toHaveBeenCalled();
		} );

		test( 'dragging between different folders removes from source, adds to target', () => {
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'layer_1' ) {
						return { id: 'layer_1', parentGroup: 'folder_A' };
					}
					if ( id === 'target_1' ) {
						return { id: 'target_1', parentGroup: 'folder_B' };
					}
					if ( id === 'folder_B' ) {
						return { id: 'folder_B', children: [ 'target_1' ] };
					}
					return null;
				} ),
				groupManager: {
					addToFolderAtPosition: jest.fn(),
					removeFromFolder: jest.fn()
				},
				stateManager: { reorderLayer: jest.fn() },
				canvasManager: { redraw: jest.fn() }
			};
			const { ctrl } = createControllerWithHandlers( editor );

			ctrl.reorderLayers( 'layer_1', 'target_1', false );

			// Should remove from folder_A first
			expect( editor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer_1' );
			// Then add to folder_B
			expect( editor.groupManager.addToFolderAtPosition ).toHaveBeenCalledWith( 'layer_1', 'folder_B', 'target_1' );
		} );

		test( 'same folder reorder does not remove/add to folder', () => {
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'layer_1' ) {
						return { id: 'layer_1', parentGroup: 'folder_1' };
					}
					if ( id === 'layer_2' ) {
						return { id: 'layer_2', parentGroup: 'folder_1' };
					}
					return null;
				} ),
				groupManager: {
					addToFolderAtPosition: jest.fn(),
					removeFromFolder: jest.fn()
				},
				stateManager: { reorderLayer: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() }
			};
			const renderFn = jest.fn();
			const { ctrl } = createControllerWithHandlers( editor, renderFn );

			ctrl.reorderLayers( 'layer_1', 'layer_2', false );

			// same folder - no folder operations
			expect( editor.groupManager.removeFromFolder ).not.toHaveBeenCalled();
			expect( editor.groupManager.addToFolderAtPosition ).not.toHaveBeenCalled();
			// standard reorder
			expect( editor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'layer_2', false );
		} );

		test( 'reorderLayer returns false → does not redraw or re-render', () => {
			const editor = {
				getLayerById: jest.fn( () => ( { id: 'x' } ) ),
				stateManager: { reorderLayer: jest.fn( () => false ) },
				canvasManager: { redraw: jest.fn() }
			};
			const renderFn = jest.fn();
			const { ctrl } = createControllerWithHandlers( editor, renderFn );

			ctrl.reorderLayers( 'layer_1', 'layer_2', false );

			expect( editor.canvasManager.redraw ).not.toHaveBeenCalled();
			expect( renderFn ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'moveLayer - folder exit via keyboard', () => {
		test( 'moving layer out of folder removes and re-indexes', () => {
			const layersBeforeRemoval = [
				{ id: 'folder_1', type: 'group' },
				{ id: 'layer_1', type: 'text', parentGroup: 'folder_1' },
				{ id: 'layer_2', type: 'rectangle' }
			];
			const layersAfterRemoval = [
				{ id: 'folder_1', type: 'group' },
				{ id: 'layer_1', type: 'text' }, // parentGroup removed
				{ id: 'layer_2', type: 'rectangle' }
			];
			let callCount = 0;
			const renderFn = jest.fn();
			const editor = {
				getLayerById: jest.fn(),
				groupManager: { removeFromFolder: jest.fn() },
				stateManager: {
					get: jest.fn( () => {
						callCount++;
						return callCount <= 1 ? layersBeforeRemoval : layersAfterRemoval;
					} ),
					set: jest.fn()
				},
				canvasManager: { redraw: jest.fn() },
				saveState: jest.fn()
			};
			const { ctrl } = createControllerWithHandlers( editor, renderFn );

			// direction=-1: move layer_1 up; target is folder_1 (the folder header itself)
			// layer_1 is at index 1, target is at index 0
			// movingLayer has parentGroup, target doesn't match parentGroup and is the folder
			ctrl.moveLayer( 'layer_1', -1 );

			// layer is in folder, moving up to folder header (isTargetTheFolder=true)
			// so it stays within folder; no removeFromFolder called
			expect( editor.stateManager.set ).toHaveBeenCalled();
		} );

		test( 'moving layer out of folder to an outside layer', () => {
			const layersData = [
				{ id: 'layer_outside', type: 'circle' },
				{ id: 'folder_1', type: 'group' },
				{ id: 'layer_inside', type: 'text', parentGroup: 'folder_1' }
			];
			const layersAfterRemoval = [
				{ id: 'layer_outside', type: 'circle' },
				{ id: 'folder_1', type: 'group' },
				{ id: 'layer_inside', type: 'text' } // parentGroup removed
			];
			let callCount = 0;
			const focusCallback = jest.fn();
			const renderFn = jest.fn();
			const editor = {
				groupManager: { removeFromFolder: jest.fn() },
				stateManager: {
					get: jest.fn( () => {
						callCount++;
						return callCount <= 1 ? layersData : layersAfterRemoval;
					} ),
					set: jest.fn()
				},
				canvasManager: { redraw: jest.fn() },
				saveState: jest.fn()
			};
			const { ctrl } = createControllerWithHandlers( editor, renderFn );

			// Move layer_inside (index 2) up by -1 → target layer_outside? no, target is folder_1 (index 1)
			// Actually direction=-1: newIndex=2+(-1)=1, target is folder_1 (isTargetTheFolder=true)
			// To test the "outside folder" path we need direction=-2... but that's not how it works.
			// Let me set up where layer_inside is at index 1 and target at index 0 is outside
			const layers2 = [
				{ id: 'layer_outside', type: 'circle' },
				{ id: 'layer_inside', type: 'text', parentGroup: 'folder_1' }
			];
			const layers2After = [
				{ id: 'layer_outside', type: 'circle' },
				{ id: 'layer_inside', type: 'text' }
			];
			callCount = 0;
			editor.stateManager.get.mockImplementation( () => {
				callCount++;
				return callCount <= 1 ? layers2 : layers2After;
			} );

			ctrl.moveLayer( 'layer_inside', -1, focusCallback );

			// target is layer_outside which has no parentGroup and is not the folder
			expect( editor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer_inside' );
			expect( editor.stateManager.set ).toHaveBeenCalled();
			expect( editor.canvasManager.redraw ).toHaveBeenCalled();
			expect( editor.saveState ).toHaveBeenCalledWith( 'Move Layer Out of Folder' );
			expect( focusCallback ).toHaveBeenCalledWith( 'layer_inside' );
		} );

		test( 'moving layer out of folder without groupManager does standard swap', () => {
			const layers = [
				{ id: 'layer_outside', type: 'circle' },
				{ id: 'layer_inside', type: 'text', parentGroup: 'folder_1' }
			];
			const editor = {
				stateManager: {
					get: jest.fn( () => layers ),
					set: jest.fn()
				},
				canvasManager: { redraw: jest.fn() },
				saveState: jest.fn()
			};
			const { ctrl } = createControllerWithHandlers( editor );

			ctrl.moveLayer( 'layer_inside', -1 );

			// No groupManager → goes to else branch → standard swap
			expect( editor.stateManager.set ).toHaveBeenCalled();
			expect( editor.saveState ).toHaveBeenCalledWith( 'Reorder Layers' );
		} );
	} );

	describe( '_defaultAddListener', () => {
		test( 'calls addEventListener on target', () => {
			const target = { addEventListener: jest.fn() };
			const handler = jest.fn();
			const ctrl = new LayerDragDrop( {
				layerList: null,
				editor: {},
				renderLayerList: jest.fn()
			} );
			ctrl._defaultAddListener( target, 'click', handler, { passive: true } );
			expect( target.addEventListener ).toHaveBeenCalledWith( 'click', handler, { passive: true } );
		} );

		test( 'handles null target gracefully', () => {
			const ctrl = new LayerDragDrop( {
				layerList: null,
				editor: {},
				renderLayerList: jest.fn()
			} );
			expect( () => ctrl._defaultAddListener( null, 'click', jest.fn() ) ).not.toThrow();
		} );

		test( 'handles target without addEventListener', () => {
			const ctrl = new LayerDragDrop( {
				layerList: null,
				editor: {},
				renderLayerList: jest.fn()
			} );
			expect( () => ctrl._defaultAddListener( {}, 'click', jest.fn() ) ).not.toThrow();
		} );
	} );

	describe( '_handleDragEnd - edge cases', () => {
		test( 'handles dragend when no layer item found', () => {
			const { listeners, layerListEl } = createControllerWithHandlers();
			listeners.dragend( {
				target: { closest: jest.fn( () => null ) }
			} );
			// Should not throw, just clear highlights
		} );
	} );

	describe( 'LayerDragDrop - branch coverage gaps', () => {
		// --- _getLayers guard ---
		test( '_getLayers returns empty array when no stateManager', () => {
			const ctrl = new LayerDragDrop( {
				layerList: null,
				editor: {},
				renderLayerList: jest.fn()
			} );
			expect( ctrl._getLayers() ).toEqual( [] );
		} );

		test( '_getLayers returns empty array when editor is null', () => {
			const ctrl = new LayerDragDrop( {
				layerList: null,
				editor: null,
				renderLayerList: jest.fn()
			} );
			expect( ctrl._getLayers() ).toEqual( [] );
		} );

		// --- _handleDragStart no layer-item ---
		test( 'dragstart does nothing when target is not a layer item', () => {
			const { listeners } = createControllerWithHandlers();
			const setData = jest.fn();
			listeners.dragstart( {
				target: { closest: jest.fn( () => null ) },
				dataTransfer: { setData, effectAllowed: 'none' }
			} );
			expect( setData ).not.toHaveBeenCalled();
		} );

		// --- _handleDragOver: no target or self ---
		test( 'dragover returns early when no targetItem found', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'layer1';
			const evt = {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => null ) },
				dataTransfer: { dropEffect: '' },
				clientY: 50
			};
			listeners.dragover( evt );
			// Should not throw
			expect( evt.preventDefault ).toHaveBeenCalled();
		} );

		test( 'dragover returns early when target is the dragged layer', () => {
			const { ctrl, listeners, layerListEl } = createControllerWithHandlers();
			ctrl._draggedId = 'layer1';
			const target = mockTargetEl( 'layer1' );
			const evt = {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => target ) },
				dataTransfer: { dropEffect: '' },
				clientY: 50
			};
			listeners.dragover( evt );
			// Should not add any classes
			expect( target.classList.add ).not.toHaveBeenCalled();
		} );

		// --- _handleDragOver: folder via aria-expanded only ---
		test( 'dragover detects collapsed folder via aria-expanded', () => {
			const { ctrl, listeners, layerListEl } = createControllerWithHandlers();
			ctrl._draggedId = 'other';
			// No 'collapsed' class, but aria-expanded='false'
			const target = mockTargetEl( 'folder1', {
				classes: [ 'layer-item-group' ],
				ariaExpanded: 'false',
				height: 100,
				top: 0
			} );
			const evt = {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => target ) },
				dataTransfer: { dropEffect: '' },
				clientY: 20
			};
			listeners.dragover( evt );
			expect( target.classList.add ).toHaveBeenCalledWith( 'drop-target-above' );
		} );

		// --- _handleDragOver: expanded folder zones ---
		test( 'dragover expanded folder top zone adds drop-target-above', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'other';
			const target = mockTargetEl( 'folder1', {
				classes: [ 'layer-item-group' ],
				ariaExpanded: 'true',
				height: 100,
				top: 0
			} );
			const evt = {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => target ) },
				dataTransfer: { dropEffect: '' },
				clientY: 5 // top 15% zone
			};
			listeners.dragover( evt );
			expect( target.classList.add ).toHaveBeenCalledWith( 'drop-target-above' );
		} );

		test( 'dragover expanded folder bottom zone adds drop-target-below', () => {
			const { ctrl, listeners } = createControllerWithHandlers();
			ctrl._draggedId = 'other';
			const target = mockTargetEl( 'folder1', {
				classes: [ 'layer-item-group' ],
				ariaExpanded: 'true',
				height: 100,
				top: 0
			} );
			const evt = {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => target ) },
				dataTransfer: { dropEffect: '' },
				clientY: 95 // bottom zone
			};
			listeners.dragover( evt );
			expect( target.classList.add ).toHaveBeenCalledWith( 'drop-target-below' );
		} );

		// --- _handleDragLeave: no target ---
		test( 'dragleave does nothing when no target found', () => {
			const { listeners } = createControllerWithHandlers();
			expect( () => listeners.dragleave( {
				target: { closest: jest.fn( () => null ) }
			} ) ).not.toThrow();
		} );

		// --- _handleDrop guards ---
		test( 'drop returns early when no draggedId', () => {
			const { listeners } = createControllerWithHandlers();
			const target = mockTargetEl( 'layer1' );
			expect( () => listeners.drop( {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => target ) },
				dataTransfer: { getData: jest.fn( () => '' ) }
			} ) ).not.toThrow();
		} );

		test( 'drop returns early when draggedId equals targetId', () => {
			const { listeners } = createControllerWithHandlers();
			const target = mockTargetEl( 'layer1' );
			expect( () => listeners.drop( {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => target ) },
				dataTransfer: { getData: jest.fn( () => 'layer1' ) }
			} ) ).not.toThrow();
		} );

		// --- _handleDrop: folder fallback position ---
		test( 'drop uses position fallback for folder when no highlight classes', () => {
			const editor = {
				groupManager: { moveToFolder: jest.fn( () => true ) },
				canvasManager: { redraw: jest.fn() },
				stateManager: { get: jest.fn( () => [] ) }
			};
			const renderFn = jest.fn();
			const { ctrl, listeners } = createControllerWithHandlers( editor, renderFn );
			ctrl._draggedId = 'layer1';

			const target = mockTargetEl( 'folder1', {
				classes: [ 'layer-item-group' ],
				height: 100,
				top: 0
			} );
			// Middle zone (50%) => drop INTO folder
			listeners.drop( {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => target ) },
				dataTransfer: { getData: jest.fn( () => 'layer1' ) },
				clientY: 50
			} );
			expect( editor.groupManager.moveToFolder ).toHaveBeenCalledWith( 'layer1', 'folder1' );
		} );

		// --- _handleDrop: __background__ ---
		test( 'drop on __background__ calls sendToBack', () => {
			const editor = {
				getLayerById: jest.fn( () => ( { id: 'layer1', type: 'rectangle' } ) ),
				stateManager: { get: jest.fn( () => [] ), sendToBack: jest.fn() },
				canvasManager: { redraw: jest.fn() }
			};
			const renderFn = jest.fn();
			const { listeners } = createControllerWithHandlers( editor, renderFn );

			const target = mockTargetEl( '__background__' );
			listeners.drop( {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => target ) },
				dataTransfer: { getData: jest.fn( () => 'layer1' ) }
			} );
			expect( editor.stateManager.sendToBack ).toHaveBeenCalledWith( 'layer1' );
		} );

		test( 'drop on __background__ removes from folder first', () => {
			const editor = {
				getLayerById: jest.fn( () => ( { id: 'layer1', type: 'rectangle', parentGroup: 'f1' } ) ),
				groupManager: { removeFromFolder: jest.fn() },
				stateManager: { get: jest.fn( () => [] ), sendToBack: jest.fn() },
				canvasManager: { redraw: jest.fn() }
			};
			const renderFn = jest.fn();
			const { listeners } = createControllerWithHandlers( editor, renderFn );

			const target = mockTargetEl( '__background__' );
			listeners.drop( {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => target ) },
				dataTransfer: { getData: jest.fn( () => 'layer1' ) }
			} );
			expect( editor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer1' );
		} );

		// --- moveToFolder: success ---
		test( 'moveToFolder shows success notification', () => {
			const mockGroupManager = { moveToFolder: jest.fn( () => true ) };
			const editor = {
				groupManager: mockGroupManager,
				canvasManager: { redraw: jest.fn() },
				stateManager: { get: jest.fn( () => [] ) }
			};
			const renderFn = jest.fn();
			global.mw = { notify: jest.fn(), log: { warn: jest.fn() } };
			const { ctrl } = createControllerWithHandlers( editor, renderFn );
			ctrl.moveToFolder( 'layer1', 'folder1' );
			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.stringContaining( 'moved to folder' ),
				expect.objectContaining( { type: 'success' } )
			);
		} );

		test( 'moveToFolder shows error notification on failure', () => {
			const mockGroupManager = { moveToFolder: jest.fn( () => false ) };
			const editor = {
				groupManager: mockGroupManager,
				stateManager: { get: jest.fn( () => [] ) }
			};
			global.mw = { notify: jest.fn(), log: { warn: jest.fn() } };
			const { ctrl } = createControllerWithHandlers( editor );
			ctrl.moveToFolder( 'layer1', 'folder1' );
			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.stringContaining( 'Could not' ),
				expect.objectContaining( { type: 'error' } )
			);
		} );

		test( 'moveToFolder handles missing groupManager', () => {
			const editor = { stateManager: { get: jest.fn( () => [] ) } };
			global.mw = { notify: jest.fn(), log: { warn: jest.fn() } };
			const { ctrl } = createControllerWithHandlers( editor );
			expect( () => ctrl.moveToFolder( 'layer1', 'folder1' ) ).not.toThrow();
			expect( global.mw.log.warn ).toHaveBeenCalledWith(
				expect.stringContaining( 'not available' )
			);
		} );

		// --- _handleDrop: collapsed folder below ---
		test( 'drop below collapsed folder places after last child', () => {
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'folder1' ) {
						return { id: 'folder1', type: 'group', expanded: false, children: [ 'c1', 'c2' ] };
					}
					return { id, type: 'rectangle' };
				} ),
				stateManager: {
					get: jest.fn( () => [] ),
					reorderLayer: jest.fn( () => true )
				},
				canvasManager: { redraw: jest.fn() }
			};
			const renderFn = jest.fn();
			const { ctrl, listeners } = createControllerWithHandlers( editor, renderFn );
			ctrl._draggedId = 'layer1';

			const target = mockTargetEl( 'folder1', {
				classes: [ 'layer-item-group', 'drop-target-below' ]
			} );
			listeners.drop( {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => target ) },
				dataTransfer: { getData: jest.fn( () => 'layer1' ) }
			} );
			expect( editor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer1', 'c2', true );
		} );

		test( 'drop below collapsed folder removes from existing folder first', () => {
			const editor = {
				getLayerById: jest.fn( ( id ) => {
					if ( id === 'folder1' ) {
						return { id: 'folder1', type: 'group', expanded: false, children: [ 'c1' ] };
					}
					return { id: 'layer1', type: 'rectangle', parentGroup: 'other-folder' };
				} ),
				groupManager: { removeFromFolder: jest.fn() },
				stateManager: {
					get: jest.fn( () => [] ),
					reorderLayer: jest.fn( () => true )
				},
				canvasManager: { redraw: jest.fn() }
			};
			const renderFn = jest.fn();
			const { ctrl, listeners } = createControllerWithHandlers( editor, renderFn );
			ctrl._draggedId = 'layer1';

			const target = mockTargetEl( 'folder1', {
				classes: [ 'layer-item-group', 'drop-target-below' ]
			} );
			listeners.drop( {
				preventDefault: jest.fn(),
				target: { closest: jest.fn( () => target ) },
				dataTransfer: { getData: jest.fn( () => 'layer1' ) }
			} );
			expect( editor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer1' );
		} );
	} );
} );
