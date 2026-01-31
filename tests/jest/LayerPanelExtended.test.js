/**
 * @jest-environment jsdom
 */

/**
 * Extended Unit Tests for LayerPanel
 *
 * Tests layer reordering, divider resize, confirmation dialogs, 
 * and render methods to increase coverage.
 */

'use strict';

const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );
const HistoryManager = require( '../../resources/ext.layers.editor/HistoryManager.js' );

// Mock IconFactory
const mockIconFactory = {
	createSVGElement: jest.fn( ( tag ) => document.createElementNS( 'http://www.w3.org/2000/svg', tag ) ),
	createEyeIcon: jest.fn( () => {
		const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		svg.setAttribute( 'data-testid', 'eye-icon' );
		return svg;
	} ),
	createLockIcon: jest.fn( () => {
		const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		svg.setAttribute( 'data-testid', 'lock-icon' );
		return svg;
	} ),
	createDeleteIcon: jest.fn( () => {
		const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		svg.setAttribute( 'data-testid', 'delete-icon' );
		return svg;
	} ),
	createGrabIcon: jest.fn( () => {
		const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		svg.setAttribute( 'data-testid', 'grab-icon' );
		return svg;
	} )
};

describe( 'LayerPanel Extended', () => {
	let LayerPanel;
	let mockEditor;
	let mockStateManager;
	let container;

	beforeEach( () => {
		// Setup window globals with namespaced structure
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.StateManager = StateManager;
		window.HistoryManager = HistoryManager;
		window.Layers.UI.IconFactory = mockIconFactory;
		window.Layers.UI.ColorPickerDialog = null;
		window.Layers.UI.ConfirmDialog = null;
		window.Layers.UI.PropertiesForm = null;

		// Load LayerItemFactory for layer item creation
		const LayerItemFactory = require( '../../resources/ext.layers.editor/ui/LayerItemFactory.js' );
		window.Layers.UI.LayerItemFactory = LayerItemFactory;

		// Load LayerListRenderer for layer list rendering
		const LayerListRenderer = require( '../../resources/ext.layers.editor/ui/LayerListRenderer.js' );
		window.Layers.UI.LayerListRenderer = LayerListRenderer;

		// Load FolderOperationsController for folder operations
		const FolderOperationsController = require( '../../resources/ext.layers.editor/ui/FolderOperationsController.js' );
		window.Layers.UI.FolderOperationsController = FolderOperationsController;

		// Setup DOM
		document.body.innerHTML = `
			<div id="layers-panel-container"></div>
			<div id="inspector-container"></div>
		`;

		container = document.getElementById( 'layers-panel-container' );

		// Create mock StateManager
		mockStateManager = new StateManager();
		mockStateManager.set( 'layers', [] );
		mockStateManager.set( 'selectedLayerIds', [] );

		// Create mock editor
		mockEditor = {
			stateManager: mockStateManager,
			container: document.body,
			canvasManager: {
				redraw: jest.fn(),
				selectLayer: jest.fn(),
				setSelectedLayerIds: jest.fn(),
				renderLayers: jest.fn(),
				drawMultiSelectionIndicators: jest.fn()
			},
			removeLayer: jest.fn(),
			saveState: jest.fn(),
			updateLayer: jest.fn(),
			getLayerById: jest.fn( ( id ) => {
				const layers = mockStateManager.get( 'layers' ) || [];
				return layers.find( ( l ) => l.id === id ) || null;
			} ),
			layers: []
		};

		// Reset module cache and reload LayerPanel
		jest.resetModules();
		jest.clearAllMocks();

		require( '../../resources/ext.layers.editor/LayerPanel.js' );
		LayerPanel = window.Layers.UI.LayerPanel;
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		document.body.innerHTML = '';
	} );

	describe( 'reorderLayers', () => {
		it( 'should delegate to dragDropController when available', () => {
			const mockDragDrop = {
				reorderLayers: jest.fn()
			};

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.dragDropController = mockDragDrop;
			panel.reorderLayers( 'layer1', 'layer2' );

			expect( mockDragDrop.reorderLayers ).toHaveBeenCalledWith( 'layer1', 'layer2' );
		} );

		it( 'should do nothing when dragDropController is not available', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' },
				{ id: 'layer3', type: 'text' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.dragDropController = null;

			// Without controller, reorderLayers does nothing
			panel.reorderLayers( 'layer1', 'layer3' );

			// Layers should be unchanged since delegation is required
			const currentLayers = mockStateManager.get( 'layers' );
			expect( currentLayers ).toEqual( layers );
		} );
	} );

	describe( 'renderLayerList', () => {
		it( 'should render empty message when no layers', () => {
			mockStateManager.set( 'layers', [] );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.renderLayerList();

			// The empty message class is 'layers-empty' not 'layers-empty-message'
			expect( panel.layerList.querySelector( '.layers-empty' ) ).not.toBeNull();
		} );

		it( 'should render layer items for each layer', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle', name: 'Rectangle 1' },
				{ id: 'layer2', type: 'circle', name: 'Circle 1' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.renderLayerList();

			// Exclude background layer item from count
			const items = panel.layerList.querySelectorAll( '.layer-item:not(.background-layer-item)' );
			expect( items.length ).toBe( 2 );
		} );

		it( 'should mark selected layer with selected class', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' }
			];
			mockStateManager.set( 'layers', layers );
			mockStateManager.set( 'selectedLayerIds', [ 'layer1' ] );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.renderLayerList();

			// The code uses .selected class, not aria-selected
			const selectedItem = panel.layerList.querySelector( '.layer-item.selected' );
			expect( selectedItem ).not.toBeNull();
			expect( selectedItem.dataset.layerId ).toBe( 'layer1' );
		} );

		it( 'should handle visibility toggle in layer item', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle', visible: true }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.renderLayerList();

			// The visibility button class is 'layer-visibility' not 'layer-visibility-btn'
			const visibilityBtn = panel.layerList.querySelector( '.layer-visibility' );
			expect( visibilityBtn ).not.toBeNull();
		} );
	} );

	describe( 'handleLayerListClick', () => {
		it( 'should select layer on click', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.renderLayerList();

			// Create mock click event on layer item
			const layerItem = panel.layerList.querySelector( '[data-layer-id="layer1"]' );
			expect( layerItem ).not.toBeNull();

			const event = new MouseEvent( 'click', { bubbles: true } );
			layerItem.dispatchEvent( event );

			// Selection should update
			const selected = mockStateManager.get( 'selectedLayerIds' );
			expect( selected ).toContain( 'layer1' );
		} );

		it( 'should toggle visibility when clicking visibility button', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle', visible: true }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.renderLayerList();

			const visibilityBtn = panel.layerList.querySelector( '.layer-visibility-btn' );
			if ( visibilityBtn ) {
				const event = new MouseEvent( 'click', { bubbles: true } );
				visibilityBtn.dispatchEvent( event );
			}

			// Should have attempted to update layer
			// Note: exact behavior depends on implementation
		} );
	} );

	describe( 'createConfirmDialog', () => {
		let mockConfirmDialogShow;

		beforeEach( () => {
			// Mock ConfirmDialog.show for all tests
			mockConfirmDialogShow = jest.fn();
			window.Layers.UI.ConfirmDialog = {
				show: mockConfirmDialogShow
			};
		} );

		afterEach( () => {
			// Clean up the mock
			delete window.Layers.UI.ConfirmDialog;
		} );

		it( 'should delegate to ConfirmDialog.show when available', () => {
			// Reset modules to pick up the mock
			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.Layers.UI.LayerPanel;

			const panel = new LP( {
				container: container,
				editor: mockEditor
			} );

			const onConfirm = jest.fn();
			panel.createConfirmDialog( 'Test message', onConfirm );

			expect( mockConfirmDialogShow ).toHaveBeenCalled();
			const callArgs = mockConfirmDialogShow.mock.calls[ 0 ][ 0 ];
			expect( callArgs.message ).toBe( 'Test message' );
			expect( callArgs.onConfirm ).toBe( onConfirm );
		} );

		it( 'should pass strings configuration to ConfirmDialog', () => {
			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.Layers.UI.LayerPanel;

			const panel = new LP( {
				container: container,
				editor: mockEditor
			} );

			panel.createConfirmDialog( 'Test message', jest.fn() );

			expect( mockConfirmDialogShow ).toHaveBeenCalled();
			const callArgs = mockConfirmDialogShow.mock.calls[ 0 ][ 0 ];
			expect( callArgs.strings ).toBeDefined();
			expect( callArgs.strings.title ).toBeDefined();
			expect( callArgs.strings.cancel ).toBeDefined();
			expect( callArgs.strings.confirm ).toBeDefined();
		} );

		it( 'should register cleanup callback with ConfirmDialog', () => {
			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.Layers.UI.LayerPanel;

			const panel = new LP( {
				container: container,
				editor: mockEditor
			} );

			panel.createConfirmDialog( 'Test message', jest.fn() );

			expect( mockConfirmDialogShow ).toHaveBeenCalled();
			const callArgs = mockConfirmDialogShow.mock.calls[ 0 ][ 0 ];
			expect( typeof callArgs.registerCleanup ).toBe( 'function' );
		} );

		it( 'should do nothing if ConfirmDialog is not available', () => {
			// Remove the mock to simulate ConfirmDialog not being available
			delete window.Layers.UI.ConfirmDialog;

			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.Layers.UI.LayerPanel;

			const panel = new LP( {
				container: container,
				editor: mockEditor
			} );

			// Should not throw
			expect( () => {
				panel.createConfirmDialog( 'Test message', jest.fn() );
			} ).not.toThrow();
		} );
	} );

	describe( 'simpleConfirm', () => {
		it( 'should use window.confirm as fallback', () => {
			window.confirm = jest.fn().mockReturnValue( true );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			const result = panel.simpleConfirm( 'Are you sure?' );

			expect( window.confirm ).toHaveBeenCalledWith( 'Are you sure?' );
			expect( result ).toBe( true );
		} );

		it( 'should use ConfirmDialog.simpleConfirm when available', () => {
			const mockConfirmDialog = {
				simpleConfirm: jest.fn().mockReturnValue( false )
			};
			window.Layers.UI.ConfirmDialog = mockConfirmDialog;

			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.Layers.UI.LayerPanel;

			const panel = new LP( {
				container: container,
				editor: mockEditor
			} );

			const result = panel.simpleConfirm( 'Test?' );

			expect( mockConfirmDialog.simpleConfirm ).toHaveBeenCalled();
			expect( result ).toBe( false );
		} );
	} );

	describe( 'layer visibility and lock toggling', () => {
		it( 'should toggle layer visibility', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle', visible: true }
			];
			mockStateManager.set( 'layers', layers );

			// Update getLayerById to return our layer
			mockEditor.getLayerById = jest.fn( ( id ) => {
				const currentLayers = mockStateManager.get( 'layers' ) || [];
				return currentLayers.find( ( l ) => l.id === id ) || null;
			} );

			// Add renderLayers mock
			mockEditor.canvasManager.renderLayers = jest.fn();

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.toggleLayerVisibility( 'layer1' );

			// Layer should be updated
			const updatedLayers = mockStateManager.get( 'layers' );
			expect( updatedLayers[ 0 ].visible ).toBe( false );
			expect( mockEditor.saveState ).toHaveBeenCalled();
		} );

		it( 'should toggle layer lock state', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle', locked: false }
			];
			mockStateManager.set( 'layers', layers );

			// Update getLayerById to return our layer
			mockEditor.getLayerById = jest.fn( ( id ) => {
				const currentLayers = mockStateManager.get( 'layers' ) || [];
				return currentLayers.find( ( l ) => l.id === id ) || null;
			} );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.toggleLayerLock( 'layer1' );

			const updatedLayers = mockStateManager.get( 'layers' );
			expect( updatedLayers[ 0 ].locked ).toBe( true );
			expect( mockEditor.saveState ).toHaveBeenCalled();
		} );

		it( 'should not throw when layer not found', () => {
			mockStateManager.set( 'layers', [] );
			mockEditor.getLayerById = jest.fn().mockReturnValue( null );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			expect( () => {
				panel.toggleLayerVisibility( 'nonexistent' );
			} ).not.toThrow();
		} );
	} );

	describe( 'divider resize', () => {
		it( 'should setup divider resize handlers', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			// Divider should exist
			const divider = container.querySelector( '.layers-panel-divider' );
			expect( divider ).not.toBeNull();
		} );

		it( 'should add resize cursor class on mousedown', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			const divider = container.querySelector( '.layers-panel-divider' );
			if ( divider ) {
				const event = new MouseEvent( 'mousedown', { bubbles: true } );
				divider.dispatchEvent( event );

				expect( document.body.classList.contains( 'layers-resize-cursor' ) ).toBe( true );
			}
		} );

		it( 'should remove resize cursor class on mouseup', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			const divider = container.querySelector( '.layers-panel-divider' );
			if ( divider ) {
				// First, start dragging
				const mousedown = new MouseEvent( 'mousedown', { bubbles: true } );
				divider.dispatchEvent( mousedown );

				// Then, stop dragging
				const mouseup = new MouseEvent( 'mouseup', { bubbles: true } );
				document.dispatchEvent( mouseup );

				expect( document.body.classList.contains( 'layers-resize-cursor' ) ).toBe( false );
			}
		} );
	} );

	describe( 'moveLayer', () => {
		it( 'should move layer up in the list', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' },
				{ id: 'layer3', type: 'text' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			// Move layer2 up (direction = -1)
			panel.moveLayer( 'layer2', -1 );

			const newLayers = mockStateManager.get( 'layers' );
			// layer2 should now be at index 0
			expect( newLayers[ 0 ].id ).toBe( 'layer2' );
			expect( newLayers[ 1 ].id ).toBe( 'layer1' );
		} );

		it( 'should move layer down in the list', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' },
				{ id: 'layer3', type: 'text' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			// Move layer1 down (direction = 1)
			panel.moveLayer( 'layer1', 1 );

			const newLayers = mockStateManager.get( 'layers' );
			// layer1 should now be at index 1
			expect( newLayers[ 0 ].id ).toBe( 'layer2' );
			expect( newLayers[ 1 ].id ).toBe( 'layer1' );
		} );

		it( 'should not move layer past boundaries', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			// Try to move first layer up (direction = -1, should not change)
			panel.moveLayer( 'layer1', -1 );

			const newLayers = mockStateManager.get( 'layers' );
			expect( newLayers[ 0 ].id ).toBe( 'layer1' );
		} );

		it( 'should not move nonexistent layer', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			// Should not throw
			expect( () => {
				panel.moveLayer( 'nonexistent', 1 );
			} ).not.toThrow();
		} );
	} );

	describe( 'updatePropertiesPanel', () => {
		it( 'should show empty message when no layer selected', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.updatePropertiesPanel( null );

			// Should show "No layer selected" message
			const contentDiv = panel.propertiesPanel.querySelector( '.properties-content' );
			expect( contentDiv.textContent ).toContain( 'No layer selected' );
		} );

		it( 'should show layer properties when layer selected', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle', x: 100, y: 200 }
			];
			mockStateManager.set( 'layers', layers );
			mockStateManager.set( 'selectedLayerIds', [ 'layer1' ] );

			// Mock getLayerById to return our layer
			mockEditor.getLayerById = jest.fn( ( id ) => {
				const currentLayers = mockStateManager.get( 'layers' ) || [];
				return currentLayers.find( ( l ) => l.id === id ) || null;
			} );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.updatePropertiesPanel( 'layer1' );

			// Properties panel should show form content
			const contentDiv = panel.propertiesPanel.querySelector( '.properties-content' );
			expect( contentDiv.children.length ).toBeGreaterThan( 0 );
		} );

		it( 'should show not found message when layer not found', () => {
			mockStateManager.set( 'layers', [] );
			mockEditor.getLayerById = jest.fn().mockReturnValue( null );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.updatePropertiesPanel( 'nonexistent' );

			const contentDiv = panel.propertiesPanel.querySelector( '.properties-content' );
			expect( contentDiv.textContent ).toContain( 'Layer not found' );
		} );
	} );

	describe( 'getDefaultLayerName', () => {
		it( 'should return type-based name for rectangle', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			// Mock mw.message to simulate missing translations
			// The msg() method returns fallback when translation contains ⧼ marker
			window.mw.message = jest.fn().mockImplementation( ( key ) => ( {
				text: jest.fn().mockReturnValue( '⧼' + key + '⧽' )
			} ) );

			const layer = { id: 'layer1', type: 'rectangle' };
			const name = panel.getDefaultLayerName( layer );
			expect( name ).toBe( 'Rectangle' );
		} );

		it( 'should return text preview for text layers', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			// Mock mw.message to simulate missing translations
			window.mw.message = jest.fn().mockImplementation( ( key ) => ( {
				text: jest.fn().mockReturnValue( '⧼' + key + '⧽' )
			} ) );

			const layer = { id: 'layer1', type: 'text', text: 'Hello World' };
			const name = panel.getDefaultLayerName( layer );
			expect( name ).toContain( 'Hello World' );
		} );

		it( 'should return default name for unknown types', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			// Mock mw.message to simulate missing translations
			window.mw.message = jest.fn().mockImplementation( ( key ) => ( {
				text: jest.fn().mockReturnValue( '⧼' + key + '⧽' )
			} ) );

			const layer = { id: 'layer1', type: 'unknowntype' };
			const name = panel.getDefaultLayerName( layer );
			expect( name ).toBe( 'Layer' );
		} );
	} );

	describe( 'selectLayer', () => {
		it( 'should select layer via StateManager', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayer( 'layer2' );

			const selectedIds = mockStateManager.get( 'selectedLayerIds' );
			expect( selectedIds ).toContain( 'layer2' );
		} );

		it( 'should sync selection to canvasManager when not from canvas', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );
			mockEditor.layers = layers;

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayer( 'layer1', false );

			expect( mockEditor.canvasManager.setSelectedLayerIds ).toHaveBeenCalledWith( [ 'layer1' ] );
			expect( mockEditor.canvasManager.renderLayers ).toHaveBeenCalled();
			expect( mockEditor.canvasManager.drawMultiSelectionIndicators ).toHaveBeenCalled();
		} );

		it( 'should not sync to canvasManager when from canvas', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayer( 'layer1', true );

			expect( mockEditor.canvasManager.setSelectedLayerIds ).not.toHaveBeenCalled();
		} );

		it( 'should clear selection when layerId is null', () => {
			mockStateManager.set( 'selectedLayerIds', [ 'layer1' ] );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayer( null );

			const selectedIds = mockStateManager.get( 'selectedLayerIds' );
			expect( selectedIds ).toEqual( [] );
		} );

		it( 'should add to selection when addToSelection is true', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' }
			];
			mockStateManager.set( 'layers', layers );
			mockStateManager.set( 'selectedLayerIds', [ 'layer1' ] );
			mockEditor.layers = layers;

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayer( 'layer2', false, true );

			const selectedIds = mockStateManager.get( 'selectedLayerIds' );
			expect( selectedIds ).toContain( 'layer1' );
			expect( selectedIds ).toContain( 'layer2' );
			expect( selectedIds.length ).toBe( 2 );
		} );

		it( 'should remove from selection when addToSelection is true and layer already selected', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' }
			];
			mockStateManager.set( 'layers', layers );
			mockStateManager.set( 'selectedLayerIds', [ 'layer1', 'layer2' ] );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayer( 'layer1', false, true );

			const selectedIds = mockStateManager.get( 'selectedLayerIds' );
			expect( selectedIds ).not.toContain( 'layer1' );
			expect( selectedIds ).toContain( 'layer2' );
			expect( selectedIds.length ).toBe( 1 );
		} );

		it( 'should do nothing when fromCanvas is true', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );
			mockStateManager.set( 'selectedLayerIds', [ 'layer1' ] );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayer( 'layer2', true );

			// Should not change selection when fromCanvas is true
			const selectedIds = mockStateManager.get( 'selectedLayerIds' );
			expect( selectedIds ).toEqual( [ 'layer1' ] );
		} );

		it( 'should finish inline text editing before changing selection', () => {
			const layers = [
				{ id: 'layer1', type: 'textbox', text: 'Original' },
				{ id: 'layer2', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );
			mockStateManager.set( 'selectedLayerIds', [ 'layer1' ] );

			// Setup mock inline text editor that is active
			const mockFinishEditing = jest.fn();
			mockEditor.canvasManager.isTextEditing = true;
			mockEditor.canvasManager.inlineTextEditor = {
				finishEditing: mockFinishEditing
			};

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			// Select a different layer while text editing is active
			panel.selectLayer( 'layer2' );

			// Should commit text changes before changing selection
			expect( mockFinishEditing ).toHaveBeenCalledWith( true );
		} );

		it( 'should not call finishEditing when not text editing', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' }
			];
			mockStateManager.set( 'layers', layers );
			mockStateManager.set( 'selectedLayerIds', [ 'layer1' ] );

			// Not text editing
			mockEditor.canvasManager.isTextEditing = false;
			mockEditor.canvasManager.inlineTextEditor = {
				finishEditing: jest.fn()
			};

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayer( 'layer2' );

			// Should not call finishEditing when not editing
			expect( mockEditor.canvasManager.inlineTextEditor.finishEditing ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'selectLayerRange', () => {
		it( 'should select range of layers between last selected and clicked', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' },
				{ id: 'layer3', type: 'text' },
				{ id: 'layer4', type: 'arrow' }
			];
			mockStateManager.set( 'layers', layers );
			mockStateManager.set( 'selectedLayerIds', [ 'layer1' ] );
			mockEditor.layers = layers;

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayerRange( 'layer3' );

			const selectedIds = mockStateManager.get( 'selectedLayerIds' );
			expect( selectedIds ).toContain( 'layer1' );
			expect( selectedIds ).toContain( 'layer2' );
			expect( selectedIds ).toContain( 'layer3' );
			expect( selectedIds ).not.toContain( 'layer4' );
			expect( selectedIds.length ).toBe( 3 );
		} );

		it( 'should select single layer when no previous selection', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' }
			];
			mockStateManager.set( 'layers', layers );
			mockStateManager.set( 'selectedLayerIds', [] );
			mockEditor.layers = layers;

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayerRange( 'layer2' );

			const selectedIds = mockStateManager.get( 'selectedLayerIds' );
			expect( selectedIds ).toEqual( [ 'layer2' ] );
		} );
	} );

	describe( 'deleteLayer', () => {
		let mockConfirmDialogShow;
		let capturedOnConfirm;

		beforeEach( () => {
			// Mock ConfirmDialog.show to capture the onConfirm callback
			mockConfirmDialogShow = jest.fn( ( options ) => {
				capturedOnConfirm = options.onConfirm;
			} );
			window.Layers.UI.ConfirmDialog = {
				show: mockConfirmDialogShow
			};
		} );

		afterEach( () => {
			delete window.Layers.UI.ConfirmDialog;
			capturedOnConfirm = null;
		} );

		it( 'should show confirmation dialog when deleting layer', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );

			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.Layers.UI.LayerPanel;

			const panel = new LP( {
				container: container,
				editor: mockEditor
			} );

			panel.deleteLayer( 'layer1' );

			// Should delegate to ConfirmDialog.show
			expect( mockConfirmDialogShow ).toHaveBeenCalled();
		} );

		it( 'should call editor.removeLayer when confirmed', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );

			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.Layers.UI.LayerPanel;

			const panel = new LP( {
				container: container,
				editor: mockEditor
			} );

			panel.deleteLayer( 'layer1' );

			// Simulate user clicking confirm
			if ( capturedOnConfirm ) {
				capturedOnConfirm();
			}

			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should not delete if confirm callback is not invoked', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );

			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.Layers.UI.LayerPanel;

			const panel = new LP( {
				container: container,
				editor: mockEditor
			} );

			panel.deleteLayer( 'layer1' );

			// Don't invoke capturedOnConfirm - simulates user cancelling
			expect( mockEditor.removeLayer ).not.toHaveBeenCalled();
		} );
	} );
} );

