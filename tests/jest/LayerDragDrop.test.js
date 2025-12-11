/**
 * Tests for LayerDragDrop controller
 */

const fs = require( 'fs' );
const path = require( 'path' );

// Load the source file
const sourceFile = path.join( __dirname, '../../resources/ext.layers.editor/ui/LayerDragDrop.js' );
const sourceCode = fs.readFileSync( sourceFile, 'utf8' );

// Execute in a controlled environment
const mockWindow = {
	Layers: { UI: {} },
	LayerDragDrop: null
};

// eslint-disable-next-line no-new-func
const initModule = new Function( 'window', 'module', sourceCode + '\nreturn window.Layers.UI.LayerDragDrop;' );
const LayerDragDrop = initModule( mockWindow, { exports: {} } );

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

			expect( mockAddTargetListener ).toHaveBeenCalledTimes( 4 );
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

			const mockEvent = {
				preventDefault: jest.fn()
			};

			dragoverHandler( mockEvent );

			expect( mockEvent.preventDefault ).toHaveBeenCalled();
		} );

		test( 'should handle drop event', () => {
			const dropHandler = addedListeners.find( ( l ) => l.event === 'drop' )?.handler;
			expect( dropHandler ).toBeDefined();

			const mockTargetItem = {
				dataset: { layerId: 'layer_2' }
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
			expect( mockEditor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'layer_2' );
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

			expect( mockEditor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer_1', 'layer_2' );
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
} );
