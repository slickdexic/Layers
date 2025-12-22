'use strict';

/**
 * Tests for LayerDragDrop.js
 * Layer drag-and-drop reordering controller
 */

const { LayerDragDrop } = require( '../../../resources/ext.layers.editor/ui/LayerDragDrop.js' );

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

			// Should have registered 4 event listeners
			expect( addTargetListener ).toHaveBeenCalledTimes( 4 );
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
			expect( reorderSpy ).toHaveBeenCalledWith( 'layer-1', 'layer-2' );
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

			const event = new Event( 'dragover', { bubbles: true } );
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

			expect( mockEditor.stateManager.reorderLayer ).toHaveBeenCalledWith( 'layer-1', 'layer-2' );
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
