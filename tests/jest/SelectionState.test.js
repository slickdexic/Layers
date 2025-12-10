/**
 * Tests for SelectionState module
 */
'use strict';

const SelectionState = require( '../../resources/ext.layers.editor/selection/SelectionState.js' );

describe( 'SelectionState', () => {
	let selectionState;
	let testLayers;
	let selectionChangeCallback;

	beforeEach( () => {
		testLayers = [
			{ id: 'layer1', type: 'rectangle', visible: true, locked: false },
			{ id: 'layer2', type: 'circle', visible: true, locked: false },
			{ id: 'layer3', type: 'text', visible: false, locked: false },
			{ id: 'layer4', type: 'arrow', visible: true, locked: true },
			{ id: 'layer5', type: 'polygon', visible: true, locked: false }
		];
		selectionChangeCallback = jest.fn();
		selectionState = new SelectionState( {
			getLayersArray: () => testLayers,
			onSelectionChange: selectionChangeCallback
		} );
	} );

	afterEach( () => {
		selectionState.destroy();
	} );

	describe( 'constructor', () => {
		it( 'should initialize with empty selection', () => {
			expect( selectionState.selectedLayerIds ).toEqual( [] );
			expect( selectionState.lastSelectedId ).toBeNull();
			expect( selectionState.multiSelectMode ).toBe( false );
		} );

		it( 'should accept empty options', () => {
			const state = new SelectionState();
			expect( state.selectedLayerIds ).toEqual( [] );
			state.destroy();
		} );
	} );

	describe( 'selectLayer', () => {
		it( 'should select a visible unlocked layer', () => {
			selectionState.selectLayer( 'layer1' );
			expect( selectionState.isSelected( 'layer1' ) ).toBe( true );
			expect( selectionState.getSelectionCount() ).toBe( 1 );
		} );

		it( 'should clear previous selection when not adding', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.selectLayer( 'layer2' );
			expect( selectionState.isSelected( 'layer1' ) ).toBe( false );
			expect( selectionState.isSelected( 'layer2' ) ).toBe( true );
		} );

		it( 'should add to selection with addToSelection=true', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.selectLayer( 'layer2', true );
			expect( selectionState.isSelected( 'layer1' ) ).toBe( true );
			expect( selectionState.isSelected( 'layer2' ) ).toBe( true );
			expect( selectionState.getSelectionCount() ).toBe( 2 );
		} );

		it( 'should toggle off when re-selecting with addToSelection', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.selectLayer( 'layer2', true );
			selectionState.selectLayer( 'layer1', true );
			expect( selectionState.isSelected( 'layer1' ) ).toBe( false );
			expect( selectionState.isSelected( 'layer2' ) ).toBe( true );
		} );

		it( 'should not select invisible layers', () => {
			selectionState.selectLayer( 'layer3' ); // invisible
			expect( selectionState.isSelected( 'layer3' ) ).toBe( false );
			expect( selectionState.getSelectionCount() ).toBe( 0 );
		} );

		it( 'should not select locked layers', () => {
			selectionState.selectLayer( 'layer4' ); // locked
			expect( selectionState.isSelected( 'layer4' ) ).toBe( false );
			expect( selectionState.getSelectionCount() ).toBe( 0 );
		} );

		it( 'should update lastSelectedId', () => {
			selectionState.selectLayer( 'layer1' );
			expect( selectionState.getLastSelectedId() ).toBe( 'layer1' );
			selectionState.selectLayer( 'layer2', true );
			expect( selectionState.getLastSelectedId() ).toBe( 'layer2' );
		} );

		it( 'should notify on selection change', () => {
			selectionState.selectLayer( 'layer1' );
			expect( selectionChangeCallback ).toHaveBeenCalled();
		} );

		it( 'should handle null layerId gracefully', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.selectLayer( null );
			// Should clear selection
			expect( selectionState.getSelectionCount() ).toBe( 0 );
		} );

		it( 'should handle non-existent layerId', () => {
			selectionState.selectLayer( 'nonexistent' );
			expect( selectionState.getSelectionCount() ).toBe( 0 );
		} );
	} );

	describe( 'deselectLayer', () => {
		it( 'should deselect a selected layer', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.selectLayer( 'layer2', true );
			selectionState.deselectLayer( 'layer1' );
			expect( selectionState.isSelected( 'layer1' ) ).toBe( false );
			expect( selectionState.isSelected( 'layer2' ) ).toBe( true );
		} );

		it( 'should update lastSelectedId when deselecting it', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.selectLayer( 'layer2', true );
			selectionState.deselectLayer( 'layer2' );
			expect( selectionState.getLastSelectedId() ).toBe( 'layer1' );
		} );

		it( 'should handle deselecting non-selected layer', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.deselectLayer( 'layer5' );
			expect( selectionState.isSelected( 'layer1' ) ).toBe( true );
		} );
	} );

	describe( 'clearSelection', () => {
		it( 'should clear all selections', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.selectLayer( 'layer2', true );
			selectionState.clearSelection();
			expect( selectionState.getSelectionCount() ).toBe( 0 );
			expect( selectionState.getLastSelectedId() ).toBeNull();
		} );

		it( 'should not notify when notify=false', () => {
			selectionState.selectLayer( 'layer1' );
			selectionChangeCallback.mockClear();
			selectionState.clearSelection( false );
			expect( selectionChangeCallback ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'selectAll', () => {
		it( 'should select all visible unlocked layers', () => {
			selectionState.selectAll();
			// layer3 is invisible, layer4 is locked
			expect( selectionState.isSelected( 'layer1' ) ).toBe( true );
			expect( selectionState.isSelected( 'layer2' ) ).toBe( true );
			expect( selectionState.isSelected( 'layer3' ) ).toBe( false );
			expect( selectionState.isSelected( 'layer4' ) ).toBe( false );
			expect( selectionState.isSelected( 'layer5' ) ).toBe( true );
			expect( selectionState.getSelectionCount() ).toBe( 3 );
		} );

		it( 'should set lastSelectedId to last layer', () => {
			selectionState.selectAll();
			expect( selectionState.getLastSelectedId() ).toBe( 'layer5' );
		} );
	} );

	describe( 'isSelected', () => {
		it( 'should return true for selected layer', () => {
			selectionState.selectLayer( 'layer1' );
			expect( selectionState.isSelected( 'layer1' ) ).toBe( true );
		} );

		it( 'should return false for non-selected layer', () => {
			expect( selectionState.isSelected( 'layer1' ) ).toBe( false );
		} );
	} );

	describe( 'getSelectionCount', () => {
		it( 'should return 0 for empty selection', () => {
			expect( selectionState.getSelectionCount() ).toBe( 0 );
		} );

		it( 'should return correct count', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.selectLayer( 'layer2', true );
			expect( selectionState.getSelectionCount() ).toBe( 2 );
		} );
	} );

	describe( 'hasSelection', () => {
		it( 'should return false when empty', () => {
			expect( selectionState.hasSelection() ).toBe( false );
		} );

		it( 'should return true when has selection', () => {
			selectionState.selectLayer( 'layer1' );
			expect( selectionState.hasSelection() ).toBe( true );
		} );
	} );

	describe( 'getSelectedIds', () => {
		it( 'should return empty array when no selection', () => {
			expect( selectionState.getSelectedIds() ).toEqual( [] );
		} );

		it( 'should return copy of selected IDs', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.selectLayer( 'layer2', true );
			const ids = selectionState.getSelectedIds();
			expect( ids ).toEqual( [ 'layer1', 'layer2' ] );
			// Verify it's a copy
			ids.push( 'layer3' );
			expect( selectionState.getSelectedIds() ).toEqual( [ 'layer1', 'layer2' ] );
		} );
	} );

	describe( 'getSelectedLayers', () => {
		it( 'should return selected layer objects', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.selectLayer( 'layer2', true );
			const layers = selectionState.getSelectedLayers();
			expect( layers ).toHaveLength( 2 );
			expect( layers[ 0 ].id ).toBe( 'layer1' );
			expect( layers[ 1 ].id ).toBe( 'layer2' );
		} );
	} );

	describe( 'setSelectedIds', () => {
		it( 'should set selected IDs directly', () => {
			selectionState.setSelectedIds( [ 'layer1', 'layer5' ] );
			expect( selectionState.isSelected( 'layer1' ) ).toBe( true );
			expect( selectionState.isSelected( 'layer5' ) ).toBe( true );
			expect( selectionState.getSelectionCount() ).toBe( 2 );
		} );

		it( 'should update lastSelectedId', () => {
			selectionState.setSelectedIds( [ 'layer1', 'layer5' ] );
			expect( selectionState.getLastSelectedId() ).toBe( 'layer5' );
		} );

		it( 'should notify by default', () => {
			selectionChangeCallback.mockClear();
			selectionState.setSelectedIds( [ 'layer1' ] );
			expect( selectionChangeCallback ).toHaveBeenCalled();
		} );

		it( 'should not notify when notify=false', () => {
			selectionChangeCallback.mockClear();
			selectionState.setSelectedIds( [ 'layer1' ], false );
			expect( selectionChangeCallback ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'getLayerById', () => {
		it( 'should return layer by ID', () => {
			const layer = selectionState.getLayerById( 'layer2' );
			expect( layer ).not.toBeNull();
			expect( layer.type ).toBe( 'circle' );
		} );

		it( 'should return null for non-existent ID', () => {
			expect( selectionState.getLayerById( 'nonexistent' ) ).toBeNull();
		} );
	} );

	describe( 'multiSelectMode', () => {
		it( 'should set and get multi-select mode', () => {
			expect( selectionState.isMultiSelectMode() ).toBe( false );
			selectionState.setMultiSelectMode( true );
			expect( selectionState.isMultiSelectMode() ).toBe( true );
		} );
	} );

	describe( 'saveState and restoreState', () => {
		it( 'should save current state', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.selectLayer( 'layer2', true );
			selectionState.setMultiSelectMode( true );
			const state = selectionState.saveState();
			expect( state.selectedLayerIds ).toEqual( [ 'layer1', 'layer2' ] );
			expect( state.lastSelectedId ).toBe( 'layer2' );
			expect( state.multiSelectMode ).toBe( true );
		} );

		it( 'should restore saved state', () => {
			const state = {
				selectedLayerIds: [ 'layer5' ],
				lastSelectedId: 'layer5',
				multiSelectMode: true
			};
			selectionState.restoreState( state );
			expect( selectionState.isSelected( 'layer5' ) ).toBe( true );
			expect( selectionState.getLastSelectedId() ).toBe( 'layer5' );
			expect( selectionState.isMultiSelectMode() ).toBe( true );
		} );

		it( 'should handle null state', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.restoreState( null, false );
			// Should not crash, selection should be cleared
			expect( selectionState.getSelectionCount() ).toBe( 1 );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up all state', () => {
			selectionState.selectLayer( 'layer1' );
			selectionState.setMultiSelectMode( true );
			selectionState.destroy();
			expect( selectionState.selectedLayerIds ).toEqual( [] );
			expect( selectionState.lastSelectedId ).toBeNull();
			expect( selectionState.multiSelectMode ).toBe( false );
		} );
	} );
} );
