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
			selectTool: jest.fn(),
			toggleGrid: jest.fn()
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

		it( 'should toggle grid when pressing "g"', function () {
			const event = {
				target: { tagName: 'BODY' },
				key: 'g',
				ctrlKey: false,
				metaKey: false
			};

			keyboardHandler.handleKeyboardShortcuts( event );

			expect( mockToolbar.toggleGrid ).toHaveBeenCalled();
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
	} );
} );
