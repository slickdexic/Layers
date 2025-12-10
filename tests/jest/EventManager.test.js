/**
 * Tests for EventManager module
 */

const { EventManager } = ( () => {
	require( '../../resources/ext.layers.editor/EventManager.js' );
	return { EventManager: window.EventManager };
} )();

describe( 'EventManager', () => {
	let eventManager;
	let mockEditor;

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

		it( 'should set up global handlers', () => {
			// Should have registered resize, beforeunload, and keydown
			expect( eventManager.listeners.length ).toBeGreaterThanOrEqual( 3 );
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
		const createKeyEvent = ( key, options = {} ) => ( {
			key,
			ctrlKey: options.ctrlKey || false,
			metaKey: options.metaKey || false,
			shiftKey: options.shiftKey || false,
			target: options.target || document.createElement( 'div' ),
			preventDefault: jest.fn()
		} );

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
		it( 'should call editor.undo and renderLayers on success', () => {
			mockEditor.undo.mockReturnValue( true );

			eventManager.handleUndo();

			expect( mockEditor.undo ).toHaveBeenCalled();
			expect( mockEditor.renderLayers ).toHaveBeenCalled();
			expect( mockEditor.markDirty ).toHaveBeenCalled();
		} );

		it( 'should not render when undo returns false', () => {
			mockEditor.undo.mockReturnValue( false );

			eventManager.handleUndo();

			expect( mockEditor.undo ).toHaveBeenCalled();
			expect( mockEditor.renderLayers ).not.toHaveBeenCalled();
		} );

		it( 'should handle missing undo method', () => {
			eventManager.editor.undo = undefined;

			expect( () => eventManager.handleUndo() ).not.toThrow();
		} );

		it( 'should handle missing renderLayers method', () => {
			mockEditor.undo.mockReturnValue( true );
			eventManager.editor.renderLayers = undefined;

			expect( () => eventManager.handleUndo() ).not.toThrow();
		} );

		it( 'should handle missing markDirty method', () => {
			mockEditor.undo.mockReturnValue( true );
			eventManager.editor.markDirty = undefined;

			expect( () => eventManager.handleUndo() ).not.toThrow();
		} );
	} );

	describe( 'handleRedo', () => {
		it( 'should call editor.redo and renderLayers on success', () => {
			mockEditor.redo.mockReturnValue( true );

			eventManager.handleRedo();

			expect( mockEditor.redo ).toHaveBeenCalled();
			expect( mockEditor.renderLayers ).toHaveBeenCalled();
			expect( mockEditor.markDirty ).toHaveBeenCalled();
		} );

		it( 'should not render when redo returns false', () => {
			mockEditor.redo.mockReturnValue( false );

			eventManager.handleRedo();

			expect( mockEditor.redo ).toHaveBeenCalled();
			expect( mockEditor.renderLayers ).not.toHaveBeenCalled();
		} );

		it( 'should handle missing redo method', () => {
			eventManager.editor.redo = undefined;

			expect( () => eventManager.handleRedo() ).not.toThrow();
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

		it( 'should export EventManager to window for backward compatibility', () => {
			expect( window.EventManager ).toBe( EventManager );
		} );
	} );
} );
