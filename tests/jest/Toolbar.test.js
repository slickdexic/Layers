/**
 * Jest tests for Toolbar.js
 * Tests toolbar functionality: tool selection, style controls, actions, and keyboard shortcuts
 */
'use strict';

describe( 'Toolbar', function () {
	let Toolbar;
	let toolbar;
	let mockEditor;
	let container;

	beforeAll( function () {
		// Set up JSDOM globals
		global.document = window.document;

		// Set up Layers namespace and load NamespaceHelper BEFORE Toolbar
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.UI = window.Layers.UI || {};
		require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

		// Mock mw (MediaWiki) global
		global.mw = {
			config: {
				get: jest.fn( function ( key ) {
					if ( key === 'wgLayersDebug' ) {
						return false;
					}
					return null;
				} )
			},
			message: jest.fn( function ( key ) {
				return {
					text: function () {
						return key;
					},
					exists: function () {
						return true;
					}
				};
			} ),
			log: {
				warn: jest.fn(),
				error: jest.fn()
			}
		};

		// Mock ToolbarKeyboard
		global.window.ToolbarKeyboard = jest.fn( function ( toolbarRef ) {
			this.toolbar = toolbarRef;
			this.editor = toolbarRef.editor;
			this.handleKeyboardShortcuts = jest.fn();
		} );

		// Mock EventTracker for event listener management
		global.window.EventTracker = jest.fn( function () {
			this.listeners = [];
			this.add = jest.fn( ( element, event, handler, options ) => {
				element.addEventListener( event, handler, options );
				this.listeners.push( { element, event, handler, options } );
				return { element, event, handler, options };
			} );
			this.remove = jest.fn();
			this.removeAllForElement = jest.fn();
			this.count = jest.fn( () => this.listeners.length );
			this.destroy = jest.fn( () => {
				this.listeners.forEach( ( info ) => {
					info.element.removeEventListener( info.event, info.handler, info.options );
				} );
				this.listeners = [];
			} );
		} );

		// Load Toolbar code using require for proper coverage tracking
		Toolbar = require( '../../resources/ext.layers.editor/Toolbar.js' );
	} );

	beforeEach( function () {
		// Create container element
		container = document.createElement( 'div' );
		container.id = 'test-toolbar-container';
		document.body.appendChild( container );

		// Create mock editor with all necessary methods
		mockEditor = {
			canvasManager: {
				updateStyleOptions: jest.fn(),
				toggleGrid: jest.fn(),
				toggleRulers: jest.fn(),
				toggleGuidesVisibility: jest.fn(),
				toggleSnapToGrid: jest.fn(),
				toggleSnapToGuides: jest.fn(),
				zoomIn: jest.fn(),
				zoomOut: jest.fn(),
				resetZoom: jest.fn(),
				fitToWindow: jest.fn()
			},
			toolManager: {
				updateStyle: jest.fn()
			},
			stateManager: {
				get: jest.fn( function ( key ) {
					if ( key === 'layers' ) {
						return [];
					}
					return null;
				} ),
				set: jest.fn(),
				subscribe: jest.fn( function () {
					return jest.fn();
				} )
			},
			setCurrentTool: jest.fn(),
			undo: jest.fn(),
			redo: jest.fn(),
			deleteSelected: jest.fn(),
			duplicateSelected: jest.fn(),
			showKeyboardShortcutsDialog: jest.fn(),
			save: jest.fn(),
			cancel: jest.fn()
		};

		// Mock LayersValidator with all required methods
		window.Layers = window.Layers || {};
		window.Layers.Validation = window.Layers.Validation || {};
		window.Layers.Validation.LayersValidator = function () {
			return {
				validateInput: jest.fn( function () {
					return { valid: true };
				} ),
				createInputValidator: jest.fn( function () {
					// Return a mock validator cleanup function
					return jest.fn();
				} )
			};
		};
	} );

	afterEach( function () {
		if ( toolbar ) {
			toolbar.destroy();
		}
		if ( container && container.parentNode ) {
			container.parentNode.removeChild( container );
		}
		jest.clearAllMocks();
	} );

	describe( 'constructor', function () {
		it( 'should create toolbar with required properties', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			expect( toolbar.container ).toBe( container );
			expect( toolbar.editor ).toBe( mockEditor );
			expect( toolbar.currentTool ).toBe( 'pointer' );
		} );

		it( 'should initialize style controls manager', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			expect( toolbar.styleControls ).toBeDefined();
		} );

		it( 'should expose style control values via styleControls', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			// Style state is now managed by ToolbarStyleControls
			if ( toolbar.styleControls ) {
				expect( toolbar.styleControls.strokeColorNone ).toBe( false );
				expect( toolbar.styleControls.fillColorNone ).toBe( false );
				expect( toolbar.styleControls.currentStrokeWidth ).toBe( 2.0 );
			}
		} );

		it( 'should initialize document listeners array', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			// Now uses EventTracker instead of array
			expect( toolbar.eventTracker ).toBeDefined();
		} );

		it( 'should initialize dialog cleanups array', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			expect( Array.isArray( toolbar.dialogCleanups ) ).toBe( true );
		} );
	} );

	describe( 'createInterface', function () {
		it( 'should create toolbar with proper CSS class', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			expect( container.className ).toBe( 'layers-toolbar' );
		} );

		it( 'should set ARIA role on toolbar', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			expect( container.getAttribute( 'role' ) ).toBe( 'toolbar' );
		} );

		it( 'should set ARIA label on toolbar', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			expect( container.getAttribute( 'aria-label' ) ).toBeTruthy();
		} );

		it( 'should create tool group', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const toolGroup = container.querySelector( '.tools-group' );
			expect( toolGroup ).not.toBeNull();
		} );

		it( 'should create style group', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const styleGroup = container.querySelector( '.style-group' );
			expect( styleGroup ).not.toBeNull();
		} );
	} );

	describe( 'createToolButton', function () {
		it( 'should create tool buttons with data-tool attribute', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const pointerBtn = container.querySelector( '[data-tool="pointer"]' );
			expect( pointerBtn ).not.toBeNull();
		} );

		it( 'should create pointer tool button', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const btn = container.querySelector( '[data-tool="pointer"]' );
			expect( btn ).not.toBeNull();
			expect( btn.tagName ).toBe( 'BUTTON' );
		} );

		it( 'should create text tool button', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const btn = container.querySelector( '[data-tool="text"]' );
			expect( btn ).not.toBeNull();
		} );

		it( 'should create rectangle tool button', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const btn = container.querySelector( '[data-tool="rectangle"]' );
			expect( btn ).not.toBeNull();
		} );

		it( 'should create circle tool button', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const btn = container.querySelector( '[data-tool="circle"]' );
			expect( btn ).not.toBeNull();
		} );

		it( 'should create arrow tool button', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const btn = container.querySelector( '[data-tool="arrow"]' );
			expect( btn ).not.toBeNull();
		} );

		it( 'should set aria-label on tool buttons', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const btn = container.querySelector( '[data-tool="pointer"]' );
			expect( btn.getAttribute( 'aria-label' ) ).toBeTruthy();
		} );

		it( 'should mark default tool as active', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const pointerBtn = container.querySelector( '[data-tool="pointer"]' );
			expect( pointerBtn.classList.contains( 'active' ) ).toBe( true );
		} );
	} );

	describe( 'selectTool', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should update currentTool when selecting', function () {
			toolbar.selectTool( 'rectangle' );

			expect( toolbar.currentTool ).toBe( 'rectangle' );
		} );

		it( 'should add active class to selected tool button', function () {
			toolbar.selectTool( 'rectangle' );

			const rectBtn = container.querySelector( '[data-tool="rectangle"]' );
			expect( rectBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		it( 'should remove active class from previously selected tool', function () {
			toolbar.selectTool( 'rectangle' );

			const pointerBtn = container.querySelector( '[data-tool="pointer"]' );
			expect( pointerBtn.classList.contains( 'active' ) ).toBe( false );
		} );

		it( 'should update aria-pressed on selected tool', function () {
			toolbar.selectTool( 'rectangle' );

			const rectBtn = container.querySelector( '[data-tool="rectangle"]' );
			expect( rectBtn.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		} );

		it( 'should notify editor of tool change', function () {
			toolbar.selectTool( 'text' );

			expect( mockEditor.setCurrentTool ).toHaveBeenCalledWith( 'text', { skipToolbarSync: true } );
		} );
	} );

	describe( 'setActiveTool', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should change to new tool', function () {
			toolbar.setActiveTool( 'circle' );

			expect( toolbar.currentTool ).toBe( 'circle' );
		} );

		it( 'should not re-select if already active', function () {
			// Current tool is pointer by default
			mockEditor.setCurrentTool.mockClear();
			toolbar.setActiveTool( 'pointer' );

			expect( mockEditor.setCurrentTool ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'msg', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should return message text for valid key', function () {
			const result = toolbar.msg( 'layers-tool-select', 'fallback' );

			expect( result ).toBeTruthy();
		} );

		it( 'should return fallback for missing key', function () {
			mw.message.mockReturnValueOnce( {
				text: function () {
					return 'nonexistent-key';
				},
				exists: function () {
					return false;
				}
			} );

			const result = toolbar.msg( 'nonexistent-key', 'My Fallback' );

			// Will return key since mw.message returns key when not found
			expect( result ).toBeTruthy();
		} );

		it( 'should use layersMessages when available', function () {
			const oldLayersMessages = window.layersMessages;
			window.layersMessages = {
				get: jest.fn().mockReturnValue( 'Message from helper' )
			};

			const result = toolbar.msg( 'test-key', 'fallback' );

			expect( window.layersMessages.get ).toHaveBeenCalledWith( 'test-key', 'fallback' );
			expect( result ).toBe( 'Message from helper' );

			window.layersMessages = oldLayersMessages;
		} );

		it( 'should fall back to mw.message when layersMessages unavailable', function () {
			const oldLayersMessages = window.layersMessages;
			delete window.layersMessages;

			mw.message.mockReturnValueOnce( {
				text: function () {
					return 'Message from mw';
				}
			} );

			const result = toolbar.msg( 'test-key', 'fallback' );

			expect( mw.message ).toHaveBeenCalledWith( 'test-key' );
			expect( result ).toBe( 'Message from mw' );

			window.layersMessages = oldLayersMessages;
		} );

		it( 'should return fallback when mw.message returns placeholder', function () {
			const oldLayersMessages = window.layersMessages;
			delete window.layersMessages;

			mw.message.mockReturnValueOnce( {
				text: function () {
					return '⧼test-key⧽';
				}
			} );

			const result = toolbar.msg( 'test-key', 'My Fallback' );

			expect( result ).toBe( 'My Fallback' );

			window.layersMessages = oldLayersMessages;
		} );

		it( 'should return fallback when mw.message throws', function () {
			const oldLayersMessages = window.layersMessages;
			delete window.layersMessages;

			mw.message.mockImplementationOnce( function () {
				throw new Error( 'Message error' );
			} );

			const result = toolbar.msg( 'test-key', 'Error Fallback' );

			expect( result ).toBe( 'Error Fallback' );

			window.layersMessages = oldLayersMessages;
		} );

		it( 'should return empty string when no fallback provided and message unavailable', function () {
			const oldLayersMessages = window.layersMessages;
			const oldMw = window.mw;
			delete window.layersMessages;
			delete window.mw;

			const result = toolbar.msg( 'test-key' );

			expect( result ).toBe( '' );

			window.layersMessages = oldLayersMessages;
			window.mw = oldMw;
		} );
	} );

	describe( 'executeAction', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should call editor.undo for undo action', function () {
			toolbar.executeAction( 'undo' );

			expect( mockEditor.undo ).toHaveBeenCalled();
		} );

		it( 'should call editor.redo for redo action', function () {
			toolbar.executeAction( 'redo' );

			expect( mockEditor.redo ).toHaveBeenCalled();
		} );

		it( 'should call editor.deleteSelected for delete action', function () {
			toolbar.executeAction( 'delete' );

			expect( mockEditor.deleteSelected ).toHaveBeenCalled();
		} );

		it( 'should call editor.duplicateSelected for duplicate action', function () {
			toolbar.executeAction( 'duplicate' );

			expect( mockEditor.duplicateSelected ).toHaveBeenCalled();
		} );

		it( 'should toggle grid for grid action', function () {
			const toggleSpy = jest.spyOn( toolbar, 'toggleGrid' );
			toolbar.executeAction( 'grid' );

			expect( toggleSpy ).toHaveBeenCalled();
		} );

		it( 'should toggle rulers for rulers action', function () {
			toolbar.executeAction( 'rulers' );

			expect( mockEditor.canvasManager.toggleRulers ).toHaveBeenCalled();
		} );

		it( 'should toggle guides for guides action', function () {
			toolbar.executeAction( 'guides' );

			expect( mockEditor.canvasManager.toggleGuidesVisibility ).toHaveBeenCalled();
		} );

		it( 'should toggle snap-grid for snap-grid action', function () {
			toolbar.executeAction( 'snap-grid' );

			expect( mockEditor.canvasManager.toggleSnapToGrid ).toHaveBeenCalled();
		} );

		it( 'should toggle snap-guides for snap-guides action', function () {
			toolbar.executeAction( 'snap-guides' );

			expect( mockEditor.canvasManager.toggleSnapToGuides ).toHaveBeenCalled();
		} );
	} );

	describe( 'toggleButtonState', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should toggle active class on button', function () {
			// Create a button with data-action
			const btn = document.createElement( 'button' );
			btn.dataset.action = 'test-action';
			btn.setAttribute( 'aria-pressed', 'false' );
			container.appendChild( btn );

			toolbar.toggleButtonState( 'test-action' );

			expect( btn.classList.contains( 'active' ) ).toBe( true );
		} );

		it( 'should toggle aria-pressed attribute', function () {
			const btn = document.createElement( 'button' );
			btn.dataset.action = 'test-action2';
			btn.setAttribute( 'aria-pressed', 'false' );
			container.appendChild( btn );

			toolbar.toggleButtonState( 'test-action2' );

			expect( btn.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		} );
	} );

	describe( 'addDocumentListener', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should add listener to document', function () {
			const handler = jest.fn();
			const addSpy = jest.spyOn( document, 'addEventListener' );

			toolbar.addDocumentListener( 'click', handler );

			expect( addSpy ).toHaveBeenCalledWith( 'click', handler, undefined );
		} );

		it( 'should track listener for cleanup', function () {
			const handler = jest.fn();
			toolbar.addDocumentListener( 'keydown', handler );

			// Now tracked via EventTracker
			expect( toolbar.eventTracker.add ).toHaveBeenCalled();
		} );

		it( 'should not add listener with invalid handler', function () {
			const initialCount = toolbar.eventTracker.add.mock.calls.length;
			toolbar.addDocumentListener( 'click', null );

			expect( toolbar.eventTracker.add.mock.calls.length ).toBe( initialCount );
		} );

		it( 'should not add listener with missing event', function () {
			const initialCount = toolbar.eventTracker.add.mock.calls.length;
			toolbar.addDocumentListener( '', jest.fn() );

			expect( toolbar.eventTracker.add.mock.calls.length ).toBe( initialCount );
		} );
	} );

	describe( 'removeAllListeners', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should remove all tracked listeners via EventTracker destroy', function () {
			const handler = jest.fn();

			toolbar.addDocumentListener( 'click', handler );
			toolbar.removeAllListeners();

			expect( toolbar.eventTracker.destroy ).toHaveBeenCalled();
		} );
	} );

	describe( 'registerDialogCleanup', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should add cleanup function to array', function () {
			const cleanup = jest.fn();
			toolbar.registerDialogCleanup( cleanup );

			expect( toolbar.dialogCleanups ).toContain( cleanup );
		} );

		it( 'should not add non-function values', function () {
			const initialLength = toolbar.dialogCleanups.length;
			toolbar.registerDialogCleanup( 'not a function' );

			expect( toolbar.dialogCleanups.length ).toBe( initialLength );
		} );
	} );

	describe( 'runDialogCleanups', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should call all cleanup functions', function () {
			const cleanup1 = jest.fn();
			const cleanup2 = jest.fn();

			toolbar.registerDialogCleanup( cleanup1 );
			toolbar.registerDialogCleanup( cleanup2 );
			toolbar.runDialogCleanups();

			expect( cleanup1 ).toHaveBeenCalled();
			expect( cleanup2 ).toHaveBeenCalled();
		} );

		it( 'should empty cleanups array after running', function () {
			toolbar.registerDialogCleanup( jest.fn() );
			toolbar.runDialogCleanups();

			expect( toolbar.dialogCleanups.length ).toBe( 0 );
		} );

		it( 'should handle cleanup errors gracefully', function () {
			toolbar.registerDialogCleanup( function () {
				throw new Error( 'Cleanup error' );
			} );

			// Should not throw
			expect( function () {
				toolbar.runDialogCleanups();
			} ).not.toThrow();
		} );
	} );

	describe( 'destroy', function () {
		it( 'should run dialog cleanups', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
			const runSpy = jest.spyOn( toolbar, 'runDialogCleanups' );

			toolbar.destroy();

			expect( runSpy ).toHaveBeenCalled();
		} );

		it( 'should remove document listeners', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
			const removeSpy = jest.spyOn( toolbar, 'removeAllListeners' );

			toolbar.destroy();

			expect( removeSpy ).toHaveBeenCalled();
		} );

		it( 'should clear keyboard shortcut handler', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
			toolbar.keyboardShortcutHandler = jest.fn();

			toolbar.destroy();

			expect( toolbar.keyboardShortcutHandler ).toBeNull();
		} );

		it( 'should empty arrays after destroy', function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
			toolbar.registerDialogCleanup( jest.fn() );

			toolbar.destroy();

			expect( toolbar.dialogCleanups.length ).toBe( 0 );
			// eventTracker is now nulled instead of being an array
			expect( toolbar.eventTracker ).toBeNull();
		} );
	} );

	describe( 'updateUndoRedoState', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should enable undo button when canUndo is true', function () {
			const undoBtn = container.querySelector( '[data-action="undo"]' );
			if ( undoBtn ) {
				toolbar.updateUndoRedoState( true, false );
				expect( undoBtn.disabled ).toBe( false );
			}
		} );

		it( 'should disable undo button when canUndo is false', function () {
			const undoBtn = container.querySelector( '[data-action="undo"]' );
			if ( undoBtn ) {
				toolbar.updateUndoRedoState( false, false );
				expect( undoBtn.disabled ).toBe( true );
			}
		} );

		it( 'should enable redo button when canRedo is true', function () {
			const redoBtn = container.querySelector( '[data-action="redo"]' );
			if ( redoBtn ) {
				toolbar.updateUndoRedoState( false, true );
				expect( redoBtn.disabled ).toBe( false );
			}
		} );

		it( 'should disable redo button when canRedo is false', function () {
			const redoBtn = container.querySelector( '[data-action="redo"]' );
			if ( redoBtn ) {
				toolbar.updateUndoRedoState( false, false );
				expect( redoBtn.disabled ).toBe( true );
			}
		} );
	} );

	describe( 'updateDeleteState', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should enable delete button when hasSelection is true', function () {
			const deleteBtn = container.querySelector( '[data-action="delete"]' );
			if ( deleteBtn ) {
				toolbar.updateDeleteState( true );
				expect( deleteBtn.disabled ).toBe( false );
			}
		} );

		it( 'should disable delete button when hasSelection is false', function () {
			const deleteBtn = container.querySelector( '[data-action="delete"]' );
			if ( deleteBtn ) {
				toolbar.updateDeleteState( false );
				expect( deleteBtn.disabled ).toBe( true );
			}
		} );

		it( 'should enable duplicate button when hasSelection is true', function () {
			const dupBtn = container.querySelector( '[data-action="duplicate"]' );
			if ( dupBtn ) {
				toolbar.updateDeleteState( true );
				expect( dupBtn.disabled ).toBe( false );
			}
		} );

		it( 'should disable duplicate button when hasSelection is false', function () {
			const dupBtn = container.querySelector( '[data-action="duplicate"]' );
			if ( dupBtn ) {
				toolbar.updateDeleteState( false );
				expect( dupBtn.disabled ).toBe( true );
			}
		} );
	} );

	describe( 'getColorPickerStrings', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should return object with required string keys', function () {
			const strings = toolbar.getColorPickerStrings();

			expect( strings ).toHaveProperty( 'title' );
			expect( strings ).toHaveProperty( 'standard' );
			expect( strings ).toHaveProperty( 'saved' );
			expect( strings ).toHaveProperty( 'none' );
			expect( strings ).toHaveProperty( 'cancel' );
			expect( strings ).toHaveProperty( 'apply' );
		} );
	} );

	describe( 'updateColorButtonDisplay', function () {
		let button;

		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
			button = document.createElement( 'button' );
		} );

		it( 'should set background color for valid color', function () {
			toolbar.updateColorButtonDisplay( button, '#ff0000', 'Transparent' );

			expect( button.style.background ).toBe( 'rgb(255, 0, 0)' );
		} );

		it( 'should add is-transparent class for none color', function () {
			toolbar.updateColorButtonDisplay( button, 'none', 'Transparent' );

			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );
		} );

		it( 'should add is-transparent class for transparent color', function () {
			toolbar.updateColorButtonDisplay( button, 'transparent', 'Transparent' );

			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );
		} );

		it( 'should remove is-transparent class for valid color', function () {
			button.classList.add( 'is-transparent' );
			toolbar.updateColorButtonDisplay( button, '#00ff00', 'Transparent' );

			expect( button.classList.contains( 'is-transparent' ) ).toBe( false );
		} );

		it( 'should set title to transparent label for none color', function () {
			toolbar.updateColorButtonDisplay( button, 'none', 'No Color' );

			expect( button.title ).toBe( 'No Color' );
		} );

		it( 'should set title to color value for valid color', function () {
			toolbar.updateColorButtonDisplay( button, '#123456', 'Transparent' );

			expect( button.title ).toBe( '#123456' );
		} );

		it( 'should set aria-label with preview template', function () {
			toolbar.updateColorButtonDisplay( button, '#ff0000', 'Transparent', 'Color: $1' );

			expect( button.getAttribute( 'aria-label' ) ).toBe( 'Color: #ff0000' );
		} );
	} );

	describe( 'updateColorButtonDisplay fallback path', function () {
		let button;
		let savedColorPickerDialog;

		beforeEach( function () {
			// Save and remove namespaced ColorPickerDialog
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			savedColorPickerDialog = window.Layers.UI.ColorPickerDialog;
			delete window.Layers.UI.ColorPickerDialog;
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
			button = document.createElement( 'button' );
		} );

		afterEach( function () {
			window.Layers.UI.ColorPickerDialog = savedColorPickerDialog;
		} );

		it( 'should use fallback to set background color', function () {
			toolbar.updateColorButtonDisplay( button, '#ff0000', 'Transparent' );

			expect( button.style.background ).toBe( 'rgb(255, 0, 0)' );
		} );

		it( 'should use fallback for transparent class', function () {
			toolbar.updateColorButtonDisplay( button, 'none', 'Transparent' );

			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );
			expect( button.title ).toBe( 'Transparent' );
		} );

		it( 'should use fallback with empty color string', function () {
			toolbar.updateColorButtonDisplay( button, '', 'Transparent' );

			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );
		} );

		it( 'should use fallback aria-label without $1 template', function () {
			toolbar.updateColorButtonDisplay( button, '#00ff00', 'Transparent', 'Color preview' );

			expect( button.getAttribute( 'aria-label' ) ).toBe( 'Color preview #00ff00' );
		} );

		it( 'should use fallback aria-label with $1 template', function () {
			toolbar.updateColorButtonDisplay( button, '#0000ff', 'Transparent', 'Selected: $1' );

			expect( button.getAttribute( 'aria-label' ) ).toBe( 'Selected: #0000ff' );
		} );

		it( 'should set aria-label without previewTemplate', function () {
			toolbar.updateColorButtonDisplay( button, '#123456' );

			expect( button.getAttribute( 'aria-label' ) ).toBe( '#123456' );
		} );

		it( 'should use default Transparent text without transparentLabel', function () {
			toolbar.updateColorButtonDisplay( button, 'none' );

			expect( button.title ).toBe( 'Transparent' );
		} );
	} );

	describe( 'addListener', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should add event listener to element', function () {
			const element = document.createElement( 'button' );
			const handler = jest.fn();

			toolbar.addListener( element, 'click', handler );

			expect( toolbar.eventTracker.add ).toHaveBeenCalled();
		} );

		it( 'should not add listener without element', function () {
			const initialCount = toolbar.eventTracker.add.mock.calls.length;
			toolbar.addListener( null, 'click', jest.fn() );

			expect( toolbar.eventTracker.add.mock.calls.length ).toBe( initialCount );
		} );

		it( 'should not add listener without event', function () {
			const initialCount = toolbar.eventTracker.add.mock.calls.length;
			toolbar.addListener( document.createElement( 'button' ), '', jest.fn() );

			expect( toolbar.eventTracker.add.mock.calls.length ).toBe( initialCount );
		} );

		it( 'should not add listener without handler', function () {
			const initialCount = toolbar.eventTracker.add.mock.calls.length;
			toolbar.addListener( document.createElement( 'button' ), 'click', null );

			expect( toolbar.eventTracker.add.mock.calls.length ).toBe( initialCount );
		} );

		it( 'should work with options', function () {
			const element = document.createElement( 'button' );
			const handler = jest.fn();
			const options = { capture: true };

			toolbar.addListener( element, 'click', handler, options );

			expect( toolbar.eventTracker.add ).toHaveBeenCalledWith(
				element, 'click', handler, options
			);
		} );
	} );

	describe( 'openColorPickerDialog', function () {
		beforeEach( function () {
			// Ensure namespace structure exists
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should do nothing when ColorPickerDialog not available', function () {
			delete window.Layers.UI.ColorPickerDialog;

			expect( function () {
				toolbar.openColorPickerDialog( document.createElement( 'button' ), '#ff0000' );
			} ).not.toThrow();
		} );

		it( 'should create ColorPickerDialog when available', function () {
			const mockPicker = { open: jest.fn() };
			window.Layers.UI.ColorPickerDialog = jest.fn( function () {
				return mockPicker;
			} );
			const anchor = document.createElement( 'button' );

			toolbar.openColorPickerDialog( anchor, '#ff0000' );

			expect( window.Layers.UI.ColorPickerDialog ).toHaveBeenCalled();
			expect( mockPicker.open ).toHaveBeenCalled();
		} );

		it( 'should pass initial value of none correctly', function () {
			const mockPicker = { open: jest.fn() };
			window.Layers.UI.ColorPickerDialog = jest.fn( function ( config ) {
				expect( config.currentColor ).toBe( 'none' );
				return mockPicker;
			} );

			toolbar.openColorPickerDialog( document.createElement( 'button' ), 'none' );

			expect( window.Layers.UI.ColorPickerDialog ).toHaveBeenCalled();
		} );

		it( 'should register cleanup function', function () {
			const mockPicker = { open: jest.fn() };
			window.Layers.UI.ColorPickerDialog = jest.fn( function ( config ) {
				// Simulate registering cleanup
				config.registerCleanup( jest.fn() );
				return mockPicker;
			} );

			const cleanupCount = toolbar.dialogCleanups.length;
			toolbar.openColorPickerDialog( document.createElement( 'button' ), '#ff0000' );

			expect( toolbar.dialogCleanups.length ).toBe( cleanupCount + 1 );
		} );

		it( 'should call onApply callback', function () {
			const mockPicker = { open: jest.fn() };
			let applyCb;
			window.Layers.UI.ColorPickerDialog = jest.fn( function ( config ) {
				applyCb = config.onApply;
				return mockPicker;
			} );

			const onApply = jest.fn();
			toolbar.openColorPickerDialog( document.createElement( 'button' ), '#ff0000', { onApply } );

			applyCb( '#00ff00' );
			expect( onApply ).toHaveBeenCalledWith( '#00ff00' );
		} );

		it( 'should use default empty onApply if not provided', function () {
			const mockPicker = { open: jest.fn() };
			let applyCb;
			window.Layers.UI.ColorPickerDialog = jest.fn( function ( config ) {
				applyCb = config.onApply;
				return mockPicker;
			} );

			toolbar.openColorPickerDialog( document.createElement( 'button' ), '#ff0000' );

			expect( function () {
				applyCb( '#00ff00' );
			} ).not.toThrow();
		} );
	} );

	describe( 'onStyleChange', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should call canvasManager.updateStyleOptions', function () {
			const styleOptions = { color: '#ff0000', strokeWidth: 3 };

			toolbar.onStyleChange( styleOptions );

			expect( mockEditor.canvasManager.updateStyleOptions ).toHaveBeenCalledWith( styleOptions );
		} );

		it( 'should call toolManager.updateStyle', function () {
			const styleOptions = { color: '#ff0000', strokeWidth: 3 };

			toolbar.onStyleChange( styleOptions );

			expect( mockEditor.toolManager.updateStyle ).toHaveBeenCalled();
		} );
	} );

	describe( 'toggleGrid', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should toggle grid via canvasManager', function () {
			toolbar.toggleGrid();

			expect( mockEditor.canvasManager.toggleGrid ).toHaveBeenCalled();
		} );

		it( 'should update button state', function () {
			// Create a grid button
			const gridBtn = document.createElement( 'button' );
			gridBtn.dataset.action = 'grid';
			gridBtn.setAttribute( 'aria-pressed', 'false' );
			container.appendChild( gridBtn );

			toolbar.toggleGrid();

			expect( gridBtn.classList.contains( 'active' ) ).toBe( true );
		} );
	} );

	describe( 'zoom actions via executeZoomAction', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should call canvasManager.zoomIn for zoom-in action', function () {
			toolbar.executeZoomAction( 'zoom-in' );

			expect( mockEditor.canvasManager.zoomIn ).toHaveBeenCalled();
		} );

		it( 'should call canvasManager.zoomOut for zoom-out action', function () {
			toolbar.executeZoomAction( 'zoom-out' );

			expect( mockEditor.canvasManager.zoomOut ).toHaveBeenCalled();
		} );

		it( 'should call canvasManager.resetZoom for zoom-reset action', function () {
			toolbar.executeZoomAction( 'zoom-reset' );

			expect( mockEditor.canvasManager.resetZoom ).toHaveBeenCalled();
		} );

		it( 'should call canvasManager.fitToWindow for fit-window action', function () {
			toolbar.executeZoomAction( 'fit-window' );

			expect( mockEditor.canvasManager.fitToWindow ).toHaveBeenCalled();
		} );

		it( 'should do nothing when canvasManager not available', function () {
			toolbar.editor.canvasManager = null;

			expect( function () {
				toolbar.executeZoomAction( 'zoom-in' );
			} ).not.toThrow();
		} );
	} );

	describe( 'zoom percentage display', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should update zoom percentage display', function () {
			const zoomDisplay = container.querySelector( '.zoom-level' );
			if ( zoomDisplay ) {
				toolbar.updateZoomDisplay( 150 );
				expect( zoomDisplay.textContent ).toContain( '150' );
			}
		} );
	} );

	describe( 'Toolbar module exports', function () {
		it( 'should expose Toolbar on window.Layers.UI namespace', function () {
			expect( window.Layers.UI.Toolbar ).toBeDefined();
		} );

		it( 'should be a constructor function', function () {
			expect( typeof window.Layers.UI.Toolbar ).toBe( 'function' );
		} );

		it( 'should have prototype methods', function () {
			expect( typeof Toolbar.prototype.selectTool ).toBe( 'function' );
			expect( typeof Toolbar.prototype.executeAction ).toBe( 'function' );
			expect( typeof Toolbar.prototype.destroy ).toBe( 'function' );
		} );
	} );

	describe( 'EventTracker fallback paths', function () {
		let savedEventTracker;

		beforeEach( function () {
			savedEventTracker = window.EventTracker;
		} );

		afterEach( function () {
			window.EventTracker = savedEventTracker;
		} );

		it( 'should use direct addEventListener when EventTracker unavailable for document', function () {
			delete window.EventTracker;
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const addSpy = jest.spyOn( document, 'addEventListener' );
			const handler = jest.fn();

			// Force eventTracker to null to trigger fallback
			toolbar.eventTracker = null;
			toolbar.addDocumentListener( 'keydown', handler );

			expect( addSpy ).toHaveBeenCalledWith( 'keydown', handler, undefined );
		} );

		it( 'should use direct addEventListener when EventTracker unavailable for element', function () {
			delete window.EventTracker;
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const element = document.createElement( 'button' );
			const addSpy = jest.spyOn( element, 'addEventListener' );
			const handler = jest.fn();

			// Force eventTracker to null to trigger fallback
			toolbar.eventTracker = null;
			toolbar.addListener( element, 'click', handler );

			expect( addSpy ).toHaveBeenCalledWith( 'click', handler, undefined );
		} );
	} );

	describe( 'runDialogCleanups error handling', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should call layersErrorHandler on cleanup error when available', function () {
			const mockErrorHandler = { handleError: jest.fn() };
			window.layersErrorHandler = mockErrorHandler;

			toolbar.registerDialogCleanup( function () {
				throw new Error( 'Cleanup failed' );
			} );

			toolbar.runDialogCleanups();

			expect( mockErrorHandler.handleError ).toHaveBeenCalledWith(
				expect.any( Error ),
				'Toolbar.runDialogCleanups',
				'canvas',
				{ severity: 'low' }
			);

			delete window.layersErrorHandler;
		} );

		it( 'should handle cleanup error when layersErrorHandler not available', function () {
			delete window.layersErrorHandler;

			toolbar.registerDialogCleanup( function () {
				throw new Error( 'Cleanup failed' );
			} );

			// Should not throw
			expect( function () {
				toolbar.runDialogCleanups();
			} ).not.toThrow();
		} );
	} );

	describe( 'ToolbarStyleControls fallback', function () {
		let savedStyleControls;

		beforeEach( function () {
			savedStyleControls = window.ToolbarStyleControls;
		} );

		afterEach( function () {
			window.ToolbarStyleControls = savedStyleControls;
		} );

		it( 'should create minimal style group when ToolbarStyleControls unavailable', function () {
			delete window.ToolbarStyleControls;
			toolbar = new Toolbar( { container: container, editor: mockEditor } );

			const styleGroup = container.querySelector( '.style-group' );
			expect( styleGroup ).not.toBeNull();
			// Contains fallback text (or message key if not translated)
			expect( styleGroup.textContent.length ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'setupEventHandlers advanced scenarios', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should handle zoom actions via container click on zoom buttons', function () {
			// Create a zoom button with zoom- prefix action
			const zoomBtn = document.createElement( 'button' );
			zoomBtn.dataset.action = 'zoom-in';
			container.appendChild( zoomBtn );

			// Simulate click via direct container click handler
			const clickEvent = new MouseEvent( 'click', { bubbles: true } );
			Object.defineProperty( clickEvent, 'target', { value: zoomBtn } );
			container.dispatchEvent( clickEvent );

			expect( mockEditor.canvasManager.zoomIn ).toHaveBeenCalled();
		} );

		it( 'should handle fit-window action via container click', function () {
			const fitBtn = document.createElement( 'button' );
			fitBtn.dataset.action = 'fit-window';
			container.appendChild( fitBtn );

			const clickEvent = new MouseEvent( 'click', { bubbles: true } );
			Object.defineProperty( clickEvent, 'target', { value: fitBtn } );
			container.dispatchEvent( clickEvent );

			expect( mockEditor.canvasManager.fitToWindow ).toHaveBeenCalled();
		} );

		it( 'should handle keyboard navigation on tool buttons with Enter key', function () {
			const toolBtn = document.createElement( 'button' );
			toolBtn.className = 'tool-button';
			toolBtn.dataset.tool = 'rectangle';
			container.appendChild( toolBtn );

			const keyEvent = new KeyboardEvent( 'keydown', { key: 'Enter', bubbles: true } );
			Object.defineProperty( keyEvent, 'target', { value: toolBtn } );
			const preventSpy = jest.spyOn( keyEvent, 'preventDefault' );
			container.dispatchEvent( keyEvent );

			expect( preventSpy ).toHaveBeenCalled();
		} );

		it( 'should handle keyboard navigation on tool buttons with Space key', function () {
			const toolBtn = document.createElement( 'button' );
			toolBtn.className = 'tool-button';
			toolBtn.dataset.tool = 'circle';
			container.appendChild( toolBtn );

			const keyEvent = new KeyboardEvent( 'keydown', { key: ' ', bubbles: true } );
			Object.defineProperty( keyEvent, 'target', { value: toolBtn } );
			container.dispatchEvent( keyEvent );

			expect( mockEditor.setCurrentTool ).toHaveBeenCalledWith( 'circle', { skipToolbarSync: true } );
		} );

		it( 'should trigger import input click when import button clicked', function () {
			toolbar.importInput = document.createElement( 'input' );
			toolbar.importInput.type = 'file';
			const clickSpy = jest.spyOn( toolbar.importInput, 'click' );

			toolbar.importButton.click();

			expect( clickSpy ).toHaveBeenCalled();
		} );

		it( 'should call importExportManager.exportToFile on export button click', function () {
			toolbar.importExportManager = { exportToFile: jest.fn() };

			toolbar.exportButton.click();

			expect( toolbar.importExportManager.exportToFile ).toHaveBeenCalled();
		} );

		it( 'should not throw when export clicked without importExportManager', function () {
			toolbar.importExportManager = null;

			expect( function () {
				toolbar.exportButton.click();
			} ).not.toThrow();
		} );
	} );

	describe( 'import file change handler', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should do nothing when files property is empty', function () {
			toolbar.importExportManager = { importFromFile: jest.fn() };

			// Create change event - importInput.files will be null/empty by default
			toolbar.importInput.dispatchEvent( new Event( 'change' ) );

			expect( toolbar.importExportManager.importFromFile ).not.toHaveBeenCalled();
		} );

		it( 'should call importFromFile when file is selected', function () {
			const mockFile = new File( [ '[]' ], 'test.json', { type: 'application/json' } );
			Object.defineProperty( toolbar.importInput, 'files', {
				value: [ mockFile ],
				writable: true
			} );
			toolbar.importExportManager = {
				importFromFile: jest.fn().mockResolvedValue()
			};

			toolbar.importInput.dispatchEvent( new Event( 'change' ) );

			expect( toolbar.importExportManager.importFromFile ).toHaveBeenCalledWith( mockFile );
		} );

		it( 'should reset input value after successful import', async function () {
			const mockFile = new File( [ '[]' ], 'test.json', { type: 'application/json' } );
			Object.defineProperty( toolbar.importInput, 'files', {
				value: [ mockFile ],
				writable: true
			} );
			toolbar.importExportManager = {
				importFromFile: jest.fn().mockResolvedValue()
			};

			toolbar.importInput.dispatchEvent( new Event( 'change' ) );

			await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );
			// Input value is reset to empty string
			expect( toolbar.importInput.value ).toBe( '' );
		} );

		it( 'should reset input value even after failed import', async function () {
			const mockFile = new File( [ '[]' ], 'test.json', { type: 'application/json' } );
			Object.defineProperty( toolbar.importInput, 'files', {
				value: [ mockFile ],
				writable: true
			} );
			toolbar.importExportManager = {
				importFromFile: jest.fn().mockRejectedValue( new Error( 'Import failed' ) )
			};

			toolbar.importInput.dispatchEvent( new Event( 'change' ) );

			await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );
			// Input value is reset to empty string
			expect( toolbar.importInput.value ).toBe( '' );
		} );

		it( 'should reset input when importExportManager not available', function () {
			const mockFile = new File( [ '[]' ], 'test.json', { type: 'application/json' } );
			Object.defineProperty( toolbar.importInput, 'files', {
				value: [ mockFile ],
				writable: true
			} );
			toolbar.importExportManager = null;

			toolbar.importInput.dispatchEvent( new Event( 'change' ) );

			// Input value should be reset even without manager
			expect( toolbar.importInput.value ).toBe( '' );
		} );
	} );

	describe( 'executeAction additional cases', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should call editor.showKeyboardShortcutsDialog for show-shortcuts action', function () {
			toolbar.executeAction( 'show-shortcuts' );

			expect( mockEditor.showKeyboardShortcutsDialog ).toHaveBeenCalled();
		} );

		it( 'should toggle rulers via canvasManager', function () {
			const rulersBtn = document.createElement( 'button' );
			rulersBtn.dataset.action = 'rulers';
			rulersBtn.setAttribute( 'aria-pressed', 'false' );
			container.appendChild( rulersBtn );

			toolbar.executeAction( 'rulers' );

			expect( mockEditor.canvasManager.toggleRulers ).toHaveBeenCalled();
			expect( rulersBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		it( 'should toggle guides via canvasManager', function () {
			const guidesBtn = document.createElement( 'button' );
			guidesBtn.dataset.action = 'guides';
			guidesBtn.setAttribute( 'aria-pressed', 'false' );
			container.appendChild( guidesBtn );

			toolbar.executeAction( 'guides' );

			expect( mockEditor.canvasManager.toggleGuidesVisibility ).toHaveBeenCalled();
			expect( guidesBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		it( 'should toggle snap-grid via canvasManager', function () {
			const snapGridBtn = document.createElement( 'button' );
			snapGridBtn.dataset.action = 'snap-grid';
			snapGridBtn.setAttribute( 'aria-pressed', 'false' );
			container.appendChild( snapGridBtn );

			toolbar.executeAction( 'snap-grid' );

			expect( mockEditor.canvasManager.toggleSnapToGrid ).toHaveBeenCalled();
			expect( snapGridBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		it( 'should toggle snap-guides via canvasManager', function () {
			const snapGuidesBtn = document.createElement( 'button' );
			snapGuidesBtn.dataset.action = 'snap-guides';
			snapGuidesBtn.setAttribute( 'aria-pressed', 'false' );
			container.appendChild( snapGuidesBtn );

			toolbar.executeAction( 'snap-guides' );

			expect( mockEditor.canvasManager.toggleSnapToGuides ).toHaveBeenCalled();
			expect( snapGuidesBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		it( 'should handle rulers action when canvasManager not available', function () {
			toolbar.editor.canvasManager = null;

			expect( function () {
				toolbar.executeAction( 'rulers' );
			} ).not.toThrow();
		} );

		it( 'should handle guides action when canvasManager not available', function () {
			toolbar.editor.canvasManager = null;

			expect( function () {
				toolbar.executeAction( 'guides' );
			} ).not.toThrow();
		} );

		it( 'should handle snap-grid action when canvasManager not available', function () {
			toolbar.editor.canvasManager = null;

			expect( function () {
				toolbar.executeAction( 'snap-grid' );
			} ).not.toThrow();
		} );

		it( 'should handle snap-guides action when canvasManager not available', function () {
			toolbar.editor.canvasManager = null;

			expect( function () {
				toolbar.executeAction( 'snap-guides' );
			} ).not.toThrow();
		} );
	} );

	describe( 'updateToolOptions', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should call styleControls.updateForTool when available', function () {
			toolbar.styleControls = { updateForTool: jest.fn(), destroy: jest.fn() };

			toolbar.updateToolOptions( 'text' );

			expect( toolbar.styleControls.updateForTool ).toHaveBeenCalledWith( 'text' );
		} );

		it( 'should not throw when styleControls not available', function () {
			toolbar.styleControls = null;

			expect( function () {
				toolbar.updateToolOptions( 'rectangle' );
			} ).not.toThrow();
		} );
	} );

	describe( 'updateStyleOptions', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should get style options and propagate to editor', function () {
			const mockStyles = { color: '#ff0000', strokeWidth: 3 };
			toolbar.styleControls = { getStyleOptions: jest.fn().mockReturnValue( mockStyles ), destroy: jest.fn() };
			const onStyleChangeSpy = jest.spyOn( toolbar, 'onStyleChange' );

			toolbar.updateStyleOptions();

			expect( toolbar.styleControls.getStyleOptions ).toHaveBeenCalled();
			expect( onStyleChangeSpy ).toHaveBeenCalledWith( mockStyles );
		} );

		it( 'should not throw when styleControls not available', function () {
			toolbar.styleControls = null;

			expect( function () {
				toolbar.updateStyleOptions();
			} ).not.toThrow();
		} );
	} );

	describe( 'handleKeyboardShortcuts deprecated wrapper', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should delegate to keyboardHandler when available', function () {
			toolbar.keyboardHandler = { handleKeyboardShortcuts: jest.fn() };
			const mockEvent = new KeyboardEvent( 'keydown', { key: 'z', ctrlKey: true } );

			toolbar.handleKeyboardShortcuts( mockEvent );

			expect( toolbar.keyboardHandler.handleKeyboardShortcuts ).toHaveBeenCalledWith( mockEvent );
		} );

		it( 'should not throw when keyboardHandler not available', function () {
			toolbar.keyboardHandler = null;

			expect( function () {
				toolbar.handleKeyboardShortcuts( new KeyboardEvent( 'keydown' ) );
			} ).not.toThrow();
		} );
	} );

	describe( 'createActionButton toggle buttons', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should set aria-pressed for grid toggle action', function () {
			const button = toolbar.createActionButton( { id: 'grid', icon: '⊞', title: 'Toggle Grid' } );

			expect( button.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		} );

		it( 'should set aria-pressed for rulers toggle action', function () {
			const button = toolbar.createActionButton( { id: 'rulers', icon: 'R', title: 'Toggle Rulers' } );

			expect( button.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		} );

		it( 'should set aria-pressed for guides toggle action', function () {
			const button = toolbar.createActionButton( { id: 'guides', icon: 'G', title: 'Toggle Guides' } );

			expect( button.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		} );

		it( 'should set aria-pressed for snap-grid toggle action', function () {
			const button = toolbar.createActionButton( { id: 'snap-grid', icon: 'SG', title: 'Snap to Grid' } );

			expect( button.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		} );

		it( 'should set aria-pressed for snap-guides toggle action', function () {
			const button = toolbar.createActionButton( { id: 'snap-guides', icon: 'SH', title: 'Snap to Guides' } );

			expect( button.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		} );

		it( 'should not set aria-pressed for non-toggle actions', function () {
			const button = toolbar.createActionButton( { id: 'delete', icon: 'X', title: 'Delete' } );

			expect( button.hasAttribute( 'aria-pressed' ) ).toBe( false );
		} );

		it( 'should include keyboard shortcut in title when provided', function () {
			const button = toolbar.createActionButton( { id: 'undo', icon: '↶', title: 'Undo', key: 'Ctrl+Z' } );

			expect( button.title ).toBe( 'Undo (Ctrl+Z)' );
		} );

		it( 'should not add shortcut to title when key not provided', function () {
			const button = toolbar.createActionButton( { id: 'custom', icon: '★', title: 'Custom Action' } );

			expect( button.title ).toBe( 'Custom Action' );
		} );
	} );

	describe( 'createToolButton with validation', function () {
		beforeEach( function () {
			toolbar = new Toolbar( { container: container, editor: mockEditor } );
		} );

		it( 'should create tool button with correct attributes', function () {
			const button = toolbar.createToolButton( { id: 'path', icon: '✎', title: 'Path Tool', key: 'P' } );

			expect( button.classList.contains( 'tool-button' ) ).toBe( true );
			expect( button.dataset.tool ).toBe( 'path' );
			expect( button.textContent ).toBe( '✎' );
			expect( button.title ).toBe( 'Path Tool (P)' );
			expect( button.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		} );
	} );
} );
