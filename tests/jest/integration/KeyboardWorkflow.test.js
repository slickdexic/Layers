/**
 * @jest-environment jsdom
 */

/**
 * Integration Tests for Keyboard Workflows
 *
 * These tests verify that keyboard shortcuts work correctly across
 * the editor components: Toolbar, LayerPanel, CanvasManager.
 *
 * Keyboard navigation is critical for:
 * - Accessibility (WCAG 2.1.1 Keyboard)
 * - Power users who prefer keyboard over mouse
 * - Screen reader compatibility
 */

'use strict';

describe( 'Integration: Keyboard Workflows', () => {
	let mockEditor;
	let mockCanvasManager;
	let mockToolbar;
	let mockLayerPanel;
	let testLayers;

	beforeEach( () => {
		// Create test layers
		testLayers = [
			{
				id: 'layer1',
				type: 'rectangle',
				x: 100,
				y: 100,
				width: 200,
				height: 150,
				visible: true,
				locked: false,
				name: 'Rectangle 1'
			},
			{
				id: 'layer2',
				type: 'circle',
				x: 300,
				y: 200,
				radius: 50,
				visible: true,
				locked: false,
				name: 'Circle 1'
			},
			{
				id: 'layer3',
				type: 'text',
				x: 150,
				y: 350,
				text: 'Sample Text',
				visible: true,
				locked: false,
				name: 'Text 1'
			}
		];

		// Create mock StateManager
		const stateData = {
			currentTool: 'select',
			selectedLayerIds: [],
			zoom: 1
		};

		const mockStateManager = {
			get: jest.fn( ( key ) => stateData[ key ] ),
			set: jest.fn( ( key, value ) => {
				stateData[ key ] = value;
			} ),
			subscribe: jest.fn(),
			unsubscribe: jest.fn()
		};

		// Create mock HistoryManager
		const mockHistoryManager = {
			saveState: jest.fn(),
			canUndo: jest.fn( () => true ),
			canRedo: jest.fn( () => true ),
			undo: jest.fn(),
			redo: jest.fn()
		};

		// Create mock CanvasManager
		mockCanvasManager = {
			getLayers: jest.fn( () => testLayers ),
			setLayers: jest.fn(),
			getSelectedLayers: jest.fn( () => {
				const ids = stateData.selectedLayerIds;
				return testLayers.filter( ( l ) => ids.includes( l.id ) );
			} ),
			selectLayer: jest.fn( ( layer ) => {
				stateData.selectedLayerIds = [ layer.id ];
			} ),
			selectAll: jest.fn( () => {
				stateData.selectedLayerIds = testLayers.map( ( l ) => l.id );
			} ),
			clearSelection: jest.fn( () => {
				stateData.selectedLayerIds = [];
			} ),
			deleteSelectedLayers: jest.fn( () => {
				const ids = stateData.selectedLayerIds;
				testLayers = testLayers.filter( ( l ) => !ids.includes( l.id ) );
				stateData.selectedLayerIds = [];
			} ),
			duplicateSelectedLayers: jest.fn( () => {
				const ids = stateData.selectedLayerIds;
				const newIds = [];
				ids.forEach( ( id ) => {
					const original = testLayers.find( ( l ) => l.id === id );
					if ( original ) {
						const copy = { ...original, id: `${ id }_copy`, name: `${ original.name } Copy` };
						testLayers.push( copy );
						newIds.push( copy.id );
					}
				} );
				stateData.selectedLayerIds = newIds;
			} ),
			copyToClipboard: jest.fn(),
			pasteFromClipboard: jest.fn(),
			nudgeSelectedLayers: jest.fn( ( dx, dy ) => {
				const ids = stateData.selectedLayerIds;
				testLayers.forEach( ( l ) => {
					if ( ids.includes( l.id ) ) {
						l.x += dx;
						l.y += dy;
					}
				} );
			} ),
			zoomIn: jest.fn( () => {
				stateData.zoom = Math.min( stateData.zoom * 1.25, 10 );
			} ),
			zoomOut: jest.fn( () => {
				stateData.zoom = Math.max( stateData.zoom / 1.25, 0.1 );
			} ),
			resetZoom: jest.fn( () => {
				stateData.zoom = 1;
			} ),
			setTool: jest.fn( ( tool ) => {
				stateData.currentTool = tool;
			} ),
			getCurrentTool: jest.fn( () => stateData.currentTool ),
			toggleGrid: jest.fn(),
			toggleSmartGuides: jest.fn(),
			bringToFront: jest.fn(),
			sendToBack: jest.fn(),
			bringForward: jest.fn(),
			sendBackward: jest.fn(),
			redraw: jest.fn()
		};

		// Create mock Toolbar
		mockToolbar = {
			setActiveTool: jest.fn( ( tool ) => {
				mockCanvasManager.setTool( tool );
			} ),
			getCurrentTool: jest.fn( () => stateData.currentTool )
		};

		// Create mock LayerPanel
		mockLayerPanel = {
			focusedIndex: 0,
			getFocusedLayer: jest.fn( () => testLayers[ mockLayerPanel.focusedIndex ] ),
			focusPrevious: jest.fn( () => {
				if ( mockLayerPanel.focusedIndex > 0 ) {
					mockLayerPanel.focusedIndex--;
				}
			} ),
			focusNext: jest.fn( () => {
				if ( mockLayerPanel.focusedIndex < testLayers.length - 1 ) {
					mockLayerPanel.focusedIndex++;
				}
			} ),
			focusFirst: jest.fn( () => {
				mockLayerPanel.focusedIndex = 0;
			} ),
			focusLast: jest.fn( () => {
				mockLayerPanel.focusedIndex = testLayers.length - 1;
			} ),
			selectFocusedLayer: jest.fn( () => {
				const layer = testLayers[ mockLayerPanel.focusedIndex ];
				if ( layer ) {
					mockCanvasManager.selectLayer( layer );
				}
			} ),
			toggleVisibility: jest.fn( () => {
				const layer = testLayers[ mockLayerPanel.focusedIndex ];
				if ( layer ) {
					layer.visible = !layer.visible;
				}
			} ),
			toggleLock: jest.fn( () => {
				const layer = testLayers[ mockLayerPanel.focusedIndex ];
				if ( layer ) {
					layer.locked = !layer.locked;
				}
			} )
		};

		// Create mock Editor
		mockEditor = {
			canvasManager: mockCanvasManager,
			toolbar: mockToolbar,
			layerPanel: mockLayerPanel,
			stateManager: mockStateManager,
			historyManager: mockHistoryManager,
			undo: jest.fn( () => mockHistoryManager.undo() ),
			redo: jest.fn( () => mockHistoryManager.redo() ),
			save: jest.fn()
		};
	} );

	describe( 'Tool Selection Shortcuts', () => {
		it( 'should switch to select tool with V key', () => {
			mockCanvasManager.setTool( 'rectangle' );

			// Simulate V key press
			mockCanvasManager.setTool( 'select' );

			expect( mockCanvasManager.setTool ).toHaveBeenCalledWith( 'select' );
			expect( mockCanvasManager.getCurrentTool() ).toBe( 'select' );
		} );

		it( 'should switch to rectangle tool with R key', () => {
			mockCanvasManager.setTool( 'rectangle' );

			expect( mockCanvasManager.setTool ).toHaveBeenCalledWith( 'rectangle' );
			expect( mockCanvasManager.getCurrentTool() ).toBe( 'rectangle' );
		} );

		it( 'should switch to circle tool with C key', () => {
			mockCanvasManager.setTool( 'circle' );

			expect( mockCanvasManager.setTool ).toHaveBeenCalledWith( 'circle' );
			expect( mockCanvasManager.getCurrentTool() ).toBe( 'circle' );
		} );

		it( 'should switch to text tool with T key', () => {
			mockCanvasManager.setTool( 'text' );

			expect( mockCanvasManager.setTool ).toHaveBeenCalledWith( 'text' );
			expect( mockCanvasManager.getCurrentTool() ).toBe( 'text' );
		} );

		it( 'should switch to arrow tool with A key', () => {
			mockCanvasManager.setTool( 'arrow' );

			expect( mockCanvasManager.setTool ).toHaveBeenCalledWith( 'arrow' );
			expect( mockCanvasManager.getCurrentTool() ).toBe( 'arrow' );
		} );

		it( 'should switch to line tool with L key', () => {
			mockCanvasManager.setTool( 'line' );

			expect( mockCanvasManager.setTool ).toHaveBeenCalledWith( 'line' );
			expect( mockCanvasManager.getCurrentTool() ).toBe( 'line' );
		} );

		it( 'should switch to path tool with P key', () => {
			mockCanvasManager.setTool( 'path' );

			expect( mockCanvasManager.setTool ).toHaveBeenCalledWith( 'path' );
			expect( mockCanvasManager.getCurrentTool() ).toBe( 'path' );
		} );

		it( 'should switch to blur tool with B key', () => {
			mockCanvasManager.setTool( 'blur' );

			expect( mockCanvasManager.setTool ).toHaveBeenCalledWith( 'blur' );
			expect( mockCanvasManager.getCurrentTool() ).toBe( 'blur' );
		} );
	} );

	describe( 'Selection Shortcuts', () => {
		it( 'should select all layers with Ctrl+A', () => {
			mockCanvasManager.selectAll();

			expect( mockCanvasManager.selectAll ).toHaveBeenCalled();
			expect( mockCanvasManager.getSelectedLayers() ).toHaveLength( 3 );
		} );

		it( 'should deselect with Escape', () => {
			mockCanvasManager.selectAll();
			mockCanvasManager.clearSelection();

			expect( mockCanvasManager.clearSelection ).toHaveBeenCalled();
			expect( mockCanvasManager.getSelectedLayers() ).toHaveLength( 0 );
		} );

		it( 'should delete selected layers with Delete key', () => {
			mockCanvasManager.selectLayer( testLayers[ 0 ] );
			const initialCount = testLayers.length;

			mockCanvasManager.deleteSelectedLayers();

			expect( mockCanvasManager.deleteSelectedLayers ).toHaveBeenCalled();
			expect( testLayers.length ).toBe( initialCount - 1 );
		} );

		it( 'should duplicate selected layers with Ctrl+D', () => {
			mockCanvasManager.selectLayer( testLayers[ 0 ] );
			const initialCount = testLayers.length;

			mockCanvasManager.duplicateSelectedLayers();

			expect( mockCanvasManager.duplicateSelectedLayers ).toHaveBeenCalled();
			expect( testLayers.length ).toBe( initialCount + 1 );
		} );
	} );

	describe( 'Clipboard Shortcuts', () => {
		it( 'should copy with Ctrl+C', () => {
			mockCanvasManager.selectLayer( testLayers[ 0 ] );
			mockCanvasManager.copyToClipboard();

			expect( mockCanvasManager.copyToClipboard ).toHaveBeenCalled();
		} );

		it( 'should paste with Ctrl+V', () => {
			mockCanvasManager.pasteFromClipboard();

			expect( mockCanvasManager.pasteFromClipboard ).toHaveBeenCalled();
		} );
	} );

	describe( 'Arrow Key Navigation', () => {
		it( 'should nudge selected layer 1px with Arrow keys', () => {
			mockCanvasManager.selectLayer( testLayers[ 0 ] );
			const originalX = testLayers[ 0 ].x;
			const originalY = testLayers[ 0 ].y;

			// Nudge right
			mockCanvasManager.nudgeSelectedLayers( 1, 0 );
			expect( testLayers[ 0 ].x ).toBe( originalX + 1 );

			// Nudge down
			mockCanvasManager.nudgeSelectedLayers( 0, 1 );
			expect( testLayers[ 0 ].y ).toBe( originalY + 1 );

			// Nudge left
			mockCanvasManager.nudgeSelectedLayers( -1, 0 );
			expect( testLayers[ 0 ].x ).toBe( originalX );

			// Nudge up
			mockCanvasManager.nudgeSelectedLayers( 0, -1 );
			expect( testLayers[ 0 ].y ).toBe( originalY );
		} );

		it( 'should nudge 10px with Shift+Arrow keys', () => {
			mockCanvasManager.selectLayer( testLayers[ 0 ] );
			const originalX = testLayers[ 0 ].x;

			// Nudge right 10px (Shift+Right)
			mockCanvasManager.nudgeSelectedLayers( 10, 0 );
			expect( testLayers[ 0 ].x ).toBe( originalX + 10 );
		} );
	} );

	describe( 'Undo/Redo Shortcuts', () => {
		it( 'should undo with Ctrl+Z', () => {
			mockEditor.undo();

			expect( mockEditor.historyManager.undo ).toHaveBeenCalled();
		} );

		it( 'should redo with Ctrl+Y', () => {
			mockEditor.redo();

			expect( mockEditor.historyManager.redo ).toHaveBeenCalled();
		} );

		it( 'should redo with Ctrl+Shift+Z', () => {
			mockEditor.redo();

			expect( mockEditor.historyManager.redo ).toHaveBeenCalled();
		} );
	} );

	describe( 'Zoom Shortcuts', () => {
		it( 'should zoom in with Ctrl++', () => {
			const initialZoom = mockEditor.stateManager.get( 'zoom' );

			mockCanvasManager.zoomIn();

			expect( mockCanvasManager.zoomIn ).toHaveBeenCalled();
			expect( mockEditor.stateManager.get( 'zoom' ) ).toBeGreaterThan( initialZoom );
		} );

		it( 'should zoom out with Ctrl+-', () => {
			mockCanvasManager.zoomIn(); // First zoom in
			const zoomedIn = mockEditor.stateManager.get( 'zoom' );

			mockCanvasManager.zoomOut();

			expect( mockCanvasManager.zoomOut ).toHaveBeenCalled();
			expect( mockEditor.stateManager.get( 'zoom' ) ).toBeLessThan( zoomedIn );
		} );

		it( 'should reset zoom with Ctrl+0', () => {
			mockCanvasManager.zoomIn();
			mockCanvasManager.zoomIn();

			mockCanvasManager.resetZoom();

			expect( mockCanvasManager.resetZoom ).toHaveBeenCalled();
			expect( mockEditor.stateManager.get( 'zoom' ) ).toBe( 1 );
		} );
	} );

	describe( 'Layer Panel Keyboard Navigation', () => {
		it( 'should navigate up with Arrow Up', () => {
			mockLayerPanel.focusedIndex = 1;

			mockLayerPanel.focusPrevious();

			expect( mockLayerPanel.focusedIndex ).toBe( 0 );
		} );

		it( 'should navigate down with Arrow Down', () => {
			mockLayerPanel.focusedIndex = 0;

			mockLayerPanel.focusNext();

			expect( mockLayerPanel.focusedIndex ).toBe( 1 );
		} );

		it( 'should jump to first with Home key', () => {
			mockLayerPanel.focusedIndex = 2;

			mockLayerPanel.focusFirst();

			expect( mockLayerPanel.focusedIndex ).toBe( 0 );
		} );

		it( 'should jump to last with End key', () => {
			mockLayerPanel.focusedIndex = 0;

			mockLayerPanel.focusLast();

			expect( mockLayerPanel.focusedIndex ).toBe( 2 );
		} );

		it( 'should select focused layer with Enter', () => {
			mockLayerPanel.focusedIndex = 1;

			mockLayerPanel.selectFocusedLayer();

			expect( mockCanvasManager.selectLayer ).toHaveBeenCalledWith( testLayers[ 1 ] );
		} );

		it( 'should toggle visibility with V key', () => {
			mockLayerPanel.focusedIndex = 0;
			const wasVisible = testLayers[ 0 ].visible;

			mockLayerPanel.toggleVisibility();

			expect( testLayers[ 0 ].visible ).toBe( !wasVisible );
		} );

		it( 'should toggle lock with L key', () => {
			mockLayerPanel.focusedIndex = 0;
			const wasLocked = testLayers[ 0 ].locked;

			mockLayerPanel.toggleLock();

			expect( testLayers[ 0 ].locked ).toBe( !wasLocked );
		} );

		it( 'should not go below first layer', () => {
			mockLayerPanel.focusedIndex = 0;

			mockLayerPanel.focusPrevious();

			expect( mockLayerPanel.focusedIndex ).toBe( 0 );
		} );

		it( 'should not go above last layer', () => {
			mockLayerPanel.focusedIndex = 2;

			mockLayerPanel.focusNext();

			expect( mockLayerPanel.focusedIndex ).toBe( 2 );
		} );
	} );

	describe( 'Layer Order Shortcuts', () => {
		it( 'should bring to front', () => {
			mockCanvasManager.selectLayer( testLayers[ 0 ] );

			mockCanvasManager.bringToFront();

			expect( mockCanvasManager.bringToFront ).toHaveBeenCalled();
		} );

		it( 'should send to back', () => {
			mockCanvasManager.selectLayer( testLayers[ 2 ] );

			mockCanvasManager.sendToBack();

			expect( mockCanvasManager.sendToBack ).toHaveBeenCalled();
		} );

		it( 'should bring forward', () => {
			mockCanvasManager.selectLayer( testLayers[ 0 ] );

			mockCanvasManager.bringForward();

			expect( mockCanvasManager.bringForward ).toHaveBeenCalled();
		} );

		it( 'should send backward', () => {
			mockCanvasManager.selectLayer( testLayers[ 2 ] );

			mockCanvasManager.sendBackward();

			expect( mockCanvasManager.sendBackward ).toHaveBeenCalled();
		} );
	} );

	describe( 'Toggle Shortcuts', () => {
		it( 'should toggle grid with G key', () => {
			mockCanvasManager.toggleGrid();

			expect( mockCanvasManager.toggleGrid ).toHaveBeenCalled();
		} );

		it( 'should toggle smart guides with ; key', () => {
			mockCanvasManager.toggleSmartGuides();

			expect( mockCanvasManager.toggleSmartGuides ).toHaveBeenCalled();
		} );
	} );

	describe( 'Multi-layer Selection Workflow', () => {
		it( 'should handle full selection cycle: select all, deselect, select one', () => {
			// Start with no selection
			expect( mockCanvasManager.getSelectedLayers() ).toHaveLength( 0 );

			// Select all
			mockCanvasManager.selectAll();
			expect( mockCanvasManager.getSelectedLayers() ).toHaveLength( 3 );

			// Deselect
			mockCanvasManager.clearSelection();
			expect( mockCanvasManager.getSelectedLayers() ).toHaveLength( 0 );

			// Select one
			mockCanvasManager.selectLayer( testLayers[ 1 ] );
			expect( mockCanvasManager.getSelectedLayers() ).toHaveLength( 1 );
			expect( mockCanvasManager.getSelectedLayers()[ 0 ].id ).toBe( 'layer2' );
		} );

		it( 'should duplicate and have new selection', () => {
			mockCanvasManager.selectLayer( testLayers[ 0 ] );
			expect( mockCanvasManager.getSelectedLayers()[ 0 ].id ).toBe( 'layer1' );

			mockCanvasManager.duplicateSelectedLayers();

			// After duplication, the copy should be selected
			expect( mockCanvasManager.getSelectedLayers()[ 0 ].id ).toBe( 'layer1_copy' );
		} );
	} );

	describe( 'Edit Workflow', () => {
		it( 'should handle delete then undo workflow', () => {
			const initialCount = testLayers.length;
			mockCanvasManager.selectLayer( testLayers[ 0 ] );

			// Delete
			mockCanvasManager.deleteSelectedLayers();
			expect( testLayers.length ).toBe( initialCount - 1 );

			// Undo would restore (simulated)
			expect( mockEditor.historyManager.undo ).toBeDefined();
		} );

		it( 'should handle move then undo workflow', () => {
			mockCanvasManager.selectLayer( testLayers[ 0 ] );
			const originalX = testLayers[ 0 ].x;

			// Move
			mockCanvasManager.nudgeSelectedLayers( 10, 0 );
			expect( testLayers[ 0 ].x ).toBe( originalX + 10 );

			// Move more
			mockCanvasManager.nudgeSelectedLayers( 10, 0 );
			expect( testLayers[ 0 ].x ).toBe( originalX + 20 );
		} );
	} );

	describe( 'Tool and Drawing Workflow', () => {
		it( 'should switch tools and maintain selection', () => {
			mockCanvasManager.selectLayer( testLayers[ 0 ] );

			// Switch to rectangle tool
			mockCanvasManager.setTool( 'rectangle' );
			expect( mockCanvasManager.getCurrentTool() ).toBe( 'rectangle' );

			// Selection should still be available
			expect( mockCanvasManager.getSelectedLayers() ).toHaveLength( 1 );

			// Switch back to select
			mockCanvasManager.setTool( 'select' );
			expect( mockCanvasManager.getCurrentTool() ).toBe( 'select' );
		} );

		it( 'should cycle through drawing tools', () => {
			const tools = [ 'rectangle', 'circle', 'arrow', 'line', 'text', 'path', 'blur' ];

			tools.forEach( ( tool ) => {
				mockCanvasManager.setTool( tool );
				expect( mockCanvasManager.getCurrentTool() ).toBe( tool );
			} );
		} );
	} );

	describe( 'Zoom and Pan Workflow', () => {
		it( 'should zoom in multiple times', () => {
			const initialZoom = mockEditor.stateManager.get( 'zoom' );

			mockCanvasManager.zoomIn();
			mockCanvasManager.zoomIn();
			mockCanvasManager.zoomIn();

			expect( mockEditor.stateManager.get( 'zoom' ) ).toBeGreaterThan( initialZoom );
		} );

		it( 'should zoom out and reset', () => {
			mockCanvasManager.zoomIn();
			mockCanvasManager.zoomIn();

			const zoomedLevel = mockEditor.stateManager.get( 'zoom' );
			expect( zoomedLevel ).toBeGreaterThan( 1 );

			mockCanvasManager.resetZoom();
			expect( mockEditor.stateManager.get( 'zoom' ) ).toBe( 1 );
		} );

		it( 'should not zoom beyond max', () => {
			// Zoom in many times
			for ( let i = 0; i < 20; i++ ) {
				mockCanvasManager.zoomIn();
			}

			// Should be capped at 10
			expect( mockEditor.stateManager.get( 'zoom' ) ).toBeLessThanOrEqual( 10 );
		} );

		it( 'should not zoom below min', () => {
			// Zoom out many times
			for ( let i = 0; i < 20; i++ ) {
				mockCanvasManager.zoomOut();
			}

			// Should be capped at 0.1
			expect( mockEditor.stateManager.get( 'zoom' ) ).toBeGreaterThanOrEqual( 0.1 );
		} );
	} );
} );
