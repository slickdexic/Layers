/**
 * StateManager Unit Tests
 *
 * Tests for the central state management system with race condition prevention.
 *
 * @jest-environment jsdom
 */

'use strict';

// Mock mw global before requiring module
global.mw = {
	log: {
		warn: jest.fn(),
		error: jest.fn()
	}
};

const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );

describe( 'StateManager', () => {
	let stateManager;
	let mockEditor;

	beforeEach( () => {
		jest.clearAllMocks();
		jest.useFakeTimers();

		mockEditor = {
			renderLayers: jest.fn(),
			markDirty: jest.fn(),
			layerPanel: {
				updateLayerList: jest.fn()
			}
		};

		stateManager = new StateManager( mockEditor );
	} );

	afterEach( () => {
		if ( stateManager && stateManager.destroy ) {
			stateManager.destroy();
		}
		jest.useRealTimers();
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default state', () => {
			expect( stateManager.state ).toBeDefined();
			expect( stateManager.state.isDirty ).toBe( false );
			expect( stateManager.state.currentTool ).toBe( 'pointer' );
			expect( stateManager.state.layers ).toEqual( [] );
			expect( stateManager.state.selectedLayerIds ).toEqual( [] );
		} );

		it( 'should store editor reference', () => {
			expect( stateManager.editor ).toBe( mockEditor );
		} );

		it( 'should initialize listeners as empty object', () => {
			expect( stateManager.listeners ).toEqual( {} );
		} );

		it( 'should not be locked initially', () => {
			expect( stateManager.isLocked ).toBe( false );
		} );

		it( 'should have empty history (disabled - HistoryManager handles undo/redo)', () => {
			// StateManager's internal history is now disabled for performance.
			// LayersEditor.undo() uses HistoryManager, not StateManager.
			expect( stateManager.state.history.length ).toBe( 0 );
			expect( stateManager.state.historyIndex ).toBe( -1 );
		} );
	} );

	describe( 'getState', () => {
		it( 'should return a copy of the state', () => {
			const state = stateManager.getState();
			expect( state ).toEqual( stateManager.state );
			expect( state ).not.toBe( stateManager.state );
		} );
	} );

	describe( 'get', () => {
		it( 'should return state property value', () => {
			stateManager.state.currentTool = 'rectangle';
			expect( stateManager.get( 'currentTool' ) ).toBe( 'rectangle' );
		} );

		it( 'should return undefined for non-existent key', () => {
			expect( stateManager.get( 'nonExistent' ) ).toBeUndefined();
		} );
	} );

	describe( 'set', () => {
		it( 'should set state property', () => {
			stateManager.set( 'currentTool', 'circle' );
			expect( stateManager.state.currentTool ).toBe( 'circle' );
		} );

		it( 'should notify listeners on change', () => {
			const listener = jest.fn();
			stateManager.subscribe( 'currentTool', listener );

			stateManager.set( 'currentTool', 'text' );

			expect( listener ).toHaveBeenCalledWith( 'text', 'pointer', 'currentTool' );
		} );

		it( 'should queue operation if state is locked', () => {
			stateManager.lockState();
			stateManager.set( 'currentTool', 'arrow' );

			// Value should not be changed yet
			expect( stateManager.state.currentTool ).toBe( 'pointer' );
			expect( stateManager.pendingOperations.length ).toBe( 1 );

			stateManager.unlockState();

			// Now it should be changed
			expect( stateManager.state.currentTool ).toBe( 'arrow' );
		} );
	} );

	describe( 'update', () => {
		it( 'should update multiple properties', () => {
			stateManager.update( {
				currentTool: 'rectangle',
				zoom: 2.0
			} );

			expect( stateManager.state.currentTool ).toBe( 'rectangle' );
			expect( stateManager.state.zoom ).toBe( 2.0 );
		} );

		it( 'should only notify listeners for changed values', () => {
			const toolListener = jest.fn();
			const zoomListener = jest.fn();
			stateManager.subscribe( 'currentTool', toolListener );
			stateManager.subscribe( 'zoom', zoomListener );

			stateManager.update( {
				currentTool: 'pointer', // Same value
				zoom: 2.0 // Different value
			} );

			expect( toolListener ).not.toHaveBeenCalled();
			expect( zoomListener ).toHaveBeenCalled();
		} );

		it( 'should queue operation if state is locked', () => {
			stateManager.lockState();
			stateManager.update( { zoom: 3.0 } );

			expect( stateManager.state.zoom ).toBe( 1.0 );
			expect( stateManager.pendingOperations.length ).toBe( 1 );
		} );
	} );

	describe( 'atomic', () => {
		it( 'should apply update function atomically', () => {
			stateManager.atomic( ( state ) => ( {
				zoom: state.zoom * 2,
				panX: 100
			} ) );

			expect( stateManager.state.zoom ).toBe( 2.0 );
			expect( stateManager.state.panX ).toBe( 100 );
		} );

		it( 'should throw if updateFunction is not a function', () => {
			expect( () => {
				stateManager.atomic( 'not a function' );
			} ).toThrow( 'Atomic update requires a function' );
		} );

		it( 'should notify listeners for changed keys', () => {
			const listener = jest.fn();
			stateManager.subscribe( 'zoom', listener );

			stateManager.atomic( () => ( { zoom: 5.0 } ) );

			expect( listener ).toHaveBeenCalledWith( 5.0, 1.0, 'zoom' );
		} );

		it( 'should handle null return from update function', () => {
			expect( () => {
				stateManager.atomic( () => null );
			} ).not.toThrow();
		} );
	} );

	describe( 'lockState / unlockState', () => {
		it( 'should lock state', () => {
			stateManager.lockState();
			expect( stateManager.isLocked ).toBe( true );
		} );

		it( 'should clear previous lockTimeout when locking again', () => {
			stateManager.lockState();
			const firstTimeout = stateManager.lockTimeout;
			expect( firstTimeout ).toBeDefined();

			// Lock again (should clear the first timeout)
			stateManager.lockState();
			expect( stateManager.isLocked ).toBe( true );
			// A new timeout should be set
			expect( stateManager.lockTimeout ).toBeDefined();
		} );

		it( 'should unlock state', () => {
			stateManager.lockState();
			stateManager.unlockState();
			expect( stateManager.isLocked ).toBe( false );
		} );

		it( 'should process pending operations on unlock', () => {
			stateManager.lockState();
			stateManager.set( 'zoom', 4.0 );
			stateManager.set( 'panX', 50 );

			expect( stateManager.pendingOperations.length ).toBe( 2 );

			stateManager.unlockState();

			expect( stateManager.state.zoom ).toBe( 4.0 );
			expect( stateManager.state.panX ).toBe( 50 );
			expect( stateManager.pendingOperations.length ).toBe( 0 );
		} );

		it( 'should process pending update operations on unlock', () => {
			stateManager.lockState();
			stateManager.update( { zoom: 5.0, panY: 100 } );

			expect( stateManager.pendingOperations.length ).toBe( 1 );
			expect( stateManager.pendingOperations[ 0 ].type ).toBe( 'update' );

			stateManager.unlockState();

			expect( stateManager.state.zoom ).toBe( 5.0 );
			expect( stateManager.state.panY ).toBe( 100 );
			expect( stateManager.pendingOperations.length ).toBe( 0 );
		} );

		it( 'should detect stuck lock after 5s and log warning', () => {
			stateManager.lockState();
			expect( stateManager.isLocked ).toBe( true );

			// Fast-forward 5 seconds - detection timeout
			jest.advanceTimersByTime( 5000 );

			// State should REMAIN locked (not auto-recovered yet)
			expect( stateManager.isLocked ).toBe( true );
			// Should log a warning about the stuck lock
			expect( mw.log.warn ).toHaveBeenCalledWith(
				'[StateManager] Lock held for >5s - monitoring for deadlock.'
			);
			// Should set a flag indicating when the lock got stuck
			expect( stateManager.lockStuckSince ).toBeDefined();
			expect( typeof stateManager.lockStuckSince ).toBe( 'number' );
		} );

		it( 'should auto-recover stuck lock after 30s', () => {
			stateManager.lockState();
			expect( stateManager.isLocked ).toBe( true );

			// Fast-forward 30 seconds - auto-recovery timeout
			jest.advanceTimersByTime( 30000 );

			// State should be auto-unlocked
			expect( stateManager.isLocked ).toBe( false );
			// Should log error about forced recovery
			expect( mw.log.error ).toHaveBeenCalledWith(
				'[StateManager] Lock held for >30s - forcing unlock to recover. Some state may be inconsistent.'
			);
		} );

		it( 'should expose forceUnlock for manual recovery', () => {
			stateManager.lockState();
			expect( stateManager.isLocked ).toBe( true );

			stateManager.forceUnlock();

			expect( stateManager.isLocked ).toBe( false );
			expect( mw.log.warn ).toHaveBeenCalledWith(
				'[StateManager] Force unlock triggered (manual), 0 pending operations'
			);
		} );

		it( 'should clear lock timeout on normal unlock', () => {
			stateManager.lockState();
			stateManager.unlockState();

			// Fast-forward 5 seconds - should not trigger warning
			jest.advanceTimersByTime( 5000 );

			expect( mw.log.warn ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'subscribe', () => {
		it( 'should register listener and return unsubscribe function', () => {
			const listener = jest.fn();
			const unsubscribe = stateManager.subscribe( 'zoom', listener );

			expect( stateManager.listeners.zoom ).toContain( listener );
			expect( typeof unsubscribe ).toBe( 'function' );
		} );

		it( 'should remove listener when unsubscribe is called', () => {
			const listener = jest.fn();
			const unsubscribe = stateManager.subscribe( 'zoom', listener );
			unsubscribe();

			expect( stateManager.listeners.zoom ).not.toContain( listener );
		} );
	} );

	describe( 'notifyListeners', () => {
		it( 'should call all listeners for a key', () => {
			const listener1 = jest.fn();
			const listener2 = jest.fn();
			stateManager.subscribe( 'zoom', listener1 );
			stateManager.subscribe( 'zoom', listener2 );

			stateManager.notifyListeners( 'zoom', 2.0, 1.0 );

			expect( listener1 ).toHaveBeenCalledWith( 2.0, 1.0, 'zoom' );
			expect( listener2 ).toHaveBeenCalledWith( 2.0, 1.0, 'zoom' );
		} );

		it( 'should not throw if no listeners for key', () => {
			expect( () => {
				stateManager.notifyListeners( 'nonExistent', 'new', 'old' );
			} ).not.toThrow();
		} );

		it( 'should call global listeners', () => {
			const globalListener = jest.fn();
			stateManager.subscribe( '*', globalListener );

			stateManager.notifyListeners( 'zoom', 2.0, 1.0 );

			expect( globalListener ).toHaveBeenCalledWith( 'zoom', 2.0, 1.0 );
		} );

		it( 'should catch and log listener errors', () => {
			const errorListener = jest.fn( () => {
				throw new Error( 'Test error' );
			} );
			stateManager.subscribe( 'zoom', errorListener );

			expect( () => {
				stateManager.notifyListeners( 'zoom', 2.0, 1.0 );
			} ).not.toThrow();

			expect( mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should catch and log global listener errors', () => {
			mw.log.error.mockClear();
			const errorListener = jest.fn( () => {
				throw new Error( 'Global listener error' );
			} );
			stateManager.subscribe( '*', errorListener );

			expect( () => {
				stateManager.notifyListeners( 'zoom', 2.0, 1.0 );
			} ).not.toThrow();

			expect( mw.log.error ).toHaveBeenCalledWith( 'Global state listener error:', 'Global listener error' );
		} );

		it( 'should handle global listener errors without message', () => {
			mw.log.error.mockClear();
			const errorListener = jest.fn( () => {
				throw {};  // Error without message property
			} );
			stateManager.subscribe( '*', errorListener );

			expect( () => {
				stateManager.notifyListeners( 'zoom', 2.0, 1.0 );
			} ).not.toThrow();

			expect( mw.log.error ).toHaveBeenCalledWith( 'Global state listener error:', 'Unknown error' );
		} );
	} );

	describe( 'layer operations', () => {
		describe( 'addLayer', () => {
			it( 'should add layer to layers array', () => {
				const layer = { id: 'layer1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
				stateManager.addLayer( layer );

				expect( stateManager.state.layers.find( l => l.id === 'layer1' ) ).toBeDefined();
			} );

			it( 'should generate id if not provided', () => {
				const layer = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
				const addedLayer = stateManager.addLayer( layer );

				expect( addedLayer.id ).toBeDefined();
				expect( addedLayer.id ).toMatch( /^layer_/ );
			} );

			it( 'should mark state as dirty', () => {
				const layer = { id: 'layer1', type: 'rectangle' };
				stateManager.addLayer( layer );

				expect( stateManager.state.isDirty ).toBe( true );
			} );

			it( 'should return the added layer', () => {
				const layer = { id: 'layer1', type: 'rectangle' };
				const result = stateManager.addLayer( layer );

				expect( result.id ).toBe( 'layer1' );
			} );

			it( 'should set visible to true by default', () => {
				const layer = { id: 'layer1', type: 'rectangle' };
				const result = stateManager.addLayer( layer );

				expect( result.visible ).toBe( true );
			} );
		} );

		describe( 'removeLayer', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.addLayer( { id: 'layer2', type: 'circle' } );
			} );

			it( 'should remove layer by id', () => {
				stateManager.removeLayer( 'layer1' );

				expect( stateManager.state.layers.find( l => l.id === 'layer1' ) ).toBeUndefined();
			} );

			it( 'should do nothing if layer not found', () => {
				const layerCount = stateManager.state.layers.length;
				stateManager.removeLayer( 'nonExistent' );

				expect( stateManager.state.layers.length ).toBe( layerCount );
			} );

			it( 'should also remove from selectedLayerIds', () => {
				stateManager.state.selectedLayerIds = [ 'layer1', 'layer2' ];
				stateManager.removeLayer( 'layer1' );

				expect( stateManager.state.selectedLayerIds ).not.toContain( 'layer1' );
			} );
		} );

		describe( 'updateLayer', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 } );
			} );

			it( 'should update layer properties', () => {
				stateManager.updateLayer( 'layer1', { x: 50, y: 50 } );

				const layer = stateManager.getLayer( 'layer1' );
				expect( layer.x ).toBe( 50 );
				expect( layer.y ).toBe( 50 );
			} );

			it( 'should preserve existing properties', () => {
				stateManager.updateLayer( 'layer1', { x: 50 } );

				const layer = stateManager.getLayer( 'layer1' );
				expect( layer.width ).toBe( 100 );
			} );

			it( 'should do nothing if layer not found', () => {
				expect( () => {
					stateManager.updateLayer( 'nonExistent', { x: 50 } );
				} ).not.toThrow();
			} );
		} );

		describe( 'getLayer', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.addLayer( { id: 'layer2', type: 'circle' } );
			} );

			it( 'should return layer by id', () => {
				const layer = stateManager.getLayer( 'layer1' );

				expect( layer.id ).toBe( 'layer1' );
			} );

			it( 'should return undefined if not found', () => {
				const layer = stateManager.getLayer( 'nonExistent' );

				expect( layer ).toBeUndefined();
			} );
		} );

		describe( 'reorderLayer', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.addLayer( { id: 'layer2', type: 'circle' } );
				stateManager.addLayer( { id: 'layer3', type: 'text' } );
				// Note: addLayer uses unshift, so order is [layer3, layer2, layer1]
			} );

			it( 'should move layer to target position (before target)', () => {
				// Initial order: [layer3, layer2, layer1]
				// Reorder layer3 to be before layer1
				const initialLayers = stateManager.getLayers();
				expect( initialLayers[ 0 ].id ).toBe( 'layer3' );

				stateManager.reorderLayer( 'layer3', 'layer1' );

				const layers = stateManager.getLayers();
				// layer3 was removed from index 0, then inserted before layer1
				// After removal: [layer2, layer1], layer1 is at index 1
				// Insert before layer1 at index 1: [layer2, layer3, layer1]
				expect( layers[ 0 ].id ).toBe( 'layer2' );
				expect( layers[ 1 ].id ).toBe( 'layer3' );
				expect( layers[ 2 ].id ).toBe( 'layer1' );
			} );

			it( 'should return true on success', () => {
				const result = stateManager.reorderLayer( 'layer1', 'layer3' );

				expect( result ).toBe( true );
			} );

			it( 'should return false if source layer not found', () => {
				const result = stateManager.reorderLayer( 'nonExistent', 'layer3' );

				expect( result ).toBe( false );
			} );

			it( 'should return false if target layer not found', () => {
				const result = stateManager.reorderLayer( 'layer1', 'nonExistent' );

				expect( result ).toBe( false );
			} );

			it( 'should return false if reordering to same position', () => {
				const result = stateManager.reorderLayer( 'layer1', 'layer1' );

				expect( result ).toBe( false );
			} );

			it( 'should insert after target when insertAfter is true', () => {
				// Initial order: [layer3, layer2, layer1]
				// Move layer3 to after layer1 (at index 2)
				stateManager.reorderLayer( 'layer3', 'layer1', true );

				const layers = stateManager.getLayers();
				// layer3 should be after layer1
				// Result: [layer2, layer1, layer3]
				expect( layers[ 0 ].id ).toBe( 'layer2' );
				expect( layers[ 1 ].id ).toBe( 'layer1' );
				expect( layers[ 2 ].id ).toBe( 'layer3' );
			} );

			it( 'should insert before target when insertAfter is false', () => {
				// Initial order: [layer3, layer2, layer1]
				// Move layer1 to before layer3 (at index 0)
				stateManager.reorderLayer( 'layer1', 'layer3', false );

				const layers = stateManager.getLayers();
				// layer1 should be before layer3
				// Result: [layer1, layer3, layer2]
				expect( layers[ 0 ].id ).toBe( 'layer1' );
				expect( layers[ 1 ].id ).toBe( 'layer3' );
				expect( layers[ 2 ].id ).toBe( 'layer2' );
			} );

			it( 'should correctly handle insertAfter when dragging from before target', () => {
				// Initial order: [layer3, layer2, layer1]
				// Move layer3 (index 0) to after layer2 (index 1)
				stateManager.reorderLayer( 'layer3', 'layer2', true );

				const layers = stateManager.getLayers();
				// After removing layer3: [layer2, layer1]
				// layer2 is now at index 0, insert after it means index 1
				// Result: [layer2, layer3, layer1]
				expect( layers[ 0 ].id ).toBe( 'layer2' );
				expect( layers[ 1 ].id ).toBe( 'layer3' );
				expect( layers[ 2 ].id ).toBe( 'layer1' );
			} );

			it( 'should correctly handle insertAfter when dragging from after target', () => {
				// Initial order: [layer3, layer2, layer1]
				// Move layer1 (index 2) to after layer3 (index 0)
				stateManager.reorderLayer( 'layer1', 'layer3', true );

				const layers = stateManager.getLayers();
				// After removing layer1: [layer3, layer2]
				// layer3 is still at index 0, insert after it means index 1
				// Result: [layer3, layer1, layer2]
				expect( layers[ 0 ].id ).toBe( 'layer3' );
				expect( layers[ 1 ].id ).toBe( 'layer1' );
				expect( layers[ 2 ].id ).toBe( 'layer2' );
			} );

			it( 'should place layer at end when insertAfter on last element', () => {
				// Initial order: [layer3, layer2, layer1]
				// Move layer3 (index 0) to after layer1 (index 2)
				stateManager.reorderLayer( 'layer3', 'layer1', true );

				const layers = stateManager.getLayers();
				// After removing layer3: [layer2, layer1]
				// layer1 is now at index 1, insert after it means index 2
				// Result: [layer2, layer1, layer3]
				expect( layers[ 0 ].id ).toBe( 'layer2' );
				expect( layers[ 1 ].id ).toBe( 'layer1' );
				expect( layers[ 2 ].id ).toBe( 'layer3' );
			} );

			it( 'should move folder with its children when folder has children', () => {
				// Clear and set up a folder with children scenario
				stateManager.state.layers = [];
				// Add layers: a folder with two children, and a target layer
				stateManager.state.layers = [
					{ id: 'target', type: 'rectangle' },
					{ id: 'child1', type: 'rectangle', parentId: 'folder1' },
					{ id: 'child2', type: 'circle', parentId: 'folder1' },
					{ id: 'folder1', type: 'group', children: [ 'child1', 'child2' ] }
				];

				// Move folder1 to before target
				stateManager.reorderLayer( 'folder1', 'target', false );

				const layers = stateManager.getLayers();
				// Folder and its children should be moved together before target
				// Result should have folder1 before target, with children following
				const folderIndex = layers.findIndex( l => l.id === 'folder1' );
				const targetIndex = layers.findIndex( l => l.id === 'target' );
				expect( folderIndex ).toBeLessThan( targetIndex );
			} );

			it( 'should move folder children in their current order', () => {
				// Clear and set up a folder with children scenario
				stateManager.state.layers = [
					{ id: 'other', type: 'text' },
					{ id: 'child1', type: 'rectangle', parentId: 'folder1' },
					{ id: 'folder1', type: 'group', children: [ 'child1', 'child2' ] },
					{ id: 'child2', type: 'circle', parentId: 'folder1' },
					{ id: 'target', type: 'arrow' }
				];

				// Move folder1 to after target
				stateManager.reorderLayer( 'folder1', 'target', true );

				const layers = stateManager.getLayers();
				// All three (folder1, child1, child2) should be after target
				const targetIndex = layers.findIndex( l => l.id === 'target' );
				const folderIndex = layers.findIndex( l => l.id === 'folder1' );
				const child1Index = layers.findIndex( l => l.id === 'child1' );
				const child2Index = layers.findIndex( l => l.id === 'child2' );

				expect( folderIndex ).toBeGreaterThan( targetIndex );
				expect( child1Index ).toBeGreaterThan( targetIndex );
				expect( child2Index ).toBeGreaterThan( targetIndex );
			} );
		} );

		describe( 'getLayers', () => {
			it( 'should return a copy of layers array', () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				const layers = stateManager.getLayers();

				expect( layers ).toEqual( stateManager.state.layers );
				expect( layers ).not.toBe( stateManager.state.layers );
			} );
		} );

		describe( 'moveLayerUp', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.addLayer( { id: 'layer2', type: 'circle' } );
				stateManager.addLayer( { id: 'layer3', type: 'text' } );
				// Order is [layer3, layer2, layer1] due to unshift
			} );

			it( 'should move layer up (toward front)', () => {
				// layer1 is at index 2, move it up to index 1
				const result = stateManager.moveLayerUp( 'layer1' );

				expect( result ).toBe( true );
				const layers = stateManager.getLayers();
				expect( layers[ 1 ].id ).toBe( 'layer1' );
			} );

			it( 'should return false if already at top', () => {
				const result = stateManager.moveLayerUp( 'layer3' );

				expect( result ).toBe( false );
			} );

			it( 'should return false if layer not found', () => {
				const result = stateManager.moveLayerUp( 'nonExistent' );

				expect( result ).toBe( false );
			} );
		} );

		describe( 'moveLayerDown', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.addLayer( { id: 'layer2', type: 'circle' } );
				stateManager.addLayer( { id: 'layer3', type: 'text' } );
				// Order is [layer3, layer2, layer1] due to unshift
			} );

			it( 'should move layer down (toward back)', () => {
				// layer3 is at index 0, move it down to index 1
				const result = stateManager.moveLayerDown( 'layer3' );

				expect( result ).toBe( true );
				const layers = stateManager.getLayers();
				expect( layers[ 1 ].id ).toBe( 'layer3' );
			} );

			it( 'should return false if already at bottom', () => {
				const result = stateManager.moveLayerDown( 'layer1' );

				expect( result ).toBe( false );
			} );

			it( 'should return false if layer not found', () => {
				const result = stateManager.moveLayerDown( 'nonExistent' );

				expect( result ).toBe( false );
			} );
		} );

		describe( 'bringToFront', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.addLayer( { id: 'layer2', type: 'circle' } );
				stateManager.addLayer( { id: 'layer3', type: 'text' } );
				// Order is [layer3, layer2, layer1]
			} );

			it( 'should move layer to front', () => {
				const result = stateManager.bringToFront( 'layer1' );

				expect( result ).toBe( true );
				const layers = stateManager.getLayers();
				expect( layers[ 0 ].id ).toBe( 'layer1' );
			} );

			it( 'should return false if already at front', () => {
				const result = stateManager.bringToFront( 'layer3' );

				expect( result ).toBe( false );
			} );

			it( 'should return false if layer not found', () => {
				const result = stateManager.bringToFront( 'nonExistent' );

				expect( result ).toBe( false );
			} );
		} );

		describe( 'sendToBack', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.addLayer( { id: 'layer2', type: 'circle' } );
				stateManager.addLayer( { id: 'layer3', type: 'text' } );
				// Order is [layer3, layer2, layer1]
			} );

			it( 'should move layer to back', () => {
				const result = stateManager.sendToBack( 'layer3' );

				expect( result ).toBe( true );
				const layers = stateManager.getLayers();
				expect( layers[ 2 ].id ).toBe( 'layer3' );
			} );

			it( 'should return false if already at back', () => {
				const result = stateManager.sendToBack( 'layer1' );

				expect( result ).toBe( false );
			} );

			it( 'should return false if layer not found', () => {
				const result = stateManager.sendToBack( 'nonExistent' );

				expect( result ).toBe( false );
			} );
		} );

		describe( 'selection operations', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.addLayer( { id: 'layer2', type: 'circle' } );
				stateManager.addLayer( { id: 'layer3', type: 'text' } );
			} );

			describe( 'selectLayer', () => {
				it( 'should select a layer', () => {
					stateManager.selectLayer( 'layer1' );

					expect( stateManager.state.selectedLayerIds ).toContain( 'layer1' );
				} );

				it( 'should replace selection when not multi-select', () => {
					stateManager.selectLayer( 'layer1' );
					stateManager.selectLayer( 'layer2' );

					expect( stateManager.state.selectedLayerIds ).toEqual( [ 'layer2' ] );
				} );

				it( 'should add to selection when multi-select', () => {
					stateManager.selectLayer( 'layer1' );
					stateManager.selectLayer( 'layer2', true );

					expect( stateManager.state.selectedLayerIds ).toContain( 'layer1' );
					expect( stateManager.state.selectedLayerIds ).toContain( 'layer2' );
				} );

				it( 'should not duplicate already selected layer', () => {
					stateManager.selectLayer( 'layer1' );
					stateManager.selectLayer( 'layer1', true );

					expect( stateManager.state.selectedLayerIds.filter( id => id === 'layer1' ).length ).toBe( 1 );
				} );
			} );

			describe( 'deselectLayer', () => {
				it( 'should deselect a layer', () => {
					stateManager.selectLayer( 'layer1' );
					stateManager.selectLayer( 'layer2', true );
					stateManager.deselectLayer( 'layer1' );

					expect( stateManager.state.selectedLayerIds ).not.toContain( 'layer1' );
					expect( stateManager.state.selectedLayerIds ).toContain( 'layer2' );
				} );

				it( 'should do nothing if layer not selected', () => {
					stateManager.selectLayer( 'layer1' );
					stateManager.deselectLayer( 'layer2' );

					expect( stateManager.state.selectedLayerIds ).toEqual( [ 'layer1' ] );
				} );
			} );

			describe( 'clearSelection', () => {
				it( 'should clear all selections', () => {
					stateManager.selectLayer( 'layer1' );
					stateManager.selectLayer( 'layer2', true );
					stateManager.clearSelection();

					expect( stateManager.state.selectedLayerIds ).toEqual( [] );
				} );

				it( 'should do nothing if already empty', () => {
					stateManager.clearSelection();

					expect( stateManager.state.selectedLayerIds ).toEqual( [] );
				} );
			} );

			describe( 'getSelectedLayers', () => {
				it( 'should return selected layer objects', () => {
					stateManager.selectLayer( 'layer1' );
					stateManager.selectLayer( 'layer2', true );
					const selectedLayers = stateManager.getSelectedLayers();

					expect( selectedLayers.length ).toBe( 2 );
					expect( selectedLayers.some( l => l.id === 'layer1' ) ).toBe( true );
					expect( selectedLayers.some( l => l.id === 'layer2' ) ).toBe( true );
				} );

				it( 'should return empty array if no selection', () => {
					const selectedLayers = stateManager.getSelectedLayers();

					expect( selectedLayers ).toEqual( [] );
				} );
			} );
		} );
	} );

	describe( 'history operations (DISABLED - HistoryManager handles undo/redo)', () => {
		// NOTE: StateManager's internal history is disabled for performance.
		// LayersEditor uses HistoryManager for undo/redo, not StateManager.
		// These tests verify that saveToHistory/undo/redo are no-ops.

		describe( 'saveToHistory', () => {
			it( 'should be a no-op (history disabled)', () => {
				stateManager.addLayer( { id: 'layer1' } );
				// addLayer calls saveToHistory but it's disabled
				expect( stateManager.state.history.length ).toBe( 0 );
			} );

			it( 'should not accumulate history entries', () => {
				stateManager.state.maxHistorySize = 3;

				for ( let i = 0; i < 5; i++ ) {
					stateManager.saveToHistory( 'action' + i );
				}

				// History stays empty because saveToHistory is disabled
				expect( stateManager.state.history.length ).toBe( 0 );
			} );
		} );

		describe( 'undo', () => {
			it( 'should not exist (CORE-6: removed dead code)', () => {
				// undo() method was removed in CORE-6 fix
				// HistoryManager handles all undo/redo functionality
				expect( typeof stateManager.undo ).toBe( 'undefined' );
			} );
		} );

		describe( 'redo', () => {
			it( 'should not exist (CORE-6: removed dead code)', () => {
				// redo() method was removed in CORE-6 fix
				// HistoryManager handles all undo/redo functionality
				expect( typeof stateManager.redo ).toBe( 'undefined' );
			} );
		} );

		describe( 'restoreState', () => {
			it( 'should not exist (CORE-6: removed dead code)', () => {
				// restoreState() method was removed in CORE-6 fix
				// HistoryManager handles all state restoration
				expect( typeof stateManager.restoreState ).toBe( 'undefined' );
			} );
		} );
	} );

	describe( 'utility methods', () => {
		describe( 'isDirty / setDirty / markDirty / markClean', () => {
			it( 'should get dirty state', () => {
				expect( stateManager.isDirty() ).toBe( false );
			} );

			it( 'should set dirty state', () => {
				stateManager.setDirty( true );
				expect( stateManager.isDirty() ).toBe( true );
			} );

			it( 'should mark dirty', () => {
				stateManager.markDirty();
				expect( stateManager.isDirty() ).toBe( true );
			} );

			it( 'should mark clean', () => {
				stateManager.setDirty( true );
				stateManager.markClean();
				expect( stateManager.isDirty() ).toBe( false );
			} );
		} );

		describe( 'generateLayerId', () => {
			it( 'should generate unique IDs', () => {
				const id1 = stateManager.generateLayerId();
				const id2 = stateManager.generateLayerId();

				expect( id1 ).not.toBe( id2 );
			} );

			it( 'should start with layer_', () => {
				const id = stateManager.generateLayerId();
				expect( id ).toMatch( /^layer_/ );
			} );
		} );

		describe( 'loadState', () => {
			it( 'should load layers from external state', () => {
				const externalState = {
					layers: [
						{ id: 'ext1', type: 'rectangle' },
						{ id: 'ext2', type: 'circle' }
					]
				};

				stateManager.loadState( externalState );

				expect( stateManager.state.layers.length ).toBe( 2 );
				expect( stateManager.state.layers[ 0 ].id ).toBe( 'ext1' );
			} );

			it( 'should load currentLayerSetId', () => {
				const externalState = {
					layers: [],
					currentLayerSetId: 42
				};

				stateManager.loadState( externalState );

				expect( stateManager.state.currentLayerSetId ).toBe( 42 );
			} );

			it( 'should load allLayerSets', () => {
				const externalState = {
					layers: [],
					allLayerSets: [ { id: 1 }, { id: 2 } ]
				};

				stateManager.loadState( externalState );

				expect( stateManager.state.allLayerSets ).toEqual( [ { id: 1 }, { id: 2 } ] );
			} );

			it( 'should mark as clean after loading', () => {
				stateManager.markDirty();
				stateManager.loadState( { layers: [] } );

				expect( stateManager.isDirty() ).toBe( false );
			} );

			it( 'should notify layers listeners', () => {
				const listener = jest.fn();
				stateManager.subscribe( 'layers', listener );

				stateManager.loadState( { layers: [ { id: 'test' } ] } );

				expect( listener ).toHaveBeenCalled();
			} );
		} );

		describe( 'exportState', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.selectLayer( 'layer1' );
				stateManager.state.currentLayerSetId = 123;
			} );

			it( 'should export layers as deep copy', () => {
				const exported = stateManager.exportState();

				expect( exported.layers.length ).toBe( 1 );
				expect( exported.layers[ 0 ].id ).toBe( 'layer1' );
				// Verify it's a copy
				expect( exported.layers ).not.toBe( stateManager.state.layers );
			} );

			it( 'should export selectedLayerIds', () => {
				const exported = stateManager.exportState();

				expect( exported.selectedLayerIds ).toContain( 'layer1' );
			} );

			it( 'should export currentLayerSetId', () => {
				const exported = stateManager.exportState();

				expect( exported.currentLayerSetId ).toBe( 123 );
			} );

			it( 'should export isDirty state', () => {
				const exported = stateManager.exportState();

				expect( exported.isDirty ).toBe( true );
			} );
		} );

		describe( 'reset', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.selectLayer( 'layer1' );
				stateManager.markDirty();
			} );

			it( 'should clear layers', () => {
				stateManager.reset();

				expect( stateManager.state.layers ).toEqual( [] );
			} );

			it( 'should clear selection', () => {
				stateManager.reset();

				expect( stateManager.state.selectedLayerIds ).toEqual( [] );
			} );

			it( 'should mark as clean', () => {
				stateManager.reset();

				expect( stateManager.isDirty() ).toBe( false );
			} );

			it( 'should notify layers listeners', () => {
				const listener = jest.fn();
				stateManager.subscribe( 'layers', listener );

				stateManager.reset();

				expect( listener ).toHaveBeenCalled();
			} );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clear listeners', () => {
			stateManager.subscribe( 'zoom', jest.fn() );
			stateManager.destroy();

			expect( stateManager.listeners ).toEqual( {} );
		} );

		it( 'should cancel any pending lock timeout', () => {
			stateManager.lockState();
			stateManager.destroy();

			// Should not throw when advancing timers
			jest.advanceTimersByTime( 10000 );
		} );

		it( 'should force unlock if locked', () => {
			stateManager.lockState();
			stateManager.destroy();

			expect( stateManager.isLocked ).toBe( false );
		} );

		it( 'should clear pending operations', () => {
			stateManager.lockState();
			stateManager.set( 'zoom', 2.0 );
			stateManager.destroy();

			expect( stateManager.pendingOperations ).toEqual( [] );
		} );
	} );

	// ============================================================
	// Additional coverage tests for uncovered branches
	// ============================================================

	describe( 'pendingOperations queue limit', () => {
		it( 'should drop oldest operation when queue is full for set()', () => {
			stateManager.lockState();

			// Fill up the queue to the limit (100)
			for ( let i = 0; i < 100; i++ ) {
				stateManager.set( 'key' + i, i );
			}

			expect( stateManager.pendingOperations.length ).toBe( 100 );
			expect( stateManager.pendingOperations[ 0 ].key ).toBe( 'key0' );

			// Add one more - should drop oldest
			stateManager.set( 'key100', 100 );

			expect( stateManager.pendingOperations.length ).toBe( 100 );
			expect( stateManager.pendingOperations[ 0 ].key ).toBe( 'key1' ); // key0 was dropped
			expect( stateManager.pendingOperations[ 99 ].key ).toBe( 'key100' );
			expect( mw.log.warn ).toHaveBeenCalledWith(
				expect.stringContaining( 'Pending operations queue full' )
			);
		} );

		it( 'should drop oldest operation when queue is full for update()', () => {
			stateManager.lockState();

			// Fill up the queue to the limit (100)
			for ( let i = 0; i < 100; i++ ) {
				stateManager.update( { [ 'key' + i ]: i } );
			}

			expect( stateManager.pendingOperations.length ).toBe( 100 );

			// Add one more - should drop oldest
			stateManager.update( { key100: 100 } );

			expect( stateManager.pendingOperations.length ).toBe( 100 );
			expect( mw.log.warn ).toHaveBeenCalledWith(
				expect.stringContaining( 'Pending operations queue full' )
			);
		} );
	} );

	describe( 'lock recovery from stuck lock', () => {
		it( 'should log recovery when re-locking while previous lock was stuck', () => {
			// Lock and trigger stuck detection
			stateManager.lockState();
			jest.advanceTimersByTime( 5000 );
			expect( stateManager.lockStuckSince ).toBeDefined();

			// Don't unlock - call lockState again while stuck (simulating reentrant lock attempt)
			// This triggers the recovery path
			stateManager.lockState();

			expect( mw.log.warn ).toHaveBeenCalledWith(
				expect.stringContaining( 'Recovered from stuck lock after' )
			);
		} );

		it( 'should clear lockStuckSince after recovery', () => {
			stateManager.lockState();
			jest.advanceTimersByTime( 5000 );
			expect( stateManager.lockStuckSince ).toBeDefined();

			stateManager.lockState();
			expect( stateManager.lockStuckSince ).toBe( null );
		} );
	} );

	describe( 'error handling in unlockState', () => {
		it( 'should continue processing operations if one throws an error', () => {
			stateManager.lockState();

			// Add operations including one that will fail
			stateManager.pendingOperations.push( { type: 'set', key: 'zoom', value: 2.0 } );
			stateManager.pendingOperations.push( { type: 'invalid', invalid: true } ); // Will be ignored
			stateManager.pendingOperations.push( { type: 'set', key: 'panX', value: 50 } );

			stateManager.unlockState();

			// First and last operations should have been applied
			expect( stateManager.state.zoom ).toBe( 2.0 );
			expect( stateManager.state.panX ).toBe( 50 );
		} );

		it( 'should log error when pending operation throws', () => {
			// Create a scenario where processing an operation causes an error
			stateManager.lockState();

			// Manually add an operation with a getter that throws
			const badOperation = {
				type: 'set',
				get key() {
					throw new Error( 'Test error' );
				},
				value: 'test'
			};
			stateManager.pendingOperations.push( badOperation );

			stateManager.unlockState();

			expect( mw.log.error ).toHaveBeenCalledWith(
				'[StateManager] Error processing pending operation:',
				expect.anything()
			);
		} );
	} );

	describe( 'error handling in forceUnlock', () => {
		it( 'should log error when forceUnlock pending operation throws', () => {
			stateManager.lockState();

			// Manually add an operation with a getter that throws
			const badOperation = {
				type: 'set',
				get key() {
					throw new Error( 'ForceUnlock test error' );
				},
				value: 'test'
			};
			stateManager.pendingOperations.push( badOperation );

			stateManager.forceUnlock( 'test' );

			expect( mw.log.error ).toHaveBeenCalledWith(
				'[StateManager] Error in forceUnlock pending operation:',
				expect.anything()
			);
		} );

		it( 'should continue processing after error in forceUnlock', () => {
			stateManager.lockState();

			// Add operations where second one throws
			stateManager.pendingOperations.push( { type: 'set', key: 'zoom', value: 3.0 } );
			stateManager.pendingOperations.push( {
				type: 'set',
				get key() {
					throw new Error( 'Test error' );
				},
				value: 'test'
			} );
			stateManager.pendingOperations.push( { type: 'set', key: 'panY', value: 100 } );

			stateManager.forceUnlock();

			expect( stateManager.state.zoom ).toBe( 3.0 );
			expect( stateManager.state.panY ).toBe( 100 );
		} );
	} );

	describe( 'subscribe unsubscribe guard', () => {
		it( 'should handle unsubscribe after destroy', () => {
			const listener = jest.fn();
			const unsubscribe = stateManager.subscribe( 'zoom', listener );

			stateManager.destroy();

			// Should not throw when unsubscribing after destroy
			expect( () => unsubscribe() ).not.toThrow();
		} );

		it( 'should handle unsubscribe when key no longer exists', () => {
			const listener = jest.fn();
			const unsubscribe = stateManager.subscribe( 'zoom', listener );

			// Manually remove the key
			delete stateManager.listeners.zoom;

			// Should not throw
			expect( () => unsubscribe() ).not.toThrow();
		} );

		it( 'should handle double unsubscribe', () => {
			const listener = jest.fn();
			const unsubscribe = stateManager.subscribe( 'zoom', listener );

			unsubscribe();
			// Second call should not throw
			expect( () => unsubscribe() ).not.toThrow();
		} );
	} );

	describe( 'updateLayer race condition guard', () => {
		it( 'should handle layer removed between check and update', () => {
			stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );

			// Mock atomic to simulate the race condition
			const originalAtomic = stateManager.atomic.bind( stateManager );
			stateManager.atomic = jest.fn( ( updater ) => {
				// Remove the layer after the initial check but before atomic executes
				stateManager.state.layers = [];
				// Now call the original which should detect layerIndex === -1
				return originalAtomic( updater );
			} );

			// This should not throw
			expect( () => stateManager.updateLayer( 'layer1', { x: 100 } ) ).not.toThrow();
		} );
	} );

	describe( 'reorderLayer target removed guard', () => {
		it( 'should handle target removed during reorder', () => {
			stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
			stateManager.addLayer( { id: 'layer2', type: 'circle' } );

			// Mock atomic to simulate the target being removed
			const originalAtomic = stateManager.atomic.bind( stateManager );
			stateManager.atomic = jest.fn( ( updater ) => {
				return originalAtomic( ( state ) => {
					// Temporarily modify the layer ids to make target not found
					const modifiedState = { ...state };
					modifiedState.layers = state.layers.map( l =>
						l.id === 'layer1' ? { ...l, id: 'changed' } : l
					);
					const result = updater( modifiedState );
					return result;
				} );
			} );

			// This should not throw - layers should still be added at the end
			expect( () => stateManager.reorderLayer( 'layer2', 'layer1', false ) ).not.toThrow();
		} );
	} );

	describe( 'generateLayerId fallback', () => {
		it( 'should use shared IdGenerator when available', () => {
			const mockGenerateLayerId = jest.fn().mockReturnValue( 'generated_123' );
			window.Layers = {
				Utils: {
					generateLayerId: mockGenerateLayerId
				}
			};

			const result = stateManager.generateLayerId();

			expect( mockGenerateLayerId ).toHaveBeenCalled();
			expect( result ).toBe( 'generated_123' );

			delete window.Layers;
		} );

		it( 'should use fallback when IdGenerator not available', () => {
			delete window.Layers;

			const result = stateManager.generateLayerId();

			expect( result ).toMatch( /^layer_\d+_\w+$/ );
		} );
	} );
} );