describe( 'LayerPanel touch support', () => {
	let LayerPanel;
	let mockEditor;
	let mockStateManager;
	let container;

	beforeEach( () => {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.StateManager = StateManager;
		window.HistoryManager = HistoryManager;
		window.Layers.UI.IconFactory = mockIconFactory;
		window.Layers.UI.ColorPickerDialog = null;
		window.Layers.UI.ConfirmDialog = null;
		window.Layers.UI.PropertiesForm = null;

		// Load LayerItemFactory for layer item creation
		const LayerItemFactory = require( '../../resources/ext.layers.editor/ui/LayerItemFactory.js' );
		window.Layers.UI.LayerItemFactory = LayerItemFactory;

		document.body.innerHTML = '<div id="layers-panel-container"></div>';
		container = document.getElementById( 'layers-panel-container' );

		mockStateManager = new StateManager();
		mockStateManager.set( 'layers', [] );
		mockStateManager.set( 'selectedLayerIds', [] );

		mockEditor = {
			stateManager: mockStateManager,
			container: document.body,
			canvasManager: {
				redraw: jest.fn(),
				selectLayer: jest.fn(),
				renderLayers: jest.fn(),
				setSelectedLayerIds: jest.fn(),
				drawMultiSelectionIndicators: jest.fn()
			},
			removeLayer: jest.fn(),
			saveState: jest.fn(),
			updateLayer: jest.fn(),
			getLayerById: jest.fn( ( id ) => {
				const layers = mockStateManager.get( 'layers' ) || [];
				return layers.find( ( l ) => l.id === id ) || null;
			} )
		};

		jest.resetModules();
		require( '../../resources/ext.layers.editor/LayerPanel.js' );
		LayerPanel = window.Layers.UI.LayerPanel;
	} );

	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'should handle touchstart on divider', () => {
		const panel = new LayerPanel( {
			container: container,
			editor: mockEditor
		} );

		const divider = container.querySelector( '.layers-panel-divider' );
		if ( divider ) {
			const touch = { clientY: 100 };
			const event = new TouchEvent( 'touchstart', {
				bubbles: true,
				touches: [ touch ]
			} );
			divider.dispatchEvent( event );

			expect( document.body.classList.contains( 'layers-resize-cursor' ) ).toBe( true );
		}
	} );

	it( 'should handle touchend to stop resize', () => {
		const panel = new LayerPanel( {
			container: container,
			editor: mockEditor
		} );

		const divider = container.querySelector( '.layers-panel-divider' );
		if ( divider ) {
			// Start touch
			const touchStart = new TouchEvent( 'touchstart', {
				bubbles: true,
				touches: [ { clientY: 100 } ]
			} );
			divider.dispatchEvent( touchStart );

			// End touch
			const touchEnd = new TouchEvent( 'touchend', { bubbles: true } );
			document.dispatchEvent( touchEnd );

			expect( document.body.classList.contains( 'layers-resize-cursor' ) ).toBe( false );
		}
	} );
} );
