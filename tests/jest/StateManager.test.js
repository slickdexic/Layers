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

		it( 'should have initial history entry', () => {
			expect( stateManager.state.history.length ).toBe( 1 );
			expect( stateManager.state.historyIndex ).toBe( 0 );
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

		it( 'should force unlock after timeout', () => {
			stateManager.lockState();
			expect( stateManager.isLocked ).toBe( true );

			// Fast-forward 5 seconds
			jest.advanceTimersByTime( 5000 );

			expect( stateManager.isLocked ).toBe( false );
			expect( mw.log.warn ).toHaveBeenCalledWith(
				'[StateManager] Force unlocking state after timeout'
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

			it( 'should move layer to target position', () => {
				// Initial order: [layer3, layer2, layer1]
				// Reorder layer3 to layer1's position
				const initialLayers = stateManager.getLayers();
				expect( initialLayers[ 0 ].id ).toBe( 'layer3' );

				stateManager.reorderLayer( 'layer3', 'layer1' );

				const layers = stateManager.getLayers();
				// layer3 was removed from index 0 and inserted at index 2
				// Result: [layer2, layer1, layer3]
				expect( layers[ 0 ].id ).toBe( 'layer2' );
				expect( layers[ 2 ].id ).toBe( 'layer3' );
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

	describe( 'history operations', () => {
		describe( 'saveToHistory', () => {
			it( 'should save current state to history', () => {
				stateManager.addLayer( { id: 'layer1' } );
				// addLayer already saves to history
				expect( stateManager.state.history.length ).toBeGreaterThan( 1 );
			} );

			it( 'should limit history size', () => {
				stateManager.state.maxHistorySize = 3;

				for ( let i = 0; i < 5; i++ ) {
					stateManager.saveToHistory( 'action' + i );
				}

				expect( stateManager.state.history.length ).toBeLessThanOrEqual( 3 );
			} );
		} );

		describe( 'undo', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.addLayer( { id: 'layer2', type: 'circle' } );
			} );

			it( 'should restore previous state', () => {
				const layerCountBefore = stateManager.state.layers.length;
				stateManager.undo();

				expect( stateManager.state.layers.length ).toBeLessThan( layerCountBefore );
			} );

			it( 'should return true on success', () => {
				const result = stateManager.undo();

				expect( result ).toBe( true );
			} );

			it( 'should return false if at beginning of history', () => {
				// Undo everything
				while ( stateManager.undo() ) { /* empty */ }

				const result = stateManager.undo();
				expect( result ).toBe( false );
			} );
		} );

		describe( 'redo', () => {
			beforeEach( () => {
				stateManager.addLayer( { id: 'layer1', type: 'rectangle' } );
				stateManager.addLayer( { id: 'layer2', type: 'circle' } );
				stateManager.undo();
			} );

			it( 'should restore next state', () => {
				const layerCountBefore = stateManager.state.layers.length;
				stateManager.redo();

				expect( stateManager.state.layers.length ).toBeGreaterThan( layerCountBefore );
			} );

			it( 'should return true on success', () => {
				const result = stateManager.redo();

				expect( result ).toBe( true );
			} );

			it( 'should return false if at end of history', () => {
				stateManager.redo(); // Go to end
				const result = stateManager.redo();

				expect( result ).toBe( false );
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
} );

