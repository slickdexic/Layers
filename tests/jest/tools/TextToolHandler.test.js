/**
 * Tests for TextToolHandler
 *
 * @jest-environment jsdom
 */

/* eslint-disable no-unused-vars */
'use strict';

// Set up window.Layers namespace before requiring the module
window.Layers = window.Layers || {};
window.Layers.Tools = window.Layers.Tools || {};

const TextToolHandler = require( '../../../resources/ext.layers.editor/tools/TextToolHandler.js' );

describe( 'TextToolHandler', () => {
	let handler;
	let mockCanvasManager;
	let mockStyleManager;
	let addedLayers;

	beforeEach( () => {
		// Reset added layers
		addedLayers = [];

		// Mock canvas manager
		mockCanvasManager = {
			ctx: {
				save: jest.fn(),
				restore: jest.fn()
			},
			container: document.createElement( 'div' ),
			editor: {
				ui: {
					mainContainer: document.createElement( 'div' )
				}
			}
		};

		// Mock style manager
		mockStyleManager = {
			get: jest.fn( () => ( {
				fontSize: 16,
				fontFamily: 'Arial, sans-serif',
				color: '#ff0000'
			} ) )
		};

		// Create handler
		handler = new TextToolHandler( {
			canvasManager: mockCanvasManager,
			styleManager: mockStyleManager,
			addLayerCallback: ( layer ) => addedLayers.push( layer )
		} );

		// Append container to document for DOM operations
		document.body.appendChild( mockCanvasManager.editor.ui.mainContainer );
	} );

	afterEach( () => {
		if ( handler ) {
			handler.destroy();
		}
		// Clean up DOM
		if ( mockCanvasManager.editor.ui.mainContainer.parentNode ) {
			mockCanvasManager.editor.ui.mainContainer.parentNode.removeChild(
				mockCanvasManager.editor.ui.mainContainer
			);
		}
	} );

	describe( 'constructor', () => {
		it( 'should initialize with provided config', () => {
			expect( handler.canvasManager ).toBe( mockCanvasManager );
			expect( handler.styleManager ).toBe( mockStyleManager );
			expect( handler.textEditor ).toBeNull();
		} );

		it( 'should handle missing config gracefully', () => {
			const emptyHandler = new TextToolHandler( {} );
			expect( emptyHandler.canvasManager ).toBeNull();
			expect( emptyHandler.styleManager ).toBeNull();
			emptyHandler.destroy();
		} );
	} );

	describe( 'start', () => {
		it( 'should call showTextEditor with the point', () => {
			const showSpy = jest.spyOn( handler, 'showTextEditor' );
			const point = { x: 100, y: 200 };
			handler.start( point );
			expect( showSpy ).toHaveBeenCalledWith( point );
		} );
	} );

	describe( 'showTextEditor', () => {
		it( 'should create an input element', () => {
			handler.showTextEditor( { x: 50, y: 75 } );
			expect( handler.textEditor ).toBeInstanceOf( HTMLInputElement );
			expect( handler.textEditor.type ).toBe( 'text' );
		} );

		it( 'should position the input at the click point', () => {
			handler.showTextEditor( { x: 50, y: 75 } );
			expect( handler.textEditor.style.left ).toBe( '50px' );
			expect( handler.textEditor.style.top ).toBe( '75px' );
		} );

		it( 'should apply styles from style manager', () => {
			handler.showTextEditor( { x: 50, y: 75 } );
			expect( handler.textEditor.style.fontSize ).toBe( '16px' );
			expect( handler.textEditor.style.fontFamily ).toBe( 'Arial, sans-serif' );
			expect( handler.textEditor.style.color ).toBe( 'rgb(255, 0, 0)' );
		} );

		it( 'should append to editor container', () => {
			handler.showTextEditor( { x: 50, y: 75 } );
			expect( mockCanvasManager.editor.ui.mainContainer.contains( handler.textEditor ) ).toBe( true );
		} );

		it( 'should hide previous editor before showing new one', () => {
			handler.showTextEditor( { x: 50, y: 75 } );
			const firstEditor = handler.textEditor;
			handler.showTextEditor( { x: 100, y: 150 } );
			expect( handler.textEditor ).not.toBe( firstEditor );
			expect( firstEditor.parentNode ).toBeNull();
		} );
	} );

	describe( 'hideTextEditor', () => {
		it( 'should remove the text editor from DOM', () => {
			handler.showTextEditor( { x: 50, y: 75 } );
			const editor = handler.textEditor;
			handler.hideTextEditor();
			expect( handler.textEditor ).toBeNull();
			expect( editor.parentNode ).toBeNull();
		} );

		it( 'should handle case when no editor exists', () => {
			expect( () => handler.hideTextEditor() ).not.toThrow();
		} );
	} );

	describe( 'finishTextEditing', () => {
		it( 'should create a text layer when text is entered', () => {
			const input = document.createElement( 'input' );
			input.value = 'Test text';
			const point = { x: 100, y: 200 };

			handler.finishTextEditing( input, point );

			expect( addedLayers ).toHaveLength( 1 );
			expect( addedLayers[ 0 ] ).toMatchObject( {
				type: 'text',
				x: 100,
				y: 200,
				text: 'Test text',
				fontSize: 16,
				fontFamily: 'Arial, sans-serif',
				color: '#ff0000'
			} );
		} );

		it( 'should not create layer for empty text', () => {
			const input = document.createElement( 'input' );
			input.value = '   ';
			const point = { x: 100, y: 200 };

			handler.finishTextEditing( input, point );

			expect( addedLayers ).toHaveLength( 0 );
		} );

		it( 'should trim whitespace from text', () => {
			const input = document.createElement( 'input' );
			input.value = '  Hello World  ';
			const point = { x: 100, y: 200 };

			handler.finishTextEditing( input, point );

			expect( addedLayers[ 0 ].text ).toBe( 'Hello World' );
		} );

		it( 'should hide the text editor after finishing', () => {
			handler.showTextEditor( { x: 50, y: 75 } );
			const input = handler.textEditor;
			input.value = 'Test';
			handler.finishTextEditing( input, { x: 50, y: 75 } );
			expect( handler.textEditor ).toBeNull();
		} );
	} );

	describe( 'isEditing', () => {
		it( 'should return false when not editing', () => {
			expect( handler.isEditing() ).toBe( false );
		} );

		it( 'should return true when editing', () => {
			handler.showTextEditor( { x: 50, y: 75 } );
			expect( handler.isEditing() ).toBe( true );
		} );

		it( 'should return false after hiding editor', () => {
			handler.showTextEditor( { x: 50, y: 75 } );
			handler.hideTextEditor();
			expect( handler.isEditing() ).toBe( false );
		} );
	} );

	describe( 'keyboard events', () => {
		it( 'should finish editing on Enter key', () => {
			const point = { x: 50, y: 75 };
			handler.showTextEditor( point );
			handler.textEditor.value = 'Enter test';

			const event = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			handler.textEditor.dispatchEvent( event );

			expect( addedLayers ).toHaveLength( 1 );
			expect( addedLayers[ 0 ].text ).toBe( 'Enter test' );
		} );

		it( 'should cancel on Escape key', () => {
			handler.showTextEditor( { x: 50, y: 75 } );
			handler.textEditor.value = 'Escape test';

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			handler.textEditor.dispatchEvent( event );

			expect( handler.textEditor ).toBeNull();
			expect( addedLayers ).toHaveLength( 0 );
		} );

		it( 'should finish editing on blur event (clicking away)', () => {
			const point = { x: 50, y: 75 };
			handler.showTextEditor( point );
			handler.textEditor.value = 'Blur test';

			const event = new FocusEvent( 'blur' );
			handler.textEditor.dispatchEvent( event );

			expect( addedLayers ).toHaveLength( 1 );
			expect( addedLayers[ 0 ].text ).toBe( 'Blur test' );
		} );

		it( 'should not create layer when blur with empty text', () => {
			const point = { x: 50, y: 75 };
			handler.showTextEditor( point );
			handler.textEditor.value = '';

			const event = new FocusEvent( 'blur' );
			handler.textEditor.dispatchEvent( event );

			expect( addedLayers ).toHaveLength( 0 );
		} );
	} );

	describe( '_getCurrentStyle fallbacks', () => {
		it( 'should use styleManager.get() when available', () => {
			const style = handler._getCurrentStyle();
			expect( mockStyleManager.get ).toHaveBeenCalled();
			expect( style.color ).toBe( '#ff0000' );
		} );

		it( 'should fall back to currentStyle property', () => {
			handler.styleManager = { currentStyle: { fontSize: 24, color: '#00ff00' } };
			const style = handler._getCurrentStyle();
			expect( style.fontSize ).toBe( 24 );
			expect( style.color ).toBe( '#00ff00' );
		} );

		it( 'should use defaults when no style manager', () => {
			handler.styleManager = null;
			const style = handler._getCurrentStyle();
			expect( style.fontSize ).toBe( 16 );
			expect( style.fontFamily ).toBe( 'Arial, sans-serif' );
			expect( style.color ).toBe( '#000000' );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up all resources', () => {
			handler.showTextEditor( { x: 50, y: 75 } );
			handler.destroy();
			expect( handler.textEditor ).toBeNull();
			expect( handler.canvasManager ).toBeNull();
			expect( handler.styleManager ).toBeNull();
			expect( handler.addLayerCallback ).toBeNull();
		} );

		it( 'should not throw when called multiple times', () => {
			handler.destroy();
			expect( () => handler.destroy() ).not.toThrow();
		} );
	} );

	describe( '_getEditorContainer', () => {
		it( 'should prefer mainContainer', () => {
			const container = handler._getEditorContainer();
			expect( container ).toBe( mockCanvasManager.editor.ui.mainContainer );
		} );

		it( 'should fall back to canvas container', () => {
			handler.canvasManager = { container: document.createElement( 'div' ) };
			const container = handler._getEditorContainer();
			expect( container ).toBe( handler.canvasManager.container );
		} );

		it( 'should fall back to document.body', () => {
			handler.canvasManager = null;
			const container = handler._getEditorContainer();
			expect( container ).toBe( document.body );
		} );
	} );

	describe( 'mobile keyboard handling', () => {
		it( 'should set mobile-friendly input attributes', () => {
			handler.showTextEditor( { x: 100, y: 100 } );

			const input = handler.textEditor;
			expect( input.getAttribute( 'inputmode' ) ).toBe( 'text' );
			expect( input.getAttribute( 'enterkeyhint' ) ).toBe( 'done' );
			expect( input.getAttribute( 'autocomplete' ) ).toBe( 'off' );
			expect( input.getAttribute( 'autocorrect' ) ).toBe( 'off' );
			expect( input.getAttribute( 'autocapitalize' ) ).toBe( 'sentences' );
		} );

		it( 'should store original point for keyboard adjustment', () => {
			const point = { x: 150, y: 200 };
			handler.showTextEditor( point );

			expect( handler._originalPoint ).toEqual( point );
		} );

		it( 'should setup keyboard handler when visualViewport available', () => {
			// Mock visualViewport
			const mockVisualViewport = {
				addEventListener: jest.fn(),
				removeEventListener: jest.fn(),
				height: 800,
				offsetTop: 0
			};
			window.visualViewport = mockVisualViewport;

			handler.showTextEditor( { x: 100, y: 100 } );

			expect( mockVisualViewport.addEventListener ).toHaveBeenCalledWith(
				'resize',
				expect.any( Function )
			);
			expect( mockVisualViewport.addEventListener ).toHaveBeenCalledWith(
				'scroll',
				expect.any( Function )
			);

			// Cleanup
			delete window.visualViewport;
		} );

		it( 'should remove keyboard handler on hide', () => {
			const mockVisualViewport = {
				addEventListener: jest.fn(),
				removeEventListener: jest.fn(),
				height: 800,
				offsetTop: 0
			};
			window.visualViewport = mockVisualViewport;

			handler.showTextEditor( { x: 100, y: 100 } );
			handler.hideTextEditor();

			expect( mockVisualViewport.removeEventListener ).toHaveBeenCalledWith(
				'resize',
				expect.any( Function )
			);
			expect( mockVisualViewport.removeEventListener ).toHaveBeenCalledWith(
				'scroll',
				expect.any( Function )
			);
			expect( handler._viewportHandler ).toBeNull();
			expect( handler._originalPoint ).toBeNull();

			// Cleanup
			delete window.visualViewport;
		} );

		it( 'should clear original point on hide', () => {
			handler.showTextEditor( { x: 100, y: 100 } );
			expect( handler._originalPoint ).toBeDefined();

			handler.hideTextEditor();
			expect( handler._originalPoint ).toBeNull();
		} );

		it( 'should handle missing visualViewport gracefully', () => {
			// Ensure visualViewport is not defined
			delete window.visualViewport;

			expect( () => {
				handler.showTextEditor( { x: 100, y: 100 } );
			} ).not.toThrow();

			expect( handler._viewportHandler ).toBeUndefined();
		} );

		it( '_adjustForKeyboard should handle missing input gracefully', () => {
			expect( () => {
				handler._adjustForKeyboard( null );
			} ).not.toThrow();
		} );

		it( '_adjustForKeyboard should handle missing visualViewport gracefully', () => {
			delete window.visualViewport;
			const input = document.createElement( 'input' );

			expect( () => {
				handler._adjustForKeyboard( input );
			} ).not.toThrow();
		} );

		it( '_removeKeyboardHandler should handle missing handler gracefully', () => {
			handler._viewportHandler = null;

			expect( () => {
				handler._removeKeyboardHandler();
			} ).not.toThrow();
		} );
	} );
} );