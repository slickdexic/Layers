'use strict';

/**
 * Tests for LayerDragDrop.js
 * Layer drag-and-drop reordering controller
 */

const LayerDragDrop = require( '../../../resources/ext.layers.editor/ui/LayerDragDrop.js' );

describe( 'LayerDragDrop', () => {
	let layerList;
	let mockEditor;
	let renderLayerList;
	let addTargetListener;
	let listeners;

	beforeEach( () => {
		// Reset listeners tracking
		listeners = [];

		// Create mock layer list element
		layerList = document.createElement( 'div' );
		layerList.className = 'layer-list';

		// Create mock layer items
		const layer1 = document.createElement( 'div' );
		layer1.className = 'layer-item';
		layer1.dataset.layerId = 'layer-1';

		const layer2 = document.createElement( 'div' );
		layer2.className = 'layer-item';
		layer2.dataset.layerId = 'layer-2';

		const layer3 = document.createElement( 'div' );
		layer3.className = 'layer-item';
		layer3.dataset.layerId = 'layer-3';

		layerList.appendChild( layer1 );
		layerList.appendChild( layer2 );
		layerList.appendChild( layer3 );

		// Create mock editor with stateManager and canvasManager
		mockEditor = {
			stateManager: {
				get: jest.fn( () => [
					{ id: 'layer-1', type: 'rectangle' },
					{ id: 'layer-2', type: 'circle' },
					{ id: 'layer-3', type: 'text' }
				] ),
				set: jest.fn(),
				reorderLayer: jest.fn( () => true )
			},
			canvasManager: {
				redraw: jest.fn()
			},
			saveState: jest.fn()
		};

		// Create mock render callback
		renderLayerList = jest.fn();

		// Create mock event listener tracker
		addTargetListener = jest.fn( ( target, event, handler, options ) => {
			listeners.push( { target, event, handler, options } );
			target.addEventListener( event, handler, options );
		} );
	} );

	describe( 'constructor', () => {
		test( 'should create instance with config', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			expect( dragDrop.layerList ).toBe( layerList );
			expect( dragDrop.editor ).toBe( mockEditor );
			expect( dragDrop.renderLayerList ).toBe( renderLayerList );
			expect( dragDrop.addTargetListener ).toBe( addTargetListener );
		} );

		test( 'should use default addTargetListener when not provided', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList
			} );

			expect( typeof dragDrop.addTargetListener ).toBe( 'function' );
		} );

		test( 'should call setup during construction', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			// Should have registered 5 event listeners (including dragleave for folder drop)
			expect( addTargetListener ).toHaveBeenCalledTimes( 5 );
			expect( addTargetListener ).toHaveBeenCalledWith(
				layerList, 'dragstart', expect.any( Function )
			);
			expect( addTargetListener ).toHaveBeenCalledWith(
				layerList, 'dragend', expect.any( Function )
			);
			expect( addTargetListener ).toHaveBeenCalledWith(
				layerList, 'dragover', expect.any( Function )
			);
			expect( addTargetListener ).toHaveBeenCalledWith(
				layerList, 'dragleave', expect.any( Function )
			);
			expect( addTargetListener ).toHaveBeenCalledWith(
				layerList, 'drop', expect.any( Function )
			);
		} );
	} );

	describe( 'setup', () => {
		test( 'should do nothing when layerList is null', () => {
			const localAddListener = jest.fn();
			const dragDrop = new LayerDragDrop( {
				layerList: null,
				editor: mockEditor,
				renderLayerList,
				addTargetListener: localAddListener
			} );

			expect( localAddListener ).not.toHaveBeenCalled();
		} );

		test( 'should register all drag event listeners', () => {
			new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const events = listeners.map( l => l.event );
			expect( events ).toContain( 'dragstart' );
			expect( events ).toContain( 'dragend' );
			expect( events ).toContain( 'dragover' );
			expect( events ).toContain( 'dragleave' );
			expect( events ).toContain( 'drop' );
		} );
	} );

	describe( '_defaultAddListener', () => {
		test( 'should add event listener to target', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList
			} );

			const target = document.createElement( 'div' );
			const handler = jest.fn();
			const addEventSpy = jest.spyOn( target, 'addEventListener' );

			dragDrop._defaultAddListener( target, 'click', handler );

			expect( addEventSpy ).toHaveBeenCalledWith( 'click', handler, undefined );
		} );

		test( 'should pass options to addEventListener', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList
			} );

			const target = document.createElement( 'div' );
			const handler = jest.fn();
			const options = { capture: true };
			const addEventSpy = jest.spyOn( target, 'addEventListener' );

			dragDrop._defaultAddListener( target, 'click', handler, options );

			expect( addEventSpy ).toHaveBeenCalledWith( 'click', handler, options );
		} );

		test( 'should handle null target gracefully', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList
			} );

			expect( () => {
				dragDrop._defaultAddListener( null, 'click', jest.fn() );
			} ).not.toThrow();
		} );

		test( 'should handle target without addEventListener', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList
			} );

			expect( () => {
				dragDrop._defaultAddListener( {}, 'click', jest.fn() );
			} ).not.toThrow();
		} );
	} );

	describe( '_getLayers', () => {
		test( 'should get layers from stateManager', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const layers = dragDrop._getLayers();

			expect( mockEditor.stateManager.get ).toHaveBeenCalledWith( 'layers' );
			expect( layers ).toHaveLength( 3 );
		} );

		test( 'should return empty array when stateManager returns null', () => {
			mockEditor.stateManager.get.mockReturnValue( null );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const layers = dragDrop._getLayers();
			expect( layers ).toEqual( [] );
		} );

		test( 'should return empty array when editor is null', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: null,
				renderLayerList,
				addTargetListener
			} );

			const layers = dragDrop._getLayers();
			expect( layers ).toEqual( [] );
		} );

		test( 'should return empty array when stateManager is null', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: { stateManager: null },
				renderLayerList,
				addTargetListener
			} );

			const layers = dragDrop._getLayers();
			expect( layers ).toEqual( [] );
		} );
	} );

	describe( '_handleDragStart', () => {
		test( 'should add dragging class to layer item', () => {
			new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const layerItem = layerList.querySelector( '[data-layer-id="layer-1"]' );
			const mockDataTransfer = {
				setData: jest.fn()
			};

			const event = new Event( 'dragstart', { bubbles: true } );
			Object.defineProperty( event, 'dataTransfer', {
				value: mockDataTransfer
			} );

			layerItem.dispatchEvent( event );

			expect( layerItem.classList.contains( 'dragging' ) ).toBe( true );
			expect( mockDataTransfer.setData ).toHaveBeenCalledWith( 'text/plain', 'layer-1' );
		} );

		test( 'should do nothing if not on layer item', () => {
			new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const mockDataTransfer = {
				setData: jest.fn()
			};

			const event = new Event( 'dragstart', { bubbles: true } );
			Object.defineProperty( event, 'dataTransfer', {
				value: mockDataTransfer
			} );

			layerList.dispatchEvent( event );

			expect( mockDataTransfer.setData ).not.toHaveBeenCalled();
		} );
	} );

	describe( '_handleDragEnd', () => {
		test( 'should remove dragging class from layer item', () => {
			new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const layerItem = layerList.querySelector( '[data-layer-id="layer-1"]' );
			layerItem.classList.add( 'dragging' );

			const event = new Event( 'dragend', { bubbles: true } );
			layerItem.dispatchEvent( event );

			expect( layerItem.classList.contains( 'dragging' ) ).toBe( false );
		} );
	} );

	describe( '_handleDrop', () => {
		test( 'should call reorderLayers on valid drop', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const reorderSpy = jest.spyOn( dragDrop, 'reorderLayers' );

			const targetItem = layerList.querySelector( '[data-layer-id="layer-2"]' );
			const mockDataTransfer = {
				getData: jest.fn( () => 'layer-1' )
			};

			const event = new Event( 'drop', { bubbles: true } );
			Object.defineProperty( event, 'dataTransfer', {
				value: mockDataTransfer
			} );
			event.preventDefault = jest.fn();

			targetItem.dispatchEvent( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			// Third parameter is insertAfter (false when no drop-target-below class)
			expect( reorderSpy ).toHaveBeenCalledWith( 'layer-1', 'layer-2', false );
		} );

		test( 'should not reorder when dropping on same layer', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const reorderSpy = jest.spyOn( dragDrop, 'reorderLayers' );

			const targetItem = layerList.querySelector( '[data-layer-id="layer-1"]' );
			const mockDataTransfer = {
				getData: jest.fn( () => 'layer-1' )
			};

			const event = new Event( 'drop', { bubbles: true } );
			Object.defineProperty( event, 'dataTransfer', {
				value: mockDataTransfer
			} );
			event.preventDefault = jest.fn();

			targetItem.dispatchEvent( event );

			expect( reorderSpy ).not.toHaveBeenCalled();
		} );

		test( 'should not reorder when no target item', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const reorderSpy = jest.spyOn( dragDrop, 'reorderLayers' );

			const mockDataTransfer = {
				getData: jest.fn( () => 'layer-1' )
			};

			const event = new Event( 'drop', { bubbles: true } );
			Object.defineProperty( event, 'dataTransfer', {
				value: mockDataTransfer
			} );
			event.preventDefault = jest.fn();

			layerList.dispatchEvent( event );

			expect( reorderSpy ).not.toHaveBeenCalled();
		} );

		test( 'should not reorder when no draggedId', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const reorderSpy = jest.spyOn( dragDrop, 'reorderLayers' );

			const targetItem = layerList.querySelector( '[data-layer-id="layer-2"]' );
			const mockDataTransfer = {
				getData: jest.fn( () => '' )
			};

			const event = new Event( 'drop', { bubbles: true } );
			Object.defineProperty( event, 'dataTransfer', {
				value: mockDataTransfer
			} );
			event.preventDefault = jest.fn();

			targetItem.dispatchEvent( event );

			expect( reorderSpy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'dragover', () => {
		test( 'should prevent default on dragover', () => {
			new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const mockDataTransfer = {
				dropEffect: null
			};

			const event = new Event( 'dragover', { bubbles: true } );
			Object.defineProperty( event, 'dataTransfer', {
				value: mockDataTransfer
			} );
			event.preventDefault = jest.fn();

			layerList.dispatchEvent( event );

			expect( event.preventDefault ).toHaveBeenCalled();
		} );
	} );

	describe( 'reorderLayers', () => {
		test( 'should use StateManager.reorderLayer when available', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.reorderLayers( 'layer-1', 'layer-2' );

			// Third parameter is insertAfter (undefined when not passed)
			expect( mockEditor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer-1', 'layer-2', undefined );
			expect( mockEditor.canvasManager.redraw ).toHaveBeenCalled();
			expect( renderLayerList ).toHaveBeenCalled();
		} );

		test( 'should not redraw when reorderLayer returns false', () => {
			mockEditor.stateManager.reorderLayer.mockReturnValue( false );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.reorderLayers( 'layer-1', 'layer-2' );

			expect( mockEditor.canvasManager.redraw ).not.toHaveBeenCalled();
			expect( renderLayerList ).not.toHaveBeenCalled();
		} );

		test( 'should fallback to manual reorder when reorderLayer not available', () => {
			delete mockEditor.stateManager.reorderLayer;

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.reorderLayers( 'layer-1', 'layer-3' );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith(
				'layers',
				expect.any( Array )
			);
			expect( mockEditor.canvasManager.redraw ).toHaveBeenCalled();
			expect( renderLayerList ).toHaveBeenCalled();
			expect( mockEditor.saveState ).toHaveBeenCalledWith( 'Reorder Layers' );
		} );

		test( 'should not reorder when dragged layer not found (fallback)', () => {
			delete mockEditor.stateManager.reorderLayer;

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.reorderLayers( 'non-existent', 'layer-2' );

			expect( mockEditor.stateManager.set ).not.toHaveBeenCalled();
			expect( mockEditor.saveState ).not.toHaveBeenCalled();
		} );

		test( 'should not reorder when target layer not found (fallback)', () => {
			delete mockEditor.stateManager.reorderLayer;

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.reorderLayers( 'layer-1', 'non-existent' );

			expect( mockEditor.stateManager.set ).not.toHaveBeenCalled();
			expect( mockEditor.saveState ).not.toHaveBeenCalled();
		} );

		test( 'should handle missing canvasManager', () => {
			mockEditor.canvasManager = null;

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			expect( () => {
				dragDrop.reorderLayers( 'layer-1', 'layer-2' );
			} ).not.toThrow();
		} );

		test( 'should handle non-function renderLayerList', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList: 'not-a-function',
				addTargetListener
			} );

			expect( () => {
				dragDrop.reorderLayers( 'layer-1', 'layer-2' );
			} ).not.toThrow();
		} );

		test( 'should remove layer from folder when dragged outside folder', () => {
			// Setup layers with one inside a folder
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'folder-1', type: 'group', children: [ 'layer-2' ] },
				{ id: 'layer-1', type: 'rectangle' },
				{ id: 'layer-2', type: 'circle', parentGroup: 'folder-1' },
				{ id: 'layer-3', type: 'text' }
			] );
			mockEditor.getLayerById = jest.fn( ( id ) => {
				const layers = mockEditor.stateManager.get();
				return layers.find( ( l ) => l.id === id );
			} );
			mockEditor.groupManager = {
				removeFromFolder: jest.fn( () => true )
			};

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			// Drag layer-2 (in folder-1) to layer-3 (not in folder)
			dragDrop.reorderLayers( 'layer-2', 'layer-3' );

			// Should have called removeFromFolder
			expect( mockEditor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer-2' );
		} );

		test( 'should not remove from folder when dragging within same folder', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'folder-1', type: 'group', children: [ 'layer-1', 'layer-2' ] },
				{ id: 'layer-1', type: 'rectangle', parentGroup: 'folder-1' },
				{ id: 'layer-2', type: 'circle', parentGroup: 'folder-1' }
			] );
			mockEditor.getLayerById = jest.fn( ( id ) => {
				const layers = mockEditor.stateManager.get();
				return layers.find( ( l ) => l.id === id );
			} );
			mockEditor.groupManager = {
				removeFromFolder: jest.fn()
			};

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			// Drag layer-1 to layer-2 (both in same folder)
			dragDrop.reorderLayers( 'layer-1', 'layer-2' );

			// Should NOT have called removeFromFolder
			expect( mockEditor.groupManager.removeFromFolder ).not.toHaveBeenCalled();
		} );

		test( 'should remove from folder when dragging to the folder itself', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'folder-1', type: 'group', children: [ 'layer-1' ] },
				{ id: 'layer-1', type: 'rectangle', parentGroup: 'folder-1' }
			] );
			mockEditor.getLayerById = jest.fn( ( id ) => {
				const layers = mockEditor.stateManager.get();
				return layers.find( ( l ) => l.id === id );
			} );
			mockEditor.groupManager = {
				removeFromFolder: jest.fn()
			};

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			// Drag layer-1 to its parent folder (meaning: move out of folder, above/below folder header)
			dragDrop.reorderLayers( 'layer-1', 'folder-1' );

			// SHOULD have called removeFromFolder - user is dragging layer out of folder
			expect( mockEditor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer-1' );
		} );

		test( 'should add layer to folder when dragging between folder children', () => {
			// Layer-3 is outside folder, layer-1 and layer-2 are inside folder-1
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'folder-1', type: 'group', children: [ 'layer-1', 'layer-2' ] },
				{ id: 'layer-1', type: 'rectangle', parentGroup: 'folder-1' },
				{ id: 'layer-2', type: 'circle', parentGroup: 'folder-1' },
				{ id: 'layer-3', type: 'text' } // Not in folder
			] );
			mockEditor.getLayerById = jest.fn( ( id ) => {
				const layers = mockEditor.stateManager.get();
				return layers.find( ( l ) => l.id === id );
			} );
			mockEditor.groupManager = {
				addToFolderAtPosition: jest.fn( () => true ),
				moveToFolder: jest.fn( () => true ),
				removeFromFolder: jest.fn()
			};

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			// Drag layer-3 (outside) to layer-2 (inside folder-1)
			dragDrop.reorderLayers( 'layer-3', 'layer-2' );

			// Should have called addToFolderAtPosition
			expect( mockEditor.groupManager.addToFolderAtPosition ).toHaveBeenCalledWith(
				'layer-3', 'folder-1', 'layer-2'
			);
		} );

		test( 'should fallback to moveToFolder if addToFolderAtPosition not available', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'folder-1', type: 'group', children: [ 'layer-1' ] },
				{ id: 'layer-1', type: 'rectangle', parentGroup: 'folder-1' },
				{ id: 'layer-2', type: 'circle' }
			] );
			mockEditor.getLayerById = jest.fn( ( id ) => {
				const layers = mockEditor.stateManager.get();
				return layers.find( ( l ) => l.id === id );
			} );
			mockEditor.groupManager = {
				moveToFolder: jest.fn( () => true ),
				removeFromFolder: jest.fn()
			};

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.reorderLayers( 'layer-2', 'layer-1' );

			// Should have called moveToFolder as fallback
			expect( mockEditor.groupManager.moveToFolder ).toHaveBeenCalledWith(
				'layer-2', 'folder-1'
			);
		} );

		test( 'should move layer between folders correctly', () => {
			// layer-1 is in folder-1, dragging to folder-2
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'folder-1', type: 'group', children: [ 'layer-1' ] },
				{ id: 'layer-1', type: 'rectangle', parentGroup: 'folder-1' },
				{ id: 'folder-2', type: 'group', children: [ 'layer-2' ] },
				{ id: 'layer-2', type: 'circle', parentGroup: 'folder-2' }
			] );
			mockEditor.getLayerById = jest.fn( ( id ) => {
				const layers = mockEditor.stateManager.get();
				return layers.find( ( l ) => l.id === id );
			} );
			mockEditor.groupManager = {
				addToFolderAtPosition: jest.fn( () => true ),
				removeFromFolder: jest.fn( () => true )
			};

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			// Drag layer-1 (in folder-1) to layer-2 (in folder-2)
			dragDrop.reorderLayers( 'layer-1', 'layer-2' );

			// Should have removed from folder-1 and added to folder-2
			expect( mockEditor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer-1' );
			expect( mockEditor.groupManager.addToFolderAtPosition ).toHaveBeenCalledWith(
				'layer-1', 'folder-2', 'layer-2'
			);
		} );
	} );

	describe( 'moveLayer', () => {
		test( 'should move layer up (direction -1)', () => {
			delete mockEditor.stateManager.reorderLayer;
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer-1', type: 'rectangle' },
				{ id: 'layer-2', type: 'circle' },
				{ id: 'layer-3', type: 'text' }
			] );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveLayer( 'layer-2', -1 );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith(
				'layers',
				expect.arrayContaining( [
					expect.objectContaining( { id: 'layer-2' } ),
					expect.objectContaining( { id: 'layer-1' } ),
					expect.objectContaining( { id: 'layer-3' } )
				] )
			);
		} );

		test( 'should move layer down (direction 1)', () => {
			delete mockEditor.stateManager.reorderLayer;
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer-1', type: 'rectangle' },
				{ id: 'layer-2', type: 'circle' },
				{ id: 'layer-3', type: 'text' }
			] );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveLayer( 'layer-2', 1 );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith(
				'layers',
				expect.arrayContaining( [
					expect.objectContaining( { id: 'layer-1' } ),
					expect.objectContaining( { id: 'layer-3' } ),
					expect.objectContaining( { id: 'layer-2' } )
				] )
			);
		} );

		test( 'should not move first layer up', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveLayer( 'layer-1', -1 );

			expect( mockEditor.stateManager.set ).not.toHaveBeenCalled();
		} );

		test( 'should not move last layer down', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveLayer( 'layer-3', 1 );

			expect( mockEditor.stateManager.set ).not.toHaveBeenCalled();
		} );

		test( 'should not move non-existent layer', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveLayer( 'non-existent', 1 );

			expect( mockEditor.stateManager.set ).not.toHaveBeenCalled();
		} );

		test( 'should call focusCallback after move', () => {
			delete mockEditor.stateManager.reorderLayer;
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer-1', type: 'rectangle' },
				{ id: 'layer-2', type: 'circle' }
			] );

			const focusCallback = jest.fn();

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveLayer( 'layer-2', -1, focusCallback );

			expect( focusCallback ).toHaveBeenCalledWith( 'layer-2' );
		} );

		test( 'should handle missing focusCallback', () => {
			delete mockEditor.stateManager.reorderLayer;
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer-1', type: 'rectangle' },
				{ id: 'layer-2', type: 'circle' }
			] );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			expect( () => {
				dragDrop.moveLayer( 'layer-2', -1 );
			} ).not.toThrow();
		} );

		test( 'should call saveState after move', () => {
			delete mockEditor.stateManager.reorderLayer;
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer-1', type: 'rectangle' },
				{ id: 'layer-2', type: 'circle' }
			] );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveLayer( 'layer-2', -1 );

			expect( mockEditor.saveState ).toHaveBeenCalledWith( 'Reorder Layers' );
		} );

		test( 'should redraw canvas after move', () => {
			delete mockEditor.stateManager.reorderLayer;
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'layer-1', type: 'rectangle' },
				{ id: 'layer-2', type: 'circle' }
			] );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveLayer( 'layer-2', -1 );

			expect( mockEditor.canvasManager.redraw ).toHaveBeenCalled();
		} );

		test( 'should handle missing stateManager', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: { saveState: jest.fn() },
				renderLayerList,
				addTargetListener
			} );

			expect( () => {
				dragDrop.moveLayer( 'layer-1', 1 );
			} ).not.toThrow();
		} );
	} );

	describe( '_handleDragOver with folders', () => {
		test( 'should show drop-target-above for regular layer top half', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			// Set the dragged ID to simulate an active drag operation
			dragDrop._draggedId = 'layer-3';

			const targetItem = layerList.querySelector( '[data-layer-id="layer-2"]' );

			// Call the handler directly for more reliable testing
			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: { dropEffect: null },
				target: { closest: jest.fn( () => targetItem ) },
				clientY: 5 // Top of element
			};

			// Mock getBoundingClientRect
			targetItem.getBoundingClientRect = jest.fn( () => ( { top: 0, height: 40 } ) );

			dragDrop._handleDragOver( mockEvent );

			expect( targetItem.classList.contains( 'drop-target-above' ) ).toBe( true );
		} );

		test( 'should show drop-target-below for regular layer bottom half', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop._draggedId = 'layer-3';

			const targetItem = layerList.querySelector( '[data-layer-id="layer-2"]' );

			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: { dropEffect: null },
				target: { closest: jest.fn( () => targetItem ) },
				clientY: 35 // Bottom of element (height is 40)
			};

			targetItem.getBoundingClientRect = jest.fn( () => ( { top: 0, height: 40 } ) );

			dragDrop._handleDragOver( mockEvent );

			expect( targetItem.classList.contains( 'drop-target-below' ) ).toBe( true );
		} );

		test( 'should show folder-drop-target for expanded folder middle zone', () => {
			// Add a folder item
			const folderItem = document.createElement( 'div' );
			folderItem.className = 'layer-item layer-item-group';
			folderItem.dataset.layerId = 'folder-1';
			folderItem.setAttribute( 'aria-expanded', 'true' );
			layerList.appendChild( folderItem );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop._draggedId = 'layer-1';

			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: { dropEffect: null },
				target: { closest: jest.fn( () => folderItem ) },
				clientY: 20 // Middle of folder (50% of height 40 = middle zone 15%-85%)
			};

			folderItem.getBoundingClientRect = jest.fn( () => ( { top: 0, height: 40 } ) );

			dragDrop._handleDragOver( mockEvent );

			expect( folderItem.classList.contains( 'folder-drop-target' ) ).toBe( true );
		} );

		test( 'should show drop-target-above for collapsed folder top half', () => {
			const folderItem = document.createElement( 'div' );
			folderItem.className = 'layer-item layer-item-group collapsed';
			folderItem.dataset.layerId = 'folder-1';
			folderItem.setAttribute( 'aria-expanded', 'false' );
			layerList.appendChild( folderItem );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop._draggedId = 'layer-1';

			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: { dropEffect: null },
				target: { closest: jest.fn( () => folderItem ) },
				clientY: 5 // Top half
			};

			folderItem.getBoundingClientRect = jest.fn( () => ( { top: 0, height: 40 } ) );

			dragDrop._handleDragOver( mockEvent );

			expect( folderItem.classList.contains( 'drop-target-above' ) ).toBe( true );
			expect( folderItem.classList.contains( 'folder-drop-target' ) ).toBe( false );
		} );

		test( 'should show drop-target-below for collapsed folder bottom half', () => {
			const folderItem = document.createElement( 'div' );
			folderItem.className = 'layer-item layer-item-group collapsed';
			folderItem.dataset.layerId = 'folder-1';
			folderItem.setAttribute( 'aria-expanded', 'false' );
			layerList.appendChild( folderItem );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop._draggedId = 'layer-1';

			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: { dropEffect: null },
				target: { closest: jest.fn( () => folderItem ) },
				clientY: 35 // Bottom half
			};

			folderItem.getBoundingClientRect = jest.fn( () => ( { top: 0, height: 40 } ) );

			dragDrop._handleDragOver( mockEvent );

			expect( folderItem.classList.contains( 'drop-target-below' ) ).toBe( true );
		} );

		test( 'should show drop-target-above for expanded folder top zone', () => {
			const folderItem = document.createElement( 'div' );
			folderItem.className = 'layer-item layer-item-group';
			folderItem.dataset.layerId = 'folder-1';
			folderItem.setAttribute( 'aria-expanded', 'true' );
			layerList.appendChild( folderItem );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop._draggedId = 'layer-1';

			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: { dropEffect: null },
				target: { closest: jest.fn( () => folderItem ) },
				clientY: 2 // Very top (< 15% of 40 = 6)
			};

			folderItem.getBoundingClientRect = jest.fn( () => ( { top: 0, height: 40 } ) );

			dragDrop._handleDragOver( mockEvent );

			expect( folderItem.classList.contains( 'drop-target-above' ) ).toBe( true );
		} );

		test( 'should show drop-target-below for expanded folder bottom zone', () => {
			const folderItem = document.createElement( 'div' );
			folderItem.className = 'layer-item layer-item-group';
			folderItem.dataset.layerId = 'folder-1';
			folderItem.setAttribute( 'aria-expanded', 'true' );
			layerList.appendChild( folderItem );

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop._draggedId = 'layer-1';

			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: { dropEffect: null },
				target: { closest: jest.fn( () => folderItem ) },
				clientY: 38 // Very bottom (> 85% of 40 = 34)
			};

			folderItem.getBoundingClientRect = jest.fn( () => ( { top: 0, height: 40 } ) );

			dragDrop._handleDragOver( mockEvent );

			expect( folderItem.classList.contains( 'drop-target-below' ) ).toBe( true );
		} );

		test( 'should not highlight when dragging over self', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop._draggedId = 'layer-1';

			const targetItem = layerList.querySelector( '[data-layer-id="layer-1"]' );

			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: { dropEffect: null },
				target: { closest: jest.fn( () => targetItem ) },
				clientY: 20
			};

			dragDrop._handleDragOver( mockEvent );

			expect( targetItem.classList.contains( 'drop-target-above' ) ).toBe( false );
			expect( targetItem.classList.contains( 'drop-target-below' ) ).toBe( false );
		} );

		test( 'should return early when no target item found', () => {
			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop._draggedId = 'layer-1';

			const mockEvent = {
				preventDefault: jest.fn(),
				dataTransfer: { dropEffect: null },
				target: { closest: jest.fn( () => null ) },
				clientY: 20
			};

			// Should not throw
			expect( () => {
				dragDrop._handleDragOver( mockEvent );
			} ).not.toThrow();
		} );
	} );

	describe( '_handleDragLeave', () => {
		test( 'should remove all drop highlight classes on dragleave', () => {
			new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const targetItem = layerList.querySelector( '[data-layer-id="layer-2"]' );
			targetItem.classList.add( 'folder-drop-target' );
			targetItem.classList.add( 'drop-target-above' );
			targetItem.classList.add( 'drop-target-below' );

			const event = new Event( 'dragleave', { bubbles: true } );
			targetItem.dispatchEvent( event );

			expect( targetItem.classList.contains( 'folder-drop-target' ) ).toBe( false );
			expect( targetItem.classList.contains( 'drop-target-above' ) ).toBe( false );
			expect( targetItem.classList.contains( 'drop-target-below' ) ).toBe( false );
		} );
	} );

	describe( '_handleDrop with folders', () => {
		test( 'should call moveToFolder when drop on folder with folder-drop-target class', () => {
			// Add a folder item
			const folderItem = document.createElement( 'div' );
			folderItem.className = 'layer-item layer-item-group folder-drop-target';
			folderItem.dataset.layerId = 'folder-1';
			layerList.appendChild( folderItem );

			mockEditor.groupManager = {
				moveToFolder: jest.fn( () => true )
			};

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const moveToFolderSpy = jest.spyOn( dragDrop, 'moveToFolder' );

			const mockDataTransfer = {
				getData: jest.fn( () => 'layer-1' )
			};

			const event = new Event( 'drop', { bubbles: true } );
			Object.defineProperty( event, 'dataTransfer', {
				value: mockDataTransfer
			} );
			event.preventDefault = jest.fn();

			folderItem.dispatchEvent( event );

			expect( moveToFolderSpy ).toHaveBeenCalledWith( 'layer-1', 'folder-1' );
		} );

		test( 'should handle drop below collapsed folder with children', () => {
			const folderItem = document.createElement( 'div' );
			folderItem.className = 'layer-item layer-item-group drop-target-below';
			folderItem.dataset.layerId = 'folder-1';
			layerList.appendChild( folderItem );

			mockEditor.getLayerById = jest.fn( ( id ) => {
				if ( id === 'folder-1' ) {
					return {
						id: 'folder-1',
						type: 'group',
						expanded: false,
						children: [ 'child-1', 'child-2' ]
					};
				}
				if ( id === 'layer-1' ) {
					return { id: 'layer-1', type: 'rectangle' };
				}
				return null;
			} );
			mockEditor.stateManager.reorderLayer = jest.fn( () => true );

			new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const mockDataTransfer = {
				getData: jest.fn( () => 'layer-1' )
			};

			const event = new Event( 'drop', { bubbles: true } );
			Object.defineProperty( event, 'dataTransfer', {
				value: mockDataTransfer
			} );
			event.preventDefault = jest.fn();

			folderItem.dispatchEvent( event );

			// Should reorder after the last child, not the folder itself
			expect( mockEditor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer-1', 'child-2', true );
		} );

		test( 'should handle drop on background layer', () => {
			const bgItem = document.createElement( 'div' );
			bgItem.className = 'layer-item';
			bgItem.dataset.layerId = '__background__';
			layerList.appendChild( bgItem );

			mockEditor.getLayerById = jest.fn( () => ( { id: 'layer-1', type: 'rectangle' } ) );
			mockEditor.stateManager.sendToBack = jest.fn();

			new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const mockDataTransfer = {
				getData: jest.fn( () => 'layer-1' )
			};

			const event = new Event( 'drop', { bubbles: true } );
			Object.defineProperty( event, 'dataTransfer', {
				value: mockDataTransfer
			} );
			event.preventDefault = jest.fn();

			bgItem.dispatchEvent( event );

			expect( mockEditor.stateManager.sendToBack ).toHaveBeenCalledWith( 'layer-1' );
		} );

		test( 'should remove from folder when dropping on background', () => {
			const bgItem = document.createElement( 'div' );
			bgItem.className = 'layer-item';
			bgItem.dataset.layerId = '__background__';
			layerList.appendChild( bgItem );

			mockEditor.getLayerById = jest.fn( () => ( {
				id: 'layer-1',
				type: 'rectangle',
				parentGroup: 'folder-1'
			} ) );
			mockEditor.stateManager.sendToBack = jest.fn();
			mockEditor.groupManager = {
				removeFromFolder: jest.fn()
			};

			new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			const mockDataTransfer = {
				getData: jest.fn( () => 'layer-1' )
			};

			const event = new Event( 'drop', { bubbles: true } );
			Object.defineProperty( event, 'dataTransfer', {
				value: mockDataTransfer
			} );
			event.preventDefault = jest.fn();

			bgItem.dispatchEvent( event );

			expect( mockEditor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer-1' );
			expect( mockEditor.stateManager.sendToBack ).toHaveBeenCalledWith( 'layer-1' );
		} );
	} );

	describe( 'moveToFolder', () => {
		test( 'should call groupManager.moveToFolder and show success notification', () => {
			mockEditor.groupManager = {
				moveToFolder: jest.fn( () => true )
			};

			// Mock mw.notify
			const mockNotify = jest.fn();
			global.mw = { notify: mockNotify };

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveToFolder( 'layer-1', 'folder-1' );

			expect( mockEditor.groupManager.moveToFolder ).toHaveBeenCalledWith( 'layer-1', 'folder-1' );
			expect( mockNotify ).toHaveBeenCalledWith(
				'Layer moved to folder',
				expect.objectContaining( { type: 'success' } )
			);
			expect( mockEditor.canvasManager.redraw ).toHaveBeenCalled();
			expect( renderLayerList ).toHaveBeenCalled();

			delete global.mw;
		} );

		test( 'should show error notification when moveToFolder fails', () => {
			mockEditor.groupManager = {
				moveToFolder: jest.fn( () => false )
			};

			const mockNotify = jest.fn();
			global.mw = { notify: mockNotify };

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveToFolder( 'layer-1', 'folder-1' );

			expect( mockNotify ).toHaveBeenCalledWith(
				'Could not move layer to folder',
				expect.objectContaining( { type: 'error' } )
			);
			expect( mockEditor.canvasManager.redraw ).not.toHaveBeenCalled();

			delete global.mw;
		} );

		test( 'should log error when groupManager not available', () => {
			mockEditor.groupManager = null;

			const mockLogWarn = jest.fn();
			const mockNotify = jest.fn();
			global.mw = {
				notify: mockNotify,
				log: { warn: mockLogWarn }
			};

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveToFolder( 'layer-1', 'folder-1' );

			// Uses mw.log.warn instead of console.error (security fix)
			expect( mockLogWarn ).toHaveBeenCalledWith(
				'[LayerDragDrop] groupManager.moveToFolder not available'
			);
			expect( mockNotify ).toHaveBeenCalledWith(
				'Folder functionality not available - please reload',
				expect.objectContaining( { type: 'error' } )
			);

			delete global.mw;
		} );

		test( 'should handle missing mw.notify gracefully', () => {
			mockEditor.groupManager = {
				moveToFolder: jest.fn( () => true )
			};

			delete global.mw;

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			expect( () => {
				dragDrop.moveToFolder( 'layer-1', 'folder-1' );
			} ).not.toThrow();
		} );
	} );

	describe( 'moveLayer with folder handling', () => {
		test( 'should remove layer from folder when moving outside', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'folder-1', type: 'group', children: [ 'layer-1' ] },
				{ id: 'layer-1', type: 'rectangle', parentGroup: 'folder-1' },
				{ id: 'layer-2', type: 'circle' }
			] );
			mockEditor.groupManager = {
				removeFromFolder: jest.fn( () => {
					// After removal, simulate updated layers
					mockEditor.stateManager.get.mockReturnValue( [
						{ id: 'folder-1', type: 'group', children: [] },
						{ id: 'layer-1', type: 'rectangle' },
						{ id: 'layer-2', type: 'circle' }
					] );
				} )
			};

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			// Move layer-1 down to layer-2 (outside folder)
			dragDrop.moveLayer( 'layer-1', 1 );

			expect( mockEditor.groupManager.removeFromFolder ).toHaveBeenCalledWith( 'layer-1' );
			expect( mockEditor.saveState ).toHaveBeenCalledWith( 'Move Layer Out of Folder' );
		} );

		test( 'should call focus callback when moving out of folder', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'folder-1', type: 'group', children: [ 'layer-1' ] },
				{ id: 'layer-1', type: 'rectangle', parentGroup: 'folder-1' },
				{ id: 'layer-2', type: 'circle' }
			] );
			mockEditor.groupManager = {
				removeFromFolder: jest.fn( () => {
					mockEditor.stateManager.get.mockReturnValue( [
						{ id: 'folder-1', type: 'group', children: [] },
						{ id: 'layer-1', type: 'rectangle' },
						{ id: 'layer-2', type: 'circle' }
					] );
				} )
			};

			const focusCallback = jest.fn();

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			dragDrop.moveLayer( 'layer-1', 1, focusCallback );

			expect( focusCallback ).toHaveBeenCalledWith( 'layer-1' );
		} );

		test( 'should allow moving to folder itself (exit folder)', () => {
			mockEditor.stateManager.get.mockReturnValue( [
				{ id: 'folder-1', type: 'group', children: [ 'layer-1' ] },
				{ id: 'layer-1', type: 'rectangle', parentGroup: 'folder-1' }
			] );
			mockEditor.groupManager = {
				removeFromFolder: jest.fn()
			};

			const dragDrop = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			// Move layer-1 up (to folder-1 header)
			dragDrop.moveLayer( 'layer-1', -1 );

			// Moving to the folder header itself should do a normal swap
			// (the layer is still in the folder in this case)
			expect( mockEditor.stateManager.set ).toHaveBeenCalled();
		} );
	} );

	describe( '_clearDropHighlights', () => {
		test( 'should clear all highlight classes from all items', () => {
			new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			// Add highlights to all items
			layerList.querySelectorAll( '.layer-item' ).forEach( ( item ) => {
				item.classList.add( 'folder-drop-target' );
				item.classList.add( 'drop-target-above' );
				item.classList.add( 'drop-target-below' );
			} );

			// Trigger dragend which calls _clearDropHighlights
			const event = new Event( 'dragend', { bubbles: true } );
			layerList.querySelector( '.layer-item' ).dispatchEvent( event );

			// All highlights should be cleared
			layerList.querySelectorAll( '.layer-item' ).forEach( ( item ) => {
				expect( item.classList.contains( 'folder-drop-target' ) ).toBe( false );
				expect( item.classList.contains( 'drop-target-above' ) ).toBe( false );
				expect( item.classList.contains( 'drop-target-below' ) ).toBe( false );
			} );
		} );
	} );

	describe( 'module exports', () => {
		test( 'should export LayerDragDrop class', () => {
			expect( LayerDragDrop ).toBeDefined();
			expect( typeof LayerDragDrop ).toBe( 'function' );
		} );

		test( 'should allow creating new instances', () => {
			const instance = new LayerDragDrop( {
				layerList,
				editor: mockEditor,
				renderLayerList,
				addTargetListener
			} );

			expect( instance ).toBeInstanceOf( LayerDragDrop );
		} );
	} );
} );
