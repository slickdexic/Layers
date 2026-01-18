/**
 * Tests for InlineTextEditor
 *
 * InlineTextEditor provides inline text editing on the canvas for text and textbox layers.
 * It uses an HTML textarea overlay that appears when a user double-clicks on a text layer.
 */

'use strict';

const InlineTextEditor = require( '../../../resources/ext.layers.editor/canvas/InlineTextEditor.js' );

describe( 'InlineTextEditor', () => {
	let mockCanvasManager;
	let mockCanvas;
	let mockContainer;
	let editor;

	beforeEach( () => {
		// Mock canvas element
		mockCanvas = {
			width: 800,
			height: 600,
			style: {},
			getBoundingClientRect: jest.fn( () => ( {
				left: 100,
				top: 100,
				width: 800,
				height: 600
			} ) )
		};

		// Mock container
		mockContainer = {
			appendChild: jest.fn(),
			removeChild: jest.fn(),
			style: {}
		};

		// Mock CanvasManager
		mockCanvasManager = {
			canvas: mockCanvas,
			container: mockContainer,
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			},
			editor: {
				layers: []
			},
			zoom: 1.0,
			panX: 0,
			panY: 0,
			setTextEditingMode: jest.fn(),
			saveState: jest.fn(),
			redraw: jest.fn(),
			renderLayers: jest.fn(),
			isDestroyed: false
		};

		// Create instance
		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		jest.clearAllMocks();
	} );

	describe( 'Constructor', () => {
		test( 'should create InlineTextEditor with canvasManager reference', () => {
			expect( editor ).toBeDefined();
			expect( editor.canvasManager ).toBe( mockCanvasManager );
		} );

		test( 'should initialize with editing state false', () => {
			expect( editor.isEditing ).toBe( false );
		} );

		test( 'should initialize with null editingLayer', () => {
			expect( editor.editingLayer ).toBeNull();
		} );

		test( 'should initialize with null editorElement', () => {
			expect( editor.editorElement ).toBeNull();
		} );
	} );

	describe( 'canEdit', () => {
		test( 'should return true for text layer type', () => {
			const layer = { type: 'text', text: 'Hello' };
			expect( editor.canEdit( layer ) ).toBe( true );
		} );

		test( 'should return true for textbox layer type', () => {
			const layer = { type: 'textbox', text: 'Hello' };
			expect( editor.canEdit( layer ) ).toBe( true );
		} );

		test( 'should return false for rectangle layer type', () => {
			const layer = { type: 'rectangle' };
			expect( editor.canEdit( layer ) ).toBe( false );
		} );

		test( 'should return false for arrow layer type', () => {
			const layer = { type: 'arrow' };
			expect( editor.canEdit( layer ) ).toBe( false );
		} );

		test( 'should return false for null layer', () => {
			expect( editor.canEdit( null ) ).toBe( false );
		} );

		test( 'should return false for undefined layer', () => {
			expect( editor.canEdit( undefined ) ).toBe( false );
		} );

		test( 'should return false for layer without type', () => {
			const layer = { text: 'Hello' };
			expect( editor.canEdit( layer ) ).toBe( false );
		} );

		test( 'should return false for locked text layer', () => {
			const layer = { type: 'text', text: 'Hello', locked: true };
			expect( editor.canEdit( layer ) ).toBe( false );
		} );
	} );

	describe( 'startEditing', () => {
		let textLayer;

		beforeEach( () => {
			textLayer = {
				id: 'layer-1',
				type: 'text',
				text: 'Hello World',
				x: 100,
				y: 100,
				fontSize: 16,
				fontFamily: 'Arial',
				color: '#000000'
			};
		} );

		test( 'should return false for non-editable layer', () => {
			const result = editor.startEditing( { type: 'rectangle' } );
			expect( result ).toBe( false );
		} );

		test( 'should return false for null layer', () => {
			const result = editor.startEditing( null );
			expect( result ).toBe( false );
		} );

		test( 'should return false when already editing', () => {
			editor.isEditing = true;
			const result = editor.startEditing( textLayer );
			expect( result ).toBe( false );
		} );

		test( 'should set isEditing to true when starting', () => {
			editor.startEditing( textLayer );
			expect( editor.isEditing ).toBe( true );
		} );

		test( 'should store editingLayer reference', () => {
			editor.startEditing( textLayer );
			expect( editor.editingLayer ).toBe( textLayer );
		} );

		test( 'should store original text for cancel support', () => {
			editor.startEditing( textLayer );
			expect( editor.originalText ).toBe( 'Hello World' );
		} );

		test( 'should call setTextEditingMode on canvas manager', () => {
			editor.startEditing( textLayer );
			expect( mockCanvasManager.setTextEditingMode ).toHaveBeenCalledWith( true );
		} );

		test( 'should create editor element', () => {
			editor.startEditing( textLayer );
			expect( editor.editorElement ).toBeDefined();
			expect( editor.editorElement ).not.toBeNull();
		} );

		test( 'should set editor element value to layer text', () => {
			editor.startEditing( textLayer );
			expect( editor.editorElement.value ).toBe( 'Hello World' );
		} );

		test( 'should handle empty text gracefully', () => {
			textLayer.text = '';
			editor.startEditing( textLayer );
			expect( editor.editorElement.value ).toBe( '' );
		} );

		test( 'should handle undefined text gracefully', () => {
			delete textLayer.text;
			editor.startEditing( textLayer );
			expect( editor.editorElement.value ).toBe( '' );
		} );

		test( 'should append editor element to container', () => {
			editor.startEditing( textLayer );
			expect( mockContainer.appendChild ).toHaveBeenCalled();
		} );
	} );

	describe( 'startEditing - textbox layer', () => {
		let textboxLayer;

		beforeEach( () => {
			textboxLayer = {
				id: 'layer-2',
				type: 'textbox',
				text: 'Multiline\nText',
				x: 100,
				y: 100,
				width: 200,
				height: 100,
				fontSize: 14,
				fontFamily: 'Arial',
				fill: '#ffffff',
				color: '#000000'
			};
		} );

		test( 'should start editing textbox layer successfully', () => {
			const result = editor.startEditing( textboxLayer );
			expect( result ).toBe( true );
			expect( editor.isEditing ).toBe( true );
		} );

		test( 'should preserve multiline text', () => {
			editor.startEditing( textboxLayer );
			expect( editor.editorElement.value ).toBe( 'Multiline\nText' );
		} );

		test( 'should add textbox class to editor element', () => {
			editor.startEditing( textboxLayer );
			expect( editor.editorElement.classList.contains( 'textbox' ) ).toBe( true );
		} );
	} );

	describe( 'finishEditing', () => {
		let textLayer;

		beforeEach( () => {
			textLayer = {
				id: 'layer-1',
				type: 'text',
				text: 'Original',
				x: 100,
				y: 100,
				fontSize: 16
			};
			mockCanvasManager.editor.layers = [ textLayer ];
			editor.startEditing( textLayer );
		} );

		test( 'should set isEditing to false', () => {
			editor.finishEditing( true );
			expect( editor.isEditing ).toBe( false );
		} );

		test( 'should call setTextEditingMode(false) on canvas manager', () => {
			mockCanvasManager.setTextEditingMode.mockClear();
			editor.finishEditing( true );
			expect( mockCanvasManager.setTextEditingMode ).toHaveBeenCalledWith( false );
		} );

		test( 'should clear editingLayer reference', () => {
			editor.finishEditing( true );
			expect( editor.editingLayer ).toBeNull();
		} );

		test( 'should remove editor element from DOM', () => {
			editor.finishEditing( true );
			// _removeEditor nulls out editorElement after removing
			expect( editor.editorElement ).toBeNull();
		} );

		test( 'should update layer text when saving', () => {
			editor.editorElement.value = 'Modified Text';
			editor.finishEditing( true );
			expect( textLayer.text ).toBe( 'Modified Text' );
		} );

		test( 'should restore original text when canceling', () => {
			editor.editorElement.value = 'Modified Text';
			editor.finishEditing( false );
			expect( textLayer.text ).toBe( 'Original' );
		} );

		test( 'should call saveState when saving with changes', () => {
			editor.editorElement.value = 'Modified Text';
			editor.finishEditing( true );
			expect( mockCanvasManager.saveState ).toHaveBeenCalled();
		} );

		test( 'should not call saveState when canceling', () => {
			mockCanvasManager.saveState.mockClear();
			editor.editorElement.value = 'Modified Text';
			editor.finishEditing( false );
			expect( mockCanvasManager.saveState ).not.toHaveBeenCalled();
		} );

		test( 'should call renderLayers after finishing', () => {
			editor.editorElement.value = 'Modified Text';
			editor.finishEditing( true );
			expect( mockCanvasManager.renderLayers ).toHaveBeenCalled();
		} );

		test( 'should return early when not editing', () => {
			editor.isEditing = false;
			mockCanvasManager.setTextEditingMode.mockClear();
			editor.finishEditing( true );
			expect( mockCanvasManager.setTextEditingMode ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'cancelEditing', () => {
		let textLayer;

		beforeEach( () => {
			textLayer = {
				id: 'layer-1',
				type: 'text',
				text: 'Original',
				x: 100,
				y: 100
			};
			mockCanvasManager.editor.layers = [ textLayer ];
			editor.startEditing( textLayer );
		} );

		test( 'should restore original text', () => {
			editor.editorElement.value = 'Modified';
			editor.cancelEditing();
			expect( textLayer.text ).toBe( 'Original' );
		} );

		test( 'should set isEditing to false', () => {
			editor.cancelEditing();
			expect( editor.isEditing ).toBe( false );
		} );
	} );

	describe( 'Keyboard handling', () => {
		let textLayer;
		let keydownHandler;

		beforeEach( () => {
			textLayer = {
				id: 'layer-1',
				type: 'text',
				text: 'Original',
				x: 100,
				y: 100
			};
			mockCanvasManager.editor.layers = [ textLayer ];
			editor.startEditing( textLayer );

			// Find the keydown handler
			keydownHandler = editor._handleKeyDown;
		} );

		test( 'should have keydown handler attached', () => {
			expect( typeof keydownHandler ).toBe( 'function' );
		} );

		test( 'should call cancelEditing on Escape key', () => {
			const cancelSpy = jest.spyOn( editor, 'cancelEditing' );
			const event = {
				key: 'Escape',
				preventDefault: jest.fn(),
				stopPropagation: jest.fn()
			};

			keydownHandler.call( editor, event );
			expect( cancelSpy ).toHaveBeenCalled();
		} );

		test( 'should call finishEditing on Ctrl+Enter for text layer', () => {
			const finishSpy = jest.spyOn( editor, 'finishEditing' );
			const event = {
				key: 'Enter',
				ctrlKey: true,
				preventDefault: jest.fn(),
				stopPropagation: jest.fn()
			};

			keydownHandler.call( editor, event );
			expect( finishSpy ).toHaveBeenCalledWith( true );
		} );

		test( 'should call finishEditing on Enter for simple text layer', () => {
			const finishSpy = jest.spyOn( editor, 'finishEditing' );
			const event = {
				key: 'Enter',
				ctrlKey: false,
				shiftKey: false,
				preventDefault: jest.fn(),
				stopPropagation: jest.fn()
			};

			keydownHandler.call( editor, event );
			expect( finishSpy ).toHaveBeenCalledWith( true );
		} );

		test( 'should allow Enter for textbox layer without modifiers', () => {
			// Create textbox layer
			const textboxLayer = {
				id: 'layer-2',
				type: 'textbox',
				text: 'Line 1',
				x: 100,
				y: 100,
				width: 200,
				height: 100
			};
			mockCanvasManager.editor.layers = [ textboxLayer ];

			// Restart with textbox
			editor.finishEditing( false );
			editor.startEditing( textboxLayer );

			const finishSpy = jest.spyOn( editor, 'finishEditing' );
			const event = {
				key: 'Enter',
				ctrlKey: false,
				shiftKey: false,
				preventDefault: jest.fn(),
				stopPropagation: jest.fn()
			};

			editor._handleKeyDown.call( editor, event );
			// For textbox, Enter should NOT finish editing (allows newlines)
			expect( finishSpy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'destroy', () => {
		test( 'should clean up editor element if present', () => {
			editor.startEditing( { type: 'text', text: 'Test', x: 0, y: 0 } );
			editor.destroy();
			expect( editor.editorElement ).toBeNull();
		} );

		test( 'should set isEditing to false', () => {
			editor.startEditing( { type: 'text', text: 'Test', x: 0, y: 0 } );
			editor.destroy();
			expect( editor.isEditing ).toBe( false );
		} );

		test( 'should handle destroy when not editing', () => {
			// Should not throw
			expect( () => editor.destroy() ).not.toThrow();
		} );

		test( 'should null out canvasManager reference', () => {
			editor.destroy();
			expect( editor.canvasManager ).toBeNull();
		} );
	} );

	describe( 'Edge cases', () => {
		test( 'should handle destroyed canvas manager gracefully', () => {
			mockCanvasManager.isDestroyed = true;
			const result = editor.startEditing( { type: 'text', text: 'Test', x: 0, y: 0 } );
			expect( result ).toBe( false );
		} );

		test( 'should handle missing container', () => {
			delete mockCanvasManager.container;
			const result = editor.startEditing( { type: 'text', text: 'Test', x: 0, y: 0 } );
			expect( result ).toBe( false );
		} );

		test( 'should handle missing canvas', () => {
			delete mockCanvasManager.canvas;
			const result = editor.startEditing( { type: 'text', text: 'Test', x: 0, y: 0 } );
			expect( result ).toBe( false );
		} );

		test( 'should handle very long text', () => {
			const longText = 'A'.repeat( 10000 );
			const layer = { type: 'text', text: longText, x: 0, y: 0 };
			const result = editor.startEditing( layer );
			expect( result ).toBe( true );
			expect( editor.editorElement.value.length ).toBe( 10000 );
		} );

		test( 'should handle special characters in text', () => {
			const specialText = '<script>alert("xss")</script> & "quotes" \'apostrophe\'';
			const layer = { type: 'text', text: specialText, x: 0, y: 0 };
			editor.startEditing( layer );
			expect( editor.editorElement.value ).toBe( specialText );
		} );

		test( 'should handle unicode text', () => {
			const unicodeText = '日本語 中文 🎨🖌️ ñ é ü';
			const layer = { type: 'text', text: unicodeText, x: 0, y: 0 };
			editor.startEditing( layer );
			expect( editor.editorElement.value ).toBe( unicodeText );
		} );
	} );
} );

describe( 'CanvasEvents - Double-click handling', () => {
	let CanvasEvents;
	let mockCanvasManager;
	let mockCanvas;
	let events;

	beforeEach( () => {
		mockCanvas = {
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			style: {},
			width: 800,
			height: 600
		};

		mockCanvasManager = {
			canvas: mockCanvas,
			currentTool: 'pointer',
			isTextEditing: false,
			editor: {
				layers: [
					{ id: 'layer-1', type: 'text', text: 'Hello', x: 100, y: 100, width: 100, height: 30, visible: true },
					{ id: 'layer-2', type: 'rectangle', x: 200, y: 200, width: 100, height: 100, visible: true }
				]
			},
			interactionController: {
				shouldBlockInteraction: jest.fn( () => false )
			},
			inlineTextEditor: {
				startEditing: jest.fn()
			},
			hitTestController: {
				hitTestLayer: jest.fn( ( layer, point ) => {
					const x = layer.x || 0;
					const y = layer.y || 0;
					const w = layer.width || 100;
					const h = layer.height || 50;
					return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h;
				} )
			},
			getMousePoint: jest.fn( ( e ) => ( { x: e.clientX, y: e.clientY } ) )
		};

		CanvasEvents = require( '../../../resources/ext.layers.editor/CanvasEvents.js' );
		events = new CanvasEvents( mockCanvasManager );
	} );

	afterEach( () => {
		if ( events && typeof events.destroy === 'function' ) {
			events.destroy();
		}
		jest.clearAllMocks();
	} );

	test( 'should attach dblclick event listener', () => {
		expect( mockCanvas.addEventListener ).toHaveBeenCalledWith(
			'dblclick',
			expect.any( Function )
		);
	} );

	test( 'should have handleDoubleClick method', () => {
		expect( typeof events.handleDoubleClick ).toBe( 'function' );
	} );

	test( 'should call inlineTextEditor.startEditing on text layer double-click', () => {
		const event = {
			clientX: 120,
			clientY: 110,
			preventDefault: jest.fn()
		};

		events.handleDoubleClick( event );

		expect( mockCanvasManager.inlineTextEditor.startEditing ).toHaveBeenCalledWith(
			expect.objectContaining( { type: 'text' } )
		);
	} );

	test( 'should not start editing on rectangle layer double-click', () => {
		const event = {
			clientX: 250,
			clientY: 250,
			preventDefault: jest.fn()
		};

		events.handleDoubleClick( event );

		expect( mockCanvasManager.inlineTextEditor.startEditing ).not.toHaveBeenCalled();
	} );

	test( 'should not start editing when already editing', () => {
		mockCanvasManager.isTextEditing = true;

		const event = {
			clientX: 120,
			clientY: 110,
			preventDefault: jest.fn()
		};

		events.handleDoubleClick( event );

		expect( mockCanvasManager.inlineTextEditor.startEditing ).not.toHaveBeenCalled();
	} );

	test( 'should not start editing when not using pointer tool', () => {
		mockCanvasManager.currentTool = 'rectangle';

		const event = {
			clientX: 120,
			clientY: 110,
			preventDefault: jest.fn()
		};

		events.handleDoubleClick( event );

		expect( mockCanvasManager.inlineTextEditor.startEditing ).not.toHaveBeenCalled();
	} );

	test( 'should not start editing when interaction is blocked', () => {
		mockCanvasManager.interactionController.shouldBlockInteraction.mockReturnValue( true );

		const event = {
			clientX: 120,
			clientY: 110,
			preventDefault: jest.fn()
		};

		events.handleDoubleClick( event );

		expect( mockCanvasManager.inlineTextEditor.startEditing ).not.toHaveBeenCalled();
	} );

	test( 'should find topmost text layer at point', () => {
		// Add another text layer on top
		mockCanvasManager.editor.layers.push( {
			id: 'layer-3',
			type: 'text',
			text: 'Top Layer',
			x: 90,
			y: 90,
			width: 50,
			height: 30,
			visible: true
		} );

		const event = {
			clientX: 110,
			clientY: 105,
			preventDefault: jest.fn()
		};

		events.handleDoubleClick( event );

		// Should select the topmost layer (layer-3)
		expect( mockCanvasManager.inlineTextEditor.startEditing ).toHaveBeenCalledWith(
			expect.objectContaining( { id: 'layer-3' } )
		);
	} );

	test( 'should skip hidden layers', () => {
		mockCanvasManager.editor.layers[ 0 ].visible = false;

		const event = {
			clientX: 120,
			clientY: 110,
			preventDefault: jest.fn()
		};

		events.handleDoubleClick( event );

		expect( mockCanvasManager.inlineTextEditor.startEditing ).not.toHaveBeenCalled();
	} );

	test( 'should handle textbox layer type', () => {
		mockCanvasManager.editor.layers.push( {
			id: 'layer-4',
			type: 'textbox',
			text: 'Textbox',
			x: 300,
			y: 300,
			width: 150,
			height: 80,
			visible: true
		} );

		const event = {
			clientX: 350,
			clientY: 340,
			preventDefault: jest.fn()
		};

		events.handleDoubleClick( event );

		expect( mockCanvasManager.inlineTextEditor.startEditing ).toHaveBeenCalledWith(
			expect.objectContaining( { type: 'textbox' } )
		);
	} );

	test( 'should use findTextLayerAtPoint helper', () => {
		expect( typeof events.findTextLayerAtPoint ).toBe( 'function' );

		const result = events.findTextLayerAtPoint(
			{ x: 120, y: 110 },
			mockCanvasManager.editor.layers
		);

		expect( result ).toBeDefined();
		expect( result.type ).toBe( 'text' );
	} );

	test( 'should use isPointInLayer helper', () => {
		expect( typeof events.isPointInLayer ).toBe( 'function' );

		const layer = { x: 100, y: 100, width: 100, height: 50 };

		expect( events.isPointInLayer( { x: 150, y: 125 }, layer ) ).toBe( true );
		expect( events.isPointInLayer( { x: 50, y: 50 }, layer ) ).toBe( false );
	} );
} );
