/**
 * Jest tests for ToolbarKeyboard.js
 * Tests keyboard shortcut handling functionality
 */
'use strict';

const { ToolbarKeyboard } = require( '../../resources/ext.layers.editor/ToolbarKeyboard.js' );

describe( 'ToolbarKeyboard', function () {
	let keyboardHandler;
	let mockToolbar;
	let mockEditor;

	beforeEach( function () {
		// Create mock editor
		mockEditor = {
			undo: jest.fn(),
			redo: jest.fn(),
			save: jest.fn(),
			duplicateSelected: jest.fn(),
			deleteSelected: jest.fn(),
			cancel: jest.fn()
		};

		// Create mock toolbar
		mockToolbar = {
			editor: mockEditor,
			selectTool: jest.fn()
		};

		keyboardHandler = new ToolbarKeyboard( mockToolbar );
	} );

	describe( 'constructor', function () {
		it( 'should store toolbar reference', function () {
			expect( keyboardHandler.toolbar ).toBe( mockToolbar );
		} );

		it( 'should store editor reference', function () {
			expect( keyboardHandler.editor ).toBe( mockEditor );
		} );
	} );

	describe( 'handleKeyboardShortcuts', function () {
		it( 'should ignore shortcuts when typing in INPUT', function () {
			const event = {
				target: { tagName: 'INPUT' },
				key: 'v',
				ctrlKey: false,
				metaKey: false
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( mockToolbar.selectTool ).not.toHaveBeenCalled();
		} );

		it( 'should ignore shortcuts when typing in TEXTAREA', function () {
			const event = {
				target: { tagName: 'TEXTAREA' },
				key: 'v',
				ctrlKey: false,
				metaKey: false
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( mockToolbar.selectTool ).not.toHaveBeenCalled();
		} );

		it( 'should ignore shortcuts in contentEditable', function () {
			const event = {
				target: { tagName: 'DIV', contentEditable: 'true' },
				key: 'v',
				ctrlKey: false,
				metaKey: false
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( mockToolbar.selectTool ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'tool shortcuts', function () {
		const toolShortcuts = [
			{ key: 'v', tool: 'pointer' },
			{ key: 't', tool: 'text' },
			{ key: 'p', tool: 'pen' },
			{ key: 'r', tool: 'rectangle' },
			{ key: 'c', tool: 'circle' },
			{ key: 'e', tool: 'ellipse' },
			{ key: 's', tool: 'star' },
			{ key: 'b', tool: 'blur' },
			{ key: 'a', tool: 'arrow' },
			{ key: 'l', tool: 'line' }
		];

		toolShortcuts.forEach( ( { key, tool } ) => {
			it( `should select ${ tool } tool when pressing "${ key }"`, function () {
				const event = {
					target: { tagName: 'BODY' },
					key: key,
					ctrlKey: false,
					metaKey: false
				};

				keyboardHandler.handleKeyboardShortcuts( event );

				expect( mockToolbar.selectTool ).toHaveBeenCalledWith( tool );
			} );
		} );

		it( 'should delete selected on Delete key', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 'delete',
				ctrlKey: false,
				metaKey: false
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( mockEditor.deleteSelected ).toHaveBeenCalled();
		} );

		it( 'should delete selected on Backspace key', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 'backspace',
				ctrlKey: false,
				metaKey: false
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( mockEditor.deleteSelected ).toHaveBeenCalled();
		} );

		it( 'should cancel on Escape key', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 'escape',
				ctrlKey: false,
				metaKey: false
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( mockEditor.cancel ).toHaveBeenCalled();
		} );
	} );

	describe( 'Ctrl shortcuts', function () {
		it( 'should undo on Ctrl+Z', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 'z',
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.undo ).toHaveBeenCalled();
		} );

		it( 'should redo on Ctrl+Shift+Z', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 'z',
				ctrlKey: true,
				metaKey: false,
				shiftKey: true,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.redo ).toHaveBeenCalled();
		} );

		it( 'should redo on Ctrl+Y', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 'y',
				ctrlKey: true,
				metaKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.redo ).toHaveBeenCalled();
		} );

		it( 'should save on Ctrl+S', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 's',
				ctrlKey: true,
				metaKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.save ).toHaveBeenCalled();
		} );

		it( 'should duplicate on Ctrl+D', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 'd',
				ctrlKey: true,
				metaKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.duplicateSelected ).toHaveBeenCalled();
		} );

		it( 'should handle Cmd key on Mac (metaKey)', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 'z',
				ctrlKey: false,
				metaKey: true,
				shiftKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.undo ).toHaveBeenCalled();
		} );
	} );

	describe( 'getShortcutsConfig', function () {
		it( 'should return array of shortcut definitions', function () {
			const shortcuts = keyboardHandler.getShortcutsConfig();

			expect( Array.isArray( shortcuts ) ).toBe( true );
			expect( shortcuts.length ).toBeGreaterThan( 10 );
		} );

		it( 'should include tool shortcuts', function () {
			const shortcuts = keyboardHandler.getShortcutsConfig();
			const toolShortcuts = shortcuts.filter( s => s.category === 'tools' );

			expect( toolShortcuts.length ).toBeGreaterThan( 5 );
			expect( toolShortcuts.some( s => s.key === 'V' ) ).toBe( true );
			expect( toolShortcuts.some( s => s.key === 'T' ) ).toBe( true );
		} );

		it( 'should include edit shortcuts', function () {
			const shortcuts = keyboardHandler.getShortcutsConfig();
			const editShortcuts = shortcuts.filter( s => s.category === 'edit' );

			expect( editShortcuts.some( s => s.key === 'Ctrl+Z' ) ).toBe( true );
			expect( editShortcuts.some( s => s.key === 'Ctrl+D' ) ).toBe( true );
		} );

		it( 'should include smart guides shortcut in view category', function () {
			const shortcuts = keyboardHandler.getShortcutsConfig();
			const viewShortcuts = shortcuts.filter( s => s.category === 'view' );

			expect( viewShortcuts.some( s => s.key === ';' && s.description === 'Toggle Smart Guides' ) ).toBe( true );
		} );
	} );

	describe( 'Shift shortcuts', function () {
		it( 'should show keyboard shortcuts help on Shift+?', function () {
			mockEditor.dialogManager = {
				showKeyboardShortcutsDialog: jest.fn()
			};

			const event = {
				target: { tagName: 'BODY' },
				key: '?',
				ctrlKey: false,
				metaKey: false,
				shiftKey: true,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.dialogManager.showKeyboardShortcutsDialog ).toHaveBeenCalled();
		} );

		it( 'should toggle background visibility on Shift+B', function () {
			mockEditor.layerPanel = {
				toggleBackgroundVisibility: jest.fn()
			};

			const event = {
				target: { tagName: 'BODY' },
				key: 'b',
				ctrlKey: false,
				metaKey: false,
				shiftKey: true,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.layerPanel.toggleBackgroundVisibility ).toHaveBeenCalled();
		} );
	} );

	describe( 'toggleBackgroundVisibility', function () {
		it( 'should use LayerPanel when available', function () {
			mockEditor.layerPanel = {
				toggleBackgroundVisibility: jest.fn()
			};

			keyboardHandler.toggleBackgroundVisibility();

			expect( mockEditor.layerPanel.toggleBackgroundVisibility ).toHaveBeenCalled();
		} );

		it( 'should fall back to StateManager when LayerPanel not available', function () {
			mockEditor.layerPanel = null;
			mockEditor.stateManager = {
				get: jest.fn().mockReturnValue( true ),
				set: jest.fn()
			};
			mockEditor.canvasManager = {
				redraw: jest.fn()
			};

			keyboardHandler.toggleBackgroundVisibility();

			expect( mockEditor.stateManager.get ).toHaveBeenCalledWith( 'backgroundVisible' );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', false );
			expect( mockEditor.canvasManager.redraw ).toHaveBeenCalled();
		} );

		it( 'should toggle from false to true via StateManager', function () {
			mockEditor.layerPanel = null;
			mockEditor.stateManager = {
				get: jest.fn().mockReturnValue( false ),
				set: jest.fn()
			};
			mockEditor.canvasManager = {
				redraw: jest.fn()
			};

			keyboardHandler.toggleBackgroundVisibility();

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', true );
		} );

		it( 'should handle missing canvasManager gracefully', function () {
			mockEditor.layerPanel = null;
			mockEditor.stateManager = {
				get: jest.fn().mockReturnValue( true ),
				set: jest.fn()
			};
			mockEditor.canvasManager = null;

			// Should not throw
			expect( () => keyboardHandler.toggleBackgroundVisibility() ).not.toThrow();
			expect( mockEditor.stateManager.set ).toHaveBeenCalled();
		} );
	} );

	describe( 'toggleSmartGuides', function () {
		it( 'should toggle smart guides off when currently on', function () {
			mockEditor.canvasManager = {
				smartGuidesController: {
					enabled: true,
					setEnabled: jest.fn()
				}
			};
			mockToolbar.updateSmartGuidesButton = jest.fn();

			keyboardHandler.toggleSmartGuides();

			expect( mockEditor.canvasManager.smartGuidesController.setEnabled ).toHaveBeenCalledWith( false );
			expect( mockToolbar.updateSmartGuidesButton ).toHaveBeenCalledWith( false );
		} );

		it( 'should toggle smart guides on when currently off', function () {
			mockEditor.canvasManager = {
				smartGuidesController: {
					enabled: false,
					setEnabled: jest.fn()
				}
			};
			mockToolbar.updateSmartGuidesButton = jest.fn();

			keyboardHandler.toggleSmartGuides();

			expect( mockEditor.canvasManager.smartGuidesController.setEnabled ).toHaveBeenCalledWith( true );
			expect( mockToolbar.updateSmartGuidesButton ).toHaveBeenCalledWith( true );
		} );

		it( 'should handle missing canvasManager gracefully', function () {
			mockEditor.canvasManager = null;

			expect( () => keyboardHandler.toggleSmartGuides() ).not.toThrow();
		} );

		it( 'should handle missing smartGuidesController gracefully', function () {
			mockEditor.canvasManager = {};

			expect( () => keyboardHandler.toggleSmartGuides() ).not.toThrow();
		} );

		it( 'should show status message when showStatus is available', function () {
			mockEditor.canvasManager = {
				smartGuidesController: {
					enabled: false,
					setEnabled: jest.fn()
				}
			};
			mockEditor.showStatus = jest.fn();

			keyboardHandler.toggleSmartGuides();

			expect( mockEditor.showStatus ).toHaveBeenCalledWith( 'Smart Guides: On', 1500 );
		} );

		it( 'should be triggered by semicolon key', function () {
			mockEditor.canvasManager = {
				smartGuidesController: {
					enabled: false,
					setEnabled: jest.fn()
				}
			};

			const event = {
				target: { tagName: 'BODY' },
				key: ';',
				ctrlKey: false,
				metaKey: false,
				shiftKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.canvasManager.smartGuidesController.setEnabled ).toHaveBeenCalledWith( true );
		} );
	} );

	describe( 'showKeyboardShortcutsHelp', function () {
		it( 'should use DialogManager when available', function () {
			mockEditor.dialogManager = {
				showKeyboardShortcutsDialog: jest.fn()
			};

			keyboardHandler.showKeyboardShortcutsHelp();

			expect( mockEditor.dialogManager.showKeyboardShortcutsDialog ).toHaveBeenCalled();
		} );

		it( 'should fall back to editor method when DialogManager not available', function () {
			mockEditor.dialogManager = null;
			mockEditor.showKeyboardShortcutsDialog = jest.fn();

			keyboardHandler.showKeyboardShortcutsHelp();

			expect( mockEditor.showKeyboardShortcutsDialog ).toHaveBeenCalled();
		} );

		it( 'should handle case where neither DialogManager nor editor method exists', function () {
			mockEditor.dialogManager = null;
			mockEditor.showKeyboardShortcutsDialog = null;

			// Should not throw
			expect( () => keyboardHandler.showKeyboardShortcutsHelp() ).not.toThrow();
		} );
	} );

	describe( 'zoom shortcuts', function () {
		it( 'should zoom in on pressing "+"', function () {
			mockEditor.canvasManager = {
				zoomIn: jest.fn()
			};

			const event = {
				target: { tagName: 'BODY' },
				key: '+',
				ctrlKey: false,
				metaKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.canvasManager.zoomIn ).toHaveBeenCalled();
		} );

		it( 'should zoom in on pressing "="', function () {
			mockEditor.canvasManager = {
				zoomIn: jest.fn()
			};

			const event = {
				target: { tagName: 'BODY' },
				key: '=',
				ctrlKey: false,
				metaKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.canvasManager.zoomIn ).toHaveBeenCalled();
		} );

		it( 'should zoom out on pressing "-"', function () {
			mockEditor.canvasManager = {
				zoomOut: jest.fn()
			};

			const event = {
				target: { tagName: 'BODY' },
				key: '-',
				ctrlKey: false,
				metaKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.canvasManager.zoomOut ).toHaveBeenCalled();
		} );

		it( 'should fit to window on pressing "0"', function () {
			mockEditor.canvasManager = {
				fitToWindow: jest.fn()
			};

			const event = {
				target: { tagName: 'BODY' },
				key: '0',
				ctrlKey: false,
				metaKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.canvasManager.fitToWindow ).toHaveBeenCalled();
		} );
	} );

	describe( 'handleZoom', function () {
		it( 'should use zoomPanController when direct method not available', function () {
			mockEditor.canvasManager = {
				zoomPanController: {
					zoomIn: jest.fn()
				}
			};

			keyboardHandler.handleZoom( 'in' );

			expect( mockEditor.canvasManager.zoomPanController.zoomIn ).toHaveBeenCalled();
		} );

		it( 'should use zoomPanController.zoomOut as fallback', function () {
			mockEditor.canvasManager = {
				zoomPanController: {
					zoomOut: jest.fn()
				}
			};

			keyboardHandler.handleZoom( 'out' );

			expect( mockEditor.canvasManager.zoomPanController.zoomOut ).toHaveBeenCalled();
		} );

		it( 'should use zoomPanController.fitToWindow as fallback', function () {
			mockEditor.canvasManager = {
				zoomPanController: {
					fitToWindow: jest.fn()
				}
			};

			keyboardHandler.handleZoom( 'fit' );

			expect( mockEditor.canvasManager.zoomPanController.fitToWindow ).toHaveBeenCalled();
		} );

		it( 'should handle missing canvasManager gracefully', function () {
			mockEditor.canvasManager = null;

			expect( () => keyboardHandler.handleZoom( 'in' ) ).not.toThrow();
		} );

		it( 'should handle missing zoom methods gracefully', function () {
			mockEditor.canvasManager = {};

			expect( () => keyboardHandler.handleZoom( 'in' ) ).not.toThrow();
			expect( () => keyboardHandler.handleZoom( 'out' ) ).not.toThrow();
			expect( () => keyboardHandler.handleZoom( 'fit' ) ).not.toThrow();
		} );
	} );

	describe( 'additional tool shortcuts', function () {
		it( 'should select textbox tool when pressing "x"', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 'x',
				ctrlKey: false,
				metaKey: false
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( mockToolbar.selectTool ).toHaveBeenCalledWith( 'textbox' );
		} );

		it( 'should select polygon tool when pressing "y"', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 'y',
				ctrlKey: false,
				metaKey: false
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( mockToolbar.selectTool ).toHaveBeenCalledWith( 'polygon' );
		} );
	} );

	describe( 'group shortcuts', function () {
		it( 'should group selected layers on Ctrl+G', function () {
			mockEditor.groupManager = {
				groupSelected: jest.fn().mockReturnValue( { id: 'group1' } )
			};
			mockEditor.canvasManager = { redraw: jest.fn() };
			mockEditor.layerPanel = { renderLayerList: jest.fn() };

			const event = {
				target: { tagName: 'BODY' },
				key: 'g',
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.groupManager.groupSelected ).toHaveBeenCalled();
			expect( mockEditor.canvasManager.redraw ).toHaveBeenCalled();
			expect( mockEditor.layerPanel.renderLayerList ).toHaveBeenCalled();
		} );

		it( 'should ungroup selected group on Ctrl+Shift+G', function () {
			mockEditor.groupManager = {
				ungroupSelected: jest.fn().mockReturnValue( true )
			};
			mockEditor.canvasManager = { redraw: jest.fn() };
			mockEditor.layerPanel = { renderLayerList: jest.fn() };

			const event = {
				target: { tagName: 'BODY' },
				key: 'g',
				ctrlKey: true,
				metaKey: false,
				shiftKey: true,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.groupManager.ungroupSelected ).toHaveBeenCalled();
			expect( mockEditor.canvasManager.redraw ).toHaveBeenCalled();
			expect( mockEditor.layerPanel.renderLayerList ).toHaveBeenCalled();
		} );

		it( 'should handle missing groupManager gracefully', function () {
			mockEditor.groupManager = null;

			const event = {
				target: { tagName: 'BODY' },
				key: 'g',
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				preventDefault: jest.fn()
			};

			expect( () => keyboardHandler.handleKeyboardShortcuts( event ) ).not.toThrow();
		} );

		it( 'should not update UI when group operation fails', function () {
			mockEditor.groupManager = {
				groupSelected: jest.fn().mockReturnValue( null ) // Less than 2 layers selected
			};
			mockEditor.canvasManager = { redraw: jest.fn() };
			mockEditor.layerPanel = { renderLayerList: jest.fn() };

			const event = {
				target: { tagName: 'BODY' },
				key: 'g',
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			// Should still prevent default
			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.groupManager.groupSelected ).toHaveBeenCalled();
			// UI should NOT be updated when result is null
			expect( mockEditor.canvasManager.redraw ).not.toHaveBeenCalled();
		} );

		it( 'should show status message when grouping succeeds', function () {
			mockEditor.groupManager = {
				groupSelected: jest.fn().mockReturnValue( { id: 'group1' } )
			};
			mockEditor.canvasManager = { redraw: jest.fn() };
			mockEditor.showStatus = jest.fn();

			const event = {
				target: { tagName: 'BODY' },
				key: 'g',
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( mockEditor.showStatus ).toHaveBeenCalledWith( 'Layers grouped', 1500 );
		} );

		it( 'should show status message when ungrouping succeeds', function () {
			mockEditor.groupManager = {
				ungroupSelected: jest.fn().mockReturnValue( true )
			};
			mockEditor.canvasManager = { redraw: jest.fn() };
			mockEditor.showStatus = jest.fn();

			const event = {
				target: { tagName: 'BODY' },
				key: 'g',
				ctrlKey: true,
				metaKey: false,
				shiftKey: true,
				preventDefault: jest.fn()
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( mockEditor.showStatus ).toHaveBeenCalledWith( 'Group dissolved', 1500 );
		} );
	} );

	describe( 'getShortcutsConfig - group shortcuts', function () {
		it( 'should include group shortcuts in layers category', function () {
			const shortcuts = keyboardHandler.getShortcutsConfig();
			const layerShortcuts = shortcuts.filter( s => s.category === 'layers' );

			expect( layerShortcuts.some( s => s.key === 'Ctrl+G' ) ).toBe( true );
			expect( layerShortcuts.some( s => s.key === 'Ctrl+Shift+G' ) ).toBe( true );
		} );
	} );
} );
