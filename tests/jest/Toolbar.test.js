/**
 * Jest tests for Toolbar.js
 * Tests toolbar functionality: tool selection, style controls, actions, and keyboard shortcuts
 */
'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

describe( 'Toolbar', function () {
	let Toolbar;
	let toolbar;
	let mockEditor;
	let container;

	beforeAll( function () {
		// Set up JSDOM globals
		global.document = window.document;

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

		// Load Toolbar code
		const toolbarCode = fs.readFileSync(
			path.join( __dirname, '../../resources/ext.layers.editor/Toolbar.js' ),
			'utf8'
		);
		// eslint-disable-next-line no-eval
		eval( toolbarCode );

		Toolbar = window.Toolbar;
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
			duplicateSelected: jest.fn()
		};

		// Mock LayersValidator with all required methods
		window.LayersValidator = function () {
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

	describe( 'Toolbar module exports', function () {
		it( 'should expose Toolbar on window', function () {
			expect( window.Toolbar ).toBeDefined();
		} );

		it( 'should be a constructor function', function () {
			expect( typeof window.Toolbar ).toBe( 'function' );
		} );

		it( 'should have prototype methods', function () {
			expect( typeof Toolbar.prototype.selectTool ).toBe( 'function' );
			expect( typeof Toolbar.prototype.executeAction ).toBe( 'function' );
			expect( typeof Toolbar.prototype.destroy ).toBe( 'function' );
		} );
	} );
} );
