/**
 * Tests for EventManager module
 */

const { EventManager } = ( () => {
	require( '../../resources/ext.layers.editor/EventManager.js' );
	return { EventManager: window.Layers.Core.EventManager };
} )();

describe( 'EventManager', () => {
	let eventManager;
	let mockEditor;

	// Helper function for creating keyboard events
	const createKeyEvent = ( key, options = {} ) => ( {
		key,
		ctrlKey: options.ctrlKey || false,
		metaKey: options.metaKey || false,
		shiftKey: options.shiftKey || false,
		target: options.target || document.createElement( 'div' ),
		preventDefault: jest.fn()
	} );

	beforeEach( () => {
		// Create mock editor
		mockEditor = {
			canvasManager: {
				resizeCanvas: jest.fn()
			},
			isDirty: jest.fn( () => false ),
			save: jest.fn(),
			deleteSelected: jest.fn(),
			duplicateSelected: jest.fn(),
			cancel: jest.fn(),
			undo: jest.fn( () => true ),
			redo: jest.fn( () => true ),
			renderLayers: jest.fn(),
			markDirty: jest.fn()
		};

		eventManager = new EventManager( mockEditor );
	} );

	afterEach( () => {
		if ( eventManager ) {
			// Clear listeners manually to avoid errors with mock targets
			eventManager.listeners = [];
		}
	} );

	describe( 'constructor', () => {
		it( 'should create EventManager with editor reference', () => {
			expect( eventManager.editor ).toBe( mockEditor );
		} );

		it( 'should initialize listeners array', () => {
			expect( Array.isArray( eventManager.listeners ) ).toBe( true );
		} );

		it( 'should set up global handlers when setupGlobalHandlers is called', () => {
			// setupGlobalHandlers is called by LayersEditor.init(), not constructor
			// to support the stub fallback pattern
			eventManager.setupGlobalHandlers();
			// Should have registered resize, beforeunload, and keydown
			expect( eventManager.listeners.length ).toBeGreaterThanOrEqual( 3 );
		} );

		it( 'should prevent double-registration of global handlers', () => {
			eventManager.setupGlobalHandlers();
			const firstCount = eventManager.listeners.length;
			eventManager.setupGlobalHandlers(); // Call again
			expect( eventManager.listeners.length ).toBe( firstCount );
		} );
	} );

	describe( 'registerListener', () => {
		it( 'should add event listener to target', () => {
			const target = {
				addEventListener: jest.fn()
			};
			const handler = jest.fn();

			eventManager.registerListener( target, 'click', handler, { passive: true } );

			expect( target.addEventListener ).toHaveBeenCalledWith( 'click', handler, { passive: true } );
		} );

		it( 'should track listener for cleanup', () => {
			const target = {
				addEventListener: jest.fn()
			};
			const handler = jest.fn();
			const initialCount = eventManager.listeners.length;

			eventManager.registerListener( target, 'click', handler );

			expect( eventManager.listeners.length ).toBe( initialCount + 1 );
			expect( eventManager.listeners[ eventManager.listeners.length - 1 ] ).toEqual( {
				target,
				type: 'click',
				handler,
				options: undefined
			} );
		} );
	} );

	describe( 'handleResize', () => {
		it( 'should call canvasManager.resizeCanvas', () => {
			eventManager.handleResize();

			expect( mockEditor.canvasManager.resizeCanvas ).toHaveBeenCalled();
		} );

		it( 'should handle missing canvasManager gracefully', () => {
			eventManager.editor.canvasManager = null;

			expect( () => eventManager.handleResize() ).not.toThrow();
		} );

		it( 'should handle missing resizeCanvas method gracefully', () => {
			eventManager.editor.canvasManager = {};

			expect( () => eventManager.handleResize() ).not.toThrow();
		} );
	} );

	describe( 'handleBeforeUnload', () => {
		it( 'should prevent unload when editor is dirty', () => {
			mockEditor.isDirty.mockReturnValue( true );
			const event = {
				preventDefault: jest.fn()
			};

			eventManager.handleBeforeUnload( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( event.returnValue ).toBe( '' );
		} );

		it( 'should not prevent unload when editor is not dirty', () => {
			mockEditor.isDirty.mockReturnValue( false );
			const event = {
				preventDefault: jest.fn()
			};

			eventManager.handleBeforeUnload( event );

			expect( event.preventDefault ).not.toHaveBeenCalled();
		} );

		it( 'should handle missing isDirty method', () => {
			eventManager.editor.isDirty = undefined;
			const event = {
				preventDefault: jest.fn()
			};

			expect( () => eventManager.handleBeforeUnload( event ) ).not.toThrow();
			expect( event.preventDefault ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'isInputElement', () => {
		it( 'should return true for INPUT elements', () => {
			const input = document.createElement( 'input' );
			expect( eventManager.isInputElement( input ) ).toBe( true );
		} );

		it( 'should return true for TEXTAREA elements', () => {
			const textarea = document.createElement( 'textarea' );
			expect( eventManager.isInputElement( textarea ) ).toBe( true );
		} );

		it( 'should return true for contentEditable elements', () => {
			const div = document.createElement( 'div' );
			div.contentEditable = 'true';
			expect( eventManager.isInputElement( div ) ).toBe( true );
		} );

		it( 'should return false for non-input elements', () => {
			const div = document.createElement( 'div' );
			expect( eventManager.isInputElement( div ) ).toBe( false );
		} );
	} );

	describe( 'handleKeyDown', () => {
		it( 'should ignore shortcuts in INPUT elements', () => {
			const input = document.createElement( 'input' );
			const event = createKeyEvent( 'Delete', { target: input } );

			eventManager.handleKeyDown( event );

			expect( mockEditor.deleteSelected ).not.toHaveBeenCalled();
		} );

		it( 'should ignore shortcuts in TEXTAREA elements', () => {
			const textarea = document.createElement( 'textarea' );
			const event = createKeyEvent( 's', { ctrlKey: true, target: textarea } );

			eventManager.handleKeyDown( event );

			expect( mockEditor.save ).not.toHaveBeenCalled();
		} );

		it( 'should handle Ctrl+Z for undo', () => {
			const event = createKeyEvent( 'z', { ctrlKey: true } );

			eventManager.handleKeyDown( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.undo ).toHaveBeenCalled();
		} );

		it( 'should handle Ctrl+Y for redo', () => {
			const event = createKeyEvent( 'y', { ctrlKey: true } );

			eventManager.handleKeyDown( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.redo ).toHaveBeenCalled();
		} );

		it( 'should handle Ctrl+Shift+Z for redo', () => {
			const event = createKeyEvent( 'z', { ctrlKey: true, shiftKey: true } );

			eventManager.handleKeyDown( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.redo ).toHaveBeenCalled();
		} );

		it( 'should handle Ctrl+S for save', () => {
			const event = createKeyEvent( 's', { ctrlKey: true } );

			eventManager.handleKeyDown( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.save ).toHaveBeenCalled();
		} );

		it( 'should handle Delete key', () => {
			const event = createKeyEvent( 'Delete' );

			eventManager.handleKeyDown( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.deleteSelected ).toHaveBeenCalled();
		} );

		it( 'should handle Backspace key', () => {
			const event = createKeyEvent( 'Backspace' );

			eventManager.handleKeyDown( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.deleteSelected ).toHaveBeenCalled();
		} );

		it( 'should handle Ctrl+D for duplicate', () => {
			const event = createKeyEvent( 'd', { ctrlKey: true } );

			eventManager.handleKeyDown( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.duplicateSelected ).toHaveBeenCalled();
		} );

		it( 'should handle Escape key', () => {
			const event = createKeyEvent( 'Escape' );

			eventManager.handleKeyDown( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.cancel ).toHaveBeenCalledWith( true );
		} );

		it( 'should handle metaKey (Mac Cmd) for shortcuts', () => {
			const event = createKeyEvent( 's', { metaKey: true } );

			eventManager.handleKeyDown( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockEditor.save ).toHaveBeenCalled();
		} );
	} );

	describe( 'handleUndo', () => {
		it( 'should call editor.undo (renderLayers/markDirty are called by restoreState)', () => {
			mockEditor.undo.mockReturnValue( true );

			eventManager.handleUndo();

			expect( mockEditor.undo ).toHaveBeenCalled();
			// Note: renderLayers and markDirty are NOT called here anymore
			// They are called by HistoryManager.restoreState() to avoid double-render
			expect( mockEditor.renderLayers ).not.toHaveBeenCalled();
			expect( mockEditor.markDirty ).not.toHaveBeenCalled();
		} );

		it( 'should call undo regardless of return value', () => {
			mockEditor.undo.mockReturnValue( false );

			eventManager.handleUndo();

			expect( mockEditor.undo ).toHaveBeenCalled();
		} );

		it( 'should handle missing undo method', () => {
			eventManager.editor.undo = undefined;

			expect( () => eventManager.handleUndo() ).not.toThrow();
		} );
	} );

	describe( 'handleRedo', () => {
		it( 'should call editor.redo (renderLayers/markDirty are called by restoreState)', () => {
			mockEditor.redo.mockReturnValue( true );

			eventManager.handleRedo();

			expect( mockEditor.redo ).toHaveBeenCalled();
			// Note: renderLayers and markDirty are NOT called here anymore
			// They are called by HistoryManager.restoreState() to avoid double-render
			expect( mockEditor.renderLayers ).not.toHaveBeenCalled();
			expect( mockEditor.markDirty ).not.toHaveBeenCalled();
		} );

		it( 'should call redo regardless of return value', () => {
			mockEditor.redo.mockReturnValue( false );

			eventManager.handleRedo();

			expect( mockEditor.redo ).toHaveBeenCalled();
		} );

		it( 'should handle missing redo method', () => {
			eventManager.editor.redo = undefined;

			expect( () => eventManager.handleRedo() ).not.toThrow();
		} );
	} );

	describe( 'handleArrowKeyNudge', () => {
		let mockSelectionManager;
		let mockLayer;

		beforeEach( () => {
			mockLayer = { id: 'layer1', x: 100, y: 100, locked: false };
			mockSelectionManager = {
				getSelectedLayers: jest.fn( () => [ mockLayer ] )
			};
			mockEditor.canvasManager.selectionManager = mockSelectionManager;
			mockEditor.stateManager = {};
			mockEditor.historyManager = {
				snapshot: jest.fn()
			};
			mockEditor.updateStatusBar = jest.fn();
		} );

		it( 'should return false for non-arrow keys', () => {
			const event = createKeyEvent( 'a' );
			const result = eventManager.handleArrowKeyNudge( event );

			expect( result ).toBe( false );
			expect( event.preventDefault ).not.toHaveBeenCalled();
		} );

		it( 'should return false when no layers are selected', () => {
			mockSelectionManager.getSelectedLayers.mockReturnValue( [] );
			const event = createKeyEvent( 'ArrowLeft' );

			const result = eventManager.handleArrowKeyNudge( event );

			expect( result ).toBe( false );
			expect( event.preventDefault ).not.toHaveBeenCalled();
		} );

		it( 'should nudge left by 1px with ArrowLeft', () => {
			const event = createKeyEvent( 'ArrowLeft' );

			const result = eventManager.handleArrowKeyNudge( event );

			expect( result ).toBe( true );
			expect( event.preventDefault ).toHaveBeenCalled();
			expect( mockLayer.x ).toBe( 99 );
			expect( mockLayer.y ).toBe( 100 );
		} );

		it( 'should nudge right by 1px with ArrowRight', () => {
			const event = createKeyEvent( 'ArrowRight' );

			const result = eventManager.handleArrowKeyNudge( event );

			expect( result ).toBe( true );
			expect( mockLayer.x ).toBe( 101 );
			expect( mockLayer.y ).toBe( 100 );
		} );

		it( 'should nudge up by 1px with ArrowUp', () => {
			const event = createKeyEvent( 'ArrowUp' );

			const result = eventManager.handleArrowKeyNudge( event );

			expect( result ).toBe( true );
			expect( mockLayer.x ).toBe( 100 );
			expect( mockLayer.y ).toBe( 99 );
		} );

		it( 'should nudge down by 1px with ArrowDown', () => {
			const event = createKeyEvent( 'ArrowDown' );

			const result = eventManager.handleArrowKeyNudge( event );

			expect( result ).toBe( true );
			expect( mockLayer.x ).toBe( 100 );
			expect( mockLayer.y ).toBe( 101 );
		} );

		it( 'should nudge by 10px when Shift is held', () => {
			const event = createKeyEvent( 'ArrowRight', { shiftKey: true } );

			const result = eventManager.handleArrowKeyNudge( event );

			expect( result ).toBe( true );
			expect( mockLayer.x ).toBe( 110 );
		} );

		it( 'should not nudge locked layers', () => {
			mockLayer.locked = true;
			const event = createKeyEvent( 'ArrowRight' );

			eventManager.handleArrowKeyNudge( event );

			expect( mockLayer.x ).toBe( 100 ); // unchanged
		} );

		it( 'should record history snapshot after nudge', () => {
			const event = createKeyEvent( 'ArrowRight' );

			eventManager.handleArrowKeyNudge( event );

			expect( mockEditor.historyManager.snapshot ).toHaveBeenCalledWith( 'nudge' );
		} );

		it( 'should mark editor as dirty and re-render', () => {
			const event = createKeyEvent( 'ArrowRight' );

			eventManager.handleArrowKeyNudge( event );

			expect( mockEditor.markDirty ).toHaveBeenCalled();
			expect( mockEditor.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should update status bar for single layer selection', () => {
			const event = createKeyEvent( 'ArrowRight' );

			eventManager.handleArrowKeyNudge( event );

			expect( mockEditor.updateStatusBar ).toHaveBeenCalled();
		} );

		it( 'should return false when selectionManager is missing', () => {
			mockEditor.canvasManager.selectionManager = null;
			const event = createKeyEvent( 'ArrowLeft' );

			const result = eventManager.handleArrowKeyNudge( event );

			expect( result ).toBe( false );
		} );

		it( 'should handle layers with undefined x/y', () => {
			mockLayer.x = undefined;
			mockLayer.y = undefined;
			const event = createKeyEvent( 'ArrowRight' );

			eventManager.handleArrowKeyNudge( event );

			expect( mockLayer.x ).toBe( 1 );
			expect( mockLayer.y ).toBe( 0 );
		} );
	} );

	describe( 'nudgeSelectedLayers', () => {
		let mockSelectionManager;
		let mockLayers;

		beforeEach( () => {
			mockLayers = [
				{ id: 'layer1', x: 100, y: 100, locked: false },
				{ id: 'layer2', x: 200, y: 200, locked: false }
			];
			mockSelectionManager = {
				getSelectedLayers: jest.fn( () => mockLayers )
			};
			mockEditor.canvasManager.selectionManager = mockSelectionManager;
			mockEditor.stateManager = {};
			mockEditor.historyManager = {
				snapshot: jest.fn()
			};
		} );

		it( 'should nudge multiple layers', () => {
			eventManager.nudgeSelectedLayers( 5, -3 );

			expect( mockLayers[ 0 ].x ).toBe( 105 );
			expect( mockLayers[ 0 ].y ).toBe( 97 );
			expect( mockLayers[ 1 ].x ).toBe( 205 );
			expect( mockLayers[ 1 ].y ).toBe( 197 );
		} );

		it( 'should skip locked layers', () => {
			mockLayers[ 1 ].locked = true;

			eventManager.nudgeSelectedLayers( 10, 10 );

			expect( mockLayers[ 0 ].x ).toBe( 110 );
			expect( mockLayers[ 1 ].x ).toBe( 200 ); // unchanged
		} );

		it( 'should handle missing stateManager gracefully', () => {
			mockEditor.stateManager = null;

			expect( () => eventManager.nudgeSelectedLayers( 5, 5 ) ).not.toThrow();
		} );

		it( 'should handle missing historyManager gracefully', () => {
			mockEditor.historyManager = null;

			expect( () => eventManager.nudgeSelectedLayers( 5, 5 ) ).not.toThrow();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should remove all registered listeners', () => {
			const mockTarget = {
				addEventListener: jest.fn(),
				removeEventListener: jest.fn()
			};

			eventManager.registerListener( mockTarget, 'click', jest.fn() );
			eventManager.registerListener( mockTarget, 'mousemove', jest.fn() );

			eventManager.destroy();

			expect( mockTarget.removeEventListener ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'should clear listeners array', () => {
			eventManager.destroy();

			expect( eventManager.listeners ).toEqual( [] );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export EventManager to window.Layers.Core', () => {
			expect( window.Layers.Core.EventManager ).toBe( EventManager );
		} );
	} );
} );
