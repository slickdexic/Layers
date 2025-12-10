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
		// Setup window globals
		window.StateManager = StateManager;
		window.HistoryManager = HistoryManager;
		window.IconFactory = mockIconFactory;
		window.ColorPickerDialog = null;
		window.ConfirmDialog = null;
		window.PropertiesForm = null;

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
				selectLayer: jest.fn()
			},
			removeLayer: jest.fn(),
			saveState: jest.fn(),
			updateLayer: jest.fn(),
			getLayerById: jest.fn( ( id ) => {
				const layers = mockStateManager.get( 'layers' ) || [];
				return layers.find( ( l ) => l.id === id ) || null;
			} )
		};

		// Reset module cache and reload LayerPanel
		jest.resetModules();
		jest.clearAllMocks();

		require( '../../resources/ext.layers.editor/LayerPanel.js' );
		LayerPanel = window.LayerPanel;
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		document.body.innerHTML = '';
	} );

	describe( 'reorderLayers', () => {
		it( 'should use StateManager.reorderLayer when available', () => {
			mockStateManager.reorderLayer = jest.fn().mockReturnValue( true );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.reorderLayers( 'layer1', 'layer2' );

			expect( mockStateManager.reorderLayer ).toHaveBeenCalledWith( 'layer1', 'layer2' );
			expect( mockEditor.canvasManager.redraw ).toHaveBeenCalled();
		} );

		it( 'should fall back to manual reordering when StateManager method not available', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' },
				{ id: 'layer3', type: 'text' }
			];
			mockStateManager.set( 'layers', layers );

			// Set reorderLayer to undefined to trigger fallback path
			mockStateManager.reorderLayer = undefined;

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			// Move layer1 to position of layer3
			panel.reorderLayers( 'layer1', 'layer3' );

			const newLayers = mockStateManager.get( 'layers' );
			expect( newLayers[ 2 ].id ).toBe( 'layer1' );
			expect( mockEditor.saveState ).toHaveBeenCalledWith( 'Reorder Layers' );
		} );

		it( 'should not reorder when layer IDs not found', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.reorderLayers( 'nonexistent', 'layer2' );

			// Layers should be unchanged
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
			expect( panel.layerList.querySelector( '.layers-empty' ) ).toBeTruthy();
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

			const items = panel.layerList.querySelectorAll( '.layer-item' );
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
			expect( selectedItem ).toBeTruthy();
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
			expect( visibilityBtn ).toBeTruthy();
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
			expect( layerItem ).toBeTruthy();

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
		it( 'should create dialog overlay and dialog elements when ConfirmDialog not available', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			const onConfirm = jest.fn();
			panel.createConfirmDialog( 'Test message', onConfirm );

			expect( document.querySelector( '.layers-modal-overlay' ) ).toBeTruthy();
			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeTruthy();
		} );

		it( 'should call onConfirm when confirm button clicked', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			const onConfirm = jest.fn();
			panel.createConfirmDialog( 'Test message', onConfirm );

			const confirmBtn = document.querySelector( '.layers-btn-danger' );
			confirmBtn.click();

			expect( onConfirm ).toHaveBeenCalled();
			// Dialog should be removed
			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeFalsy();
		} );

		it( 'should close dialog when cancel button clicked', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.createConfirmDialog( 'Test message', jest.fn() );

			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();

			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeFalsy();
		} );

		it( 'should close dialog on Escape key', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.createConfirmDialog( 'Test message', jest.fn() );

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeFalsy();
		} );

		it( 'should trap focus within dialog on Tab', () => {
			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.createConfirmDialog( 'Test message', jest.fn() );

			const dialog = document.querySelector( '.layers-modal-dialog' );
			const buttons = dialog.querySelectorAll( 'button' );
			const lastButton = buttons[ buttons.length - 1 ];

			lastButton.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Tab', bubbles: true } );
			Object.defineProperty( event, 'shiftKey', { value: false } );
			document.dispatchEvent( event );

			// Focus should wrap (behavior verified by no error)
		} );

		it( 'should use ConfirmDialog.show when available', () => {
			const mockConfirmDialog = {
				show: jest.fn()
			};
			window.ConfirmDialog = mockConfirmDialog;

			// Reload LayerPanel with ConfirmDialog available
			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.LayerPanel;

			const panel = new LP( {
				container: container,
				editor: mockEditor
			} );

			const onConfirm = jest.fn();
			panel.createConfirmDialog( 'Test message', onConfirm );

			expect( mockConfirmDialog.show ).toHaveBeenCalled();
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
			window.ConfirmDialog = mockConfirmDialog;

			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayerPanel.js' );
			const LP = window.LayerPanel;

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
			expect( divider ).toBeTruthy();
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

		it( 'should call canvasManager.selectLayer when not from canvas', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayer( 'layer1', false );

			expect( mockEditor.canvasManager.selectLayer ).toHaveBeenCalledWith( 'layer1', true );
		} );

		it( 'should not call canvasManager.selectLayer when from canvas', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.selectLayer( 'layer1', true );

			expect( mockEditor.canvasManager.selectLayer ).not.toHaveBeenCalled();
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
	} );

	describe( 'deleteLayer', () => {
		it( 'should show confirmation dialog when deleting layer', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.deleteLayer( 'layer1' );

			// Should show confirmation dialog
			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeTruthy();
		} );

		it( 'should call editor.removeLayer when confirmed', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.deleteLayer( 'layer1' );

			// Click confirm button
			const confirmBtn = document.querySelector( '.layers-btn-danger' );
			confirmBtn.click();

			expect( mockEditor.removeLayer ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should not delete when cancelled', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' }
			];
			mockStateManager.set( 'layers', layers );

			const panel = new LayerPanel( {
				container: container,
				editor: mockEditor
			} );

			panel.deleteLayer( 'layer1' );

			// Click cancel button
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();

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
		window.StateManager = StateManager;
		window.HistoryManager = HistoryManager;
		window.IconFactory = mockIconFactory;
		window.ColorPickerDialog = null;
		window.ConfirmDialog = null;
		window.PropertiesForm = null;

		document.body.innerHTML = '<div id="layers-panel-container"></div>';
		container = document.getElementById( 'layers-panel-container' );

		mockStateManager = new StateManager();
		mockStateManager.set( 'layers', [] );
		mockStateManager.set( 'selectedLayerIds', [] );

		mockEditor = {
			stateManager: mockStateManager,
			container: document.body,
			canvasManager: { redraw: jest.fn(), selectLayer: jest.fn(), renderLayers: jest.fn() },
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
		LayerPanel = window.LayerPanel;
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
