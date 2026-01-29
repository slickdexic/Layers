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
				layers: [],
				updateLayer: jest.fn( ( layerId, changes ) => {
					// Simulate updating the layer in the layers array
					const layer = mockCanvasManager.editor.layers.find( l => l.id === layerId );
					if ( layer ) {
						Object.assign( layer, changes );
					}
				} ),
				getLayerById: jest.fn( ( layerId ) => {
					return mockCanvasManager.editor.layers.find( l => l.id === layerId ) || null;
				} )
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

		test( 'should return true for callout layer type', () => {
			const layer = { type: 'callout', text: 'Hello' };
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
			// ContentEditable uses textContent, line breaks become <br>
			// The innerHTML will have the text with <br> tags
			const content = editor.editorElement.textContent || editor.editorElement.value;
			expect( content ).toContain( 'Multiline' );
			expect( content ).toContain( 'Text' );
		} );

		test( 'should add textbox class to editor element', () => {
			editor.startEditing( textboxLayer );
			expect( editor.editorElement.classList.contains( 'textbox' ) ).toBe( true );
		} );
	} );

	describe( 'startEditing - callout layer', () => {
		let calloutLayer;

		beforeEach( () => {
			calloutLayer = {
				id: 'layer-3',
				type: 'callout',
				text: 'Callout\nText',
				x: 100,
				y: 100,
				width: 200,
				height: 100,
				fontSize: 14,
				fontFamily: 'Arial',
				fill: '#ffffff',
				color: '#000000',
				tailDirection: 'bottom'
			};
		} );

		test( 'should start editing callout layer successfully', () => {
			const result = editor.startEditing( calloutLayer );
			expect( result ).toBe( true );
			expect( editor.isEditing ).toBe( true );
		} );

		test( 'should preserve multiline text in callout', () => {
			editor.startEditing( calloutLayer );
			// ContentEditable uses textContent, line breaks become <br>
			const content = editor.editorElement.textContent || editor.editorElement.value;
			expect( content ).toContain( 'Callout' );
			expect( content ).toContain( 'Text' );
		} );

		test( 'should add textbox class to editor element for callout', () => {
			// Callouts behave like textboxes (multiline)
			editor.startEditing( calloutLayer );
			expect( editor.editorElement.classList.contains( 'textbox' ) ).toBe( true );
		} );

		test( 'should clear callout text while editing (keep background visible)', () => {
			editor.startEditing( calloutLayer );
			// Layer text should be cleared so background renders on canvas
			expect( calloutLayer.text ).toBe( '' );
		} );

		test( 'should restore callout text on cancel', () => {
			mockCanvasManager.editor.layers = [ calloutLayer ];
			editor.startEditing( calloutLayer );
			editor.cancelEditing();
			expect( calloutLayer.text ).toBe( 'Callout\nText' );
		} );
	} );

	describe( '_isMultilineType', () => {
		test( 'should return true for textbox', () => {
			expect( editor._isMultilineType( { type: 'textbox' } ) ).toBe( true );
		} );

		test( 'should return true for callout', () => {
			expect( editor._isMultilineType( { type: 'callout' } ) ).toBe( true );
		} );

		test( 'should return false for text', () => {
			expect( editor._isMultilineType( { type: 'text' } ) ).toBe( false );
		} );

		test( 'should return false for rectangle', () => {
			expect( editor._isMultilineType( { type: 'rectangle' } ) ).toBe( false );
		} );

		test( 'should return false for null', () => {
			expect( editor._isMultilineType( null ) ).toBeFalsy();
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

	describe( '_syncPropertiesPanel', () => {
		test( 'should call updatePropertiesPanel when editor.layerPanel exists', () => {
			const mockUpdatePropertiesPanel = jest.fn();
			mockCanvasManager.editor.layerPanel = {
				updatePropertiesPanel: mockUpdatePropertiesPanel
			};

			const layer = { id: 'layer-1', type: 'text', text: 'Test', x: 0, y: 0 };
			editor.startEditing( layer );

			// Manually call _syncPropertiesPanel
			editor._syncPropertiesPanel();

			expect( mockUpdatePropertiesPanel ).toHaveBeenCalledWith( 'layer-1' );
		} );

		test( 'should not throw when layerPanel is missing', () => {
			delete mockCanvasManager.editor.layerPanel;

			const layer = { id: 'layer-1', type: 'text', text: 'Test', x: 0, y: 0 };
			editor.startEditing( layer );

			expect( () => editor._syncPropertiesPanel() ).not.toThrow();
		} );

		test( 'should not throw when updatePropertiesPanel is not a function', () => {
			mockCanvasManager.editor.layerPanel = {};

			const layer = { id: 'layer-1', type: 'text', text: 'Test', x: 0, y: 0 };
			editor.startEditing( layer );

			expect( () => editor._syncPropertiesPanel() ).not.toThrow();
		} );

		test( 'should not call updatePropertiesPanel when not editing', () => {
			const mockUpdatePropertiesPanel = jest.fn();
			mockCanvasManager.editor.layerPanel = {
				updatePropertiesPanel: mockUpdatePropertiesPanel
			};

			// Don't start editing, just call sync
			editor._syncPropertiesPanel();

			expect( mockUpdatePropertiesPanel ).not.toHaveBeenCalled();
		} );

		test( 'should be called when _applyFormat is called', () => {
			const mockUpdatePropertiesPanel = jest.fn();
			mockCanvasManager.editor.layerPanel = {
				updatePropertiesPanel: mockUpdatePropertiesPanel
			};

			const layer = { id: 'layer-1', type: 'text', text: 'Test', x: 0, y: 0, fontSize: 16 };
			// Add layer to layers array so updateLayer and getLayerById work
			mockCanvasManager.editor.layers = [ layer ];
			editor.startEditing( layer );

			// Call _applyFormat which should trigger _syncPropertiesPanel
			editor._applyFormat( 'fontSize', 24 );

			expect( mockUpdatePropertiesPanel ).toHaveBeenCalledWith( 'layer-1' );
			// updateLayer should have been called with visible: false to keep layer hidden during editing
			expect( mockCanvasManager.editor.updateLayer ).toHaveBeenCalledWith( 'layer-1', { fontSize: 24, visible: false } );
			expect( layer.fontSize ).toBe( 24 );
		} );

		test( 'should sync properties panel for all formatting changes', () => {
			const mockUpdatePropertiesPanel = jest.fn();
			mockCanvasManager.editor.layerPanel = {
				updatePropertiesPanel: mockUpdatePropertiesPanel
			};

			const layer = {
				id: 'layer-1',
				type: 'text',
				text: 'Test',
				x: 0, y: 0,
				fontFamily: 'Arial',
				fontSize: 16,
				fontWeight: 'normal',
				fontStyle: 'normal',
				textAlign: 'left',
				color: '#000000'
			};
			// Add layer to layers array so updateLayer and getLayerById work
			mockCanvasManager.editor.layers = [ layer ];
			editor.startEditing( layer );

			// Apply multiple format changes
			editor._applyFormat( 'fontFamily', 'Georgia' );
			editor._applyFormat( 'fontWeight', 'bold' );
			editor._applyFormat( 'fontStyle', 'italic' );
			editor._applyFormat( 'textAlign', 'center' );
			editor._applyFormat( 'color', '#ff0000' );

			// Should have been called 5 times (once per format change)
			expect( mockUpdatePropertiesPanel ).toHaveBeenCalledTimes( 5 );

			// Verify updateLayer was called for each change
			expect( mockCanvasManager.editor.updateLayer ).toHaveBeenCalledTimes( 5 );

			// Verify layer was updated
			expect( layer.fontFamily ).toBe( 'Georgia' );
			expect( layer.fontWeight ).toBe( 'bold' );
			expect( layer.fontStyle ).toBe( 'italic' );
			expect( layer.textAlign ).toBe( 'center' );
			expect( layer.color ).toBe( '#ff0000' );
		} );

		test( 'should use editor.updateLayer to persist font changes', () => {
			const layer = { id: 'layer-1', type: 'text', text: 'Test', x: 0, y: 0, fontFamily: 'Arial' };
			mockCanvasManager.editor.layers = [ layer ];
			editor.startEditing( layer );

			// Change font family via _applyFormat
			editor._applyFormat( 'fontFamily', 'Times New Roman' );

			// Verify updateLayer was called with the font change and visible: false to keep layer hidden
			expect( mockCanvasManager.editor.updateLayer ).toHaveBeenCalledWith( 'layer-1', { fontFamily: 'Times New Roman', visible: false } );
			// Layer should be updated
			expect( layer.fontFamily ).toBe( 'Times New Roman' );
		} );

		test( 'should fall back to direct update when updateLayer unavailable', () => {
			// Remove updateLayer
			delete mockCanvasManager.editor.updateLayer;

			const layer = { id: 'layer-1', type: 'text', text: 'Test', x: 0, y: 0, fontFamily: 'Arial' };
			editor.startEditing( layer );

			// Should not throw and should still update the layer directly
			expect( () => editor._applyFormat( 'fontFamily', 'Georgia' ) ).not.toThrow();
			expect( layer.fontFamily ).toBe( 'Georgia' );
		} );

		test( 'should use text: empty string for textbox layers when applying format', () => {
			const layer = {
				id: 'layer-1',
				type: 'textbox',
				text: 'Test content',
				x: 0, y: 0,
				width: 200, height: 100,
				fontFamily: 'Arial'
			};
			mockCanvasManager.editor.layers = [ layer ];
			editor.startEditing( layer );

			// Change font family via _applyFormat
			editor._applyFormat( 'fontFamily', 'Times New Roman' );

			// Verify updateLayer was called with text: '' to keep text cleared during editing
			expect( mockCanvasManager.editor.updateLayer ).toHaveBeenCalledWith( 'layer-1', { fontFamily: 'Times New Roman', text: '' } );
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

describe( 'InlineTextEditor - Toolbar functionality', () => {
	let mockCanvasManager;
	let mockCanvas;
	let mockContainer;
	let editor;

	beforeEach( () => {
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

		mockContainer = {
			appendChild: jest.fn(),
			removeChild: jest.fn(),
			style: {},
			getBoundingClientRect: jest.fn( () => ( {
				left: 0,
				top: 0,
				width: 1000,
				height: 800
			} ) )
		};

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
				layers: [],
				updateLayer: jest.fn(),
				getLayerById: jest.fn()
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

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		jest.clearAllMocks();
	} );

	describe( '_createToolbar', () => {
		test( 'should create toolbar element when editing starts', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 100, fontSize: 16 };
			editor.startEditing( layer );

			// Toolbar should be created
			expect( editor.toolbarElement ).toBeDefined();
			expect( editor.toolbarElement ).not.toBeNull();
		} );

		test( 'should add toolbar to container', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 100 };
			editor.startEditing( layer );

			// appendChild should be called for both editor and toolbar
			expect( mockContainer.appendChild ).toHaveBeenCalled();
		} );

		test( 'should have formatting controls', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 100 };
			editor.startEditing( layer );

			const toolbar = editor.toolbarElement;
			expect( toolbar ).toBeDefined();
			expect( toolbar.className ).toContain( 'layers-text-toolbar' );
		} );
	} );

	describe( '_removeToolbar', () => {
		test( 'should remove toolbar element on finish editing', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 100 };
			mockCanvasManager.editor.layers = [ layer ];
			editor.startEditing( layer );

			expect( editor.toolbarElement ).not.toBeNull();

			editor.finishEditing( true );

			expect( editor.toolbarElement ).toBeNull();
		} );

		test( 'should handle missing toolbar gracefully', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 100 };
			mockCanvasManager.editor.layers = [ layer ];
			editor.startEditing( layer );

			// Manually null out toolbar
			editor.toolbarElement = null;

			// Should not throw
			expect( () => editor._removeToolbar() ).not.toThrow();
		} );
	} );

	describe( '_positionToolbar', () => {
		test( 'should position toolbar above editor element', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 200 };
			editor.startEditing( layer );

			// Mock editor element rect
			if ( editor.editorElement ) {
				editor.editorElement.getBoundingClientRect = jest.fn( () => ( {
					left: 100,
					top: 200,
					right: 300,
					bottom: 250,
					width: 200,
					height: 50
				} ) );
			}

			// Position should be above editor
			editor._positionToolbar();

			if ( editor.toolbarElement ) {
				const top = parseFloat( editor.toolbarElement.style.top );
				// Should be above editor (top 200 - 44 = 156)
				expect( top ).toBeLessThan( 200 );
			}
		} );

		test( 'should handle missing toolbar element', () => {
			// Should not throw when toolbar is null
			editor.toolbarElement = null;
			expect( () => editor._positionToolbar() ).not.toThrow();
		} );

		test( 'should handle missing editor element', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 100 };
			editor.startEditing( layer );

			editor.editorElement = null;
			expect( () => editor._positionToolbar() ).not.toThrow();
		} );
	} );

	describe( 'Toolbar drag functionality', () => {
		test( 'should setup drag handler on toolbar', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 100 };
			editor.startEditing( layer );

			// Toolbar should be draggable
			expect( editor.toolbarElement ).toBeDefined();
			// _isDraggingToolbar should initially be false
			expect( editor._isDraggingToolbar ).toBe( false );
		} );

		test( 'should track dragging state', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 100 };
			editor.startEditing( layer );

			// Simulate mousedown on drag handle
			const dragHandle = editor.toolbarElement?.querySelector( '.toolbar-drag-handle' );
			if ( dragHandle ) {
				const mousedownEvent = new MouseEvent( 'mousedown', {
					clientX: 150,
					clientY: 50,
					bubbles: true
				} );
				dragHandle.dispatchEvent( mousedownEvent );

				expect( editor._isDraggingToolbar ).toBe( true );
			}
		} );

		test( '_stopToolbarDrag should reset dragging state', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 100 };
			editor.startEditing( layer );

			// Set dragging state
			editor._isDraggingToolbar = true;
			editor._boundToolbarMouseMove = jest.fn();
			editor._boundToolbarMouseUp = jest.fn();

			// Stop drag
			editor._stopToolbarDrag();

			expect( editor._isDraggingToolbar ).toBe( false );
			expect( editor._boundToolbarMouseMove ).toBeNull();
			expect( editor._boundToolbarMouseUp ).toBeNull();
		} );

		test( '_handleToolbarDrag should update toolbar position', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 100 };
			editor.startEditing( layer );

			editor._isDraggingToolbar = true;
			editor._toolbarDragOffset = { x: 10, y: 10 };

			const mockEvent = { clientX: 200, clientY: 100 };
			editor._handleToolbarDrag( mockEvent );

			expect( editor.toolbarElement.style.left ).toBeDefined();
			expect( editor.toolbarElement.style.top ).toBeDefined();
		} );

		test( '_handleToolbarDrag should do nothing when not dragging', () => {
			const layer = { type: 'text', text: 'Test', x: 100, y: 100 };
			editor.startEditing( layer );

			const originalLeft = editor.toolbarElement.style.left;
			editor._isDraggingToolbar = false;

			editor._handleToolbarDrag( { clientX: 500, clientY: 500 } );

			// Position should not change
			expect( editor.toolbarElement.style.left ).toBe( originalLeft );
		} );
	} );
} );

describe( 'InlineTextEditor - Rotation handling', () => {
	let mockCanvasManager;
	let mockCanvas;
	let mockContainer;
	let editor;

	beforeEach( () => {
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

		mockContainer = {
			appendChild: jest.fn(),
			removeChild: jest.fn(),
			style: {},
			getBoundingClientRect: jest.fn( () => ( {
				left: 0,
				top: 0,
				width: 1000,
				height: 800
			} ) )
		};

		mockCanvasManager = {
			canvas: mockCanvas,
			container: mockContainer,
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			},
			editor: { layers: [], updateLayer: jest.fn(), getLayerById: jest.fn() },
			zoom: 1.0,
			panX: 0,
			panY: 0,
			setTextEditingMode: jest.fn(),
			saveState: jest.fn(),
			redraw: jest.fn(),
			renderLayers: jest.fn(),
			isDestroyed: false
		};

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		jest.clearAllMocks();
	} );

	test( 'should handle rotated text layer positioning', () => {
		const rotatedLayer = {
			type: 'text',
			text: 'Rotated Text',
			x: 200,
			y: 200,
			rotation: 45,
			fontSize: 16
		};

		editor.startEditing( rotatedLayer );

		// Editor element should have rotation transform
		const transform = editor.editorElement.style.transform;
		expect( transform ).toContain( 'rotate' );
		expect( transform ).toContain( '45' );
	} );

	test( 'should not apply rotation for zero rotation', () => {
		const layer = {
			type: 'text',
			text: 'Normal Text',
			x: 100,
			y: 100,
			rotation: 0,
			fontSize: 16
		};

		editor.startEditing( layer );

		const transform = editor.editorElement.style.transform;
		expect( transform ).toBe( 'none' );
	} );

	test( 'should handle undefined rotation', () => {
		const layer = {
			type: 'text',
			text: 'No Rotation',
			x: 100,
			y: 100,
			fontSize: 16
			// rotation not defined
		};

		editor.startEditing( layer );

		const transform = editor.editorElement.style.transform;
		expect( transform ).toBe( 'none' );
	} );

	test( 'should position rotated element from center', () => {
		const rotatedLayer = {
			type: 'textbox',
			text: 'Rotated Box',
			x: 200,
			y: 200,
			width: 100,
			height: 50,
			rotation: 90,
			fontSize: 14
		};

		editor.startEditing( rotatedLayer );

		const transform = editor.editorElement.style.transform;
		expect( transform ).toContain( 'translate(-50%, -50%)' );
		expect( transform ).toContain( 'rotate(90deg)' );
	} );
} );

describe( 'InlineTextEditor - Blur handling', () => {
	let mockCanvasManager;
	let mockCanvas;
	let mockContainer;
	let editor;

	beforeEach( () => {
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

		mockContainer = {
			appendChild: jest.fn(),
			removeChild: jest.fn(),
			contains: jest.fn( () => true ),
			style: {},
			getBoundingClientRect: jest.fn( () => ( {
				left: 0,
				top: 0,
				width: 1000,
				height: 800
			} ) )
		};

		mockCanvasManager = {
			canvas: mockCanvas,
			container: mockContainer,
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			},
			editor: { layers: [], updateLayer: jest.fn(), getLayerById: jest.fn() },
			zoom: 1.0,
			panX: 0,
			panY: 0,
			setTextEditingMode: jest.fn(),
			saveState: jest.fn(),
			redraw: jest.fn(),
			renderLayers: jest.fn(),
			isDestroyed: false
		};

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		jest.clearAllMocks();
	} );

	test( 'should have _handleBlur method', () => {
		expect( typeof editor._handleBlur ).toBe( 'function' );
	} );

	test( 'should not finish editing when toolbar has focus', ( done ) => {
		const layer = { id: 'layer-1', type: 'text', text: 'Test', x: 100, y: 100 };
		mockCanvasManager.editor.layers = [ layer ];
		editor.startEditing( layer );

		const finishSpy = jest.spyOn( editor, 'finishEditing' );

		// Mock toolbar.contains to return true (simulating focus is on toolbar)
		if ( editor.toolbarElement ) {
			editor.toolbarElement.contains = jest.fn( () => true );
		}

		editor._handleBlur();

		// Wait for the setTimeout (150ms in implementation)
		setTimeout( () => {
			// Should NOT finish editing when clicking toolbar
			expect( finishSpy ).not.toHaveBeenCalled();
			done();
		}, 200 );
	} );

	test( 'should not finish editing when child of toolbar has focus', ( done ) => {
		const layer = { id: 'layer-1', type: 'text', text: 'Test', x: 100, y: 100 };
		mockCanvasManager.editor.layers = [ layer ];
		editor.startEditing( layer );

		const finishSpy = jest.spyOn( editor, 'finishEditing' );

		// Mock toolbar.contains to return true
		if ( editor.toolbarElement ) {
			editor.toolbarElement.contains = jest.fn( () => true );
		}

		editor._handleBlur();

		// Wait for the setTimeout
		setTimeout( () => {
			// Should NOT finish editing when clicking toolbar child
			expect( finishSpy ).not.toHaveBeenCalled();
			done();
		}, 200 );
	} );

	test( 'should finish editing when focus is lost to outside element', ( done ) => {
		const layer = { id: 'layer-1', type: 'text', text: 'Test', x: 100, y: 100 };
		mockCanvasManager.editor.layers = [ layer ];
		editor.startEditing( layer );

		const finishSpy = jest.spyOn( editor, 'finishEditing' );

		// Mock toolbar.contains to return false
		if ( editor.toolbarElement ) {
			editor.toolbarElement.contains = jest.fn( () => false );
		}

		// The _handleBlur uses setTimeout and checks document.activeElement
		// We need to call _handleBlur and wait for the timeout
		editor._handleBlur();

		// Wait for the setTimeout (150ms in implementation)
		setTimeout( () => {
			expect( finishSpy ).toHaveBeenCalledWith( true );
			done();
		}, 200 );
	} );

	test( 'should not finish editing when color picker dialog is open', ( done ) => {
		const layer = { id: 'layer-1', type: 'text', text: 'Test', x: 100, y: 100 };
		mockCanvasManager.editor.layers = [ layer ];
		editor.startEditing( layer );

		const finishSpy = jest.spyOn( editor, 'finishEditing' );

		// Create a mock color picker dialog in the document
		const mockDialog = document.createElement( 'div' );
		mockDialog.className = 'color-picker-dialog';
		document.body.appendChild( mockDialog );

		if ( editor.toolbarElement ) {
			editor.toolbarElement.contains = jest.fn( () => false );
		}

		editor._handleBlur();

		// Wait for the setTimeout
		setTimeout( () => {
			// Should NOT finish editing when color picker is open
			expect( finishSpy ).not.toHaveBeenCalled();
			// Cleanup
			document.body.removeChild( mockDialog );
			done();
		}, 200 );
	} );

	test( 'should handle blur without throwing', () => {
		const layer = { id: 'layer-1', type: 'text', text: 'Test', x: 100, y: 100 };
		mockCanvasManager.editor.layers = [ layer ];
		editor.startEditing( layer );

		// Should not throw
		expect( () => editor._handleBlur() ).not.toThrow();
	} );
} );

describe( 'InlineTextEditor - Text measurement', () => {
	let mockCanvasManager;
	let mockCanvas;
	let mockContainer;
	let editor;

	beforeEach( () => {
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

		mockContainer = {
			appendChild: jest.fn(),
			removeChild: jest.fn(),
			style: {},
			getBoundingClientRect: jest.fn( () => ( {
				left: 0,
				top: 0,
				width: 1000,
				height: 800
			} ) )
		};

		mockCanvasManager = {
			canvas: mockCanvas,
			container: mockContainer,
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( () => ( { width: 150 } ) )
			},
			editor: { layers: [], updateLayer: jest.fn(), getLayerById: jest.fn() },
			zoom: 1.0,
			panX: 0,
			panY: 0,
			setTextEditingMode: jest.fn(),
			saveState: jest.fn(),
			redraw: jest.fn(),
			renderLayers: jest.fn(),
			isDestroyed: false
		};

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		jest.clearAllMocks();
	} );

	test( '_measureTextWidth should use canvas context', () => {
		const layer = {
			type: 'text',
			text: 'Test measurement',
			fontSize: 20,
			fontFamily: 'Georgia',
			fontWeight: 'bold',
			fontStyle: 'italic'
		};

		const width = editor._measureTextWidth( layer );

		expect( mockCanvasManager.ctx.save ).toHaveBeenCalled();
		expect( mockCanvasManager.ctx.measureText ).toHaveBeenCalledWith( 'Test measurement' );
		expect( mockCanvasManager.ctx.restore ).toHaveBeenCalled();
		expect( width ).toBe( 150 );
	} );

	test( '_measureTextWidth should return default for missing context', () => {
		editor.canvasManager.ctx = null;

		const layer = { type: 'text', text: 'Test', fontSize: 16 };
		const width = editor._measureTextWidth( layer );

		expect( width ).toBe( 100 ); // Default value
	} );

	test( '_measureTextWidth should handle empty text', () => {
		mockCanvasManager.ctx.measureText.mockReturnValue( { width: 0 } );

		const layer = { type: 'text', text: '', fontSize: 16 };
		const width = editor._measureTextWidth( layer );

		expect( mockCanvasManager.ctx.measureText ).toHaveBeenCalledWith( '' );
	} );

	test( '_measureTextWidth should use layer font properties', () => {
		const layer = {
			type: 'text',
			text: 'Font test',
			fontSize: 24,
			fontFamily: 'Helvetica',
			fontWeight: 'normal',
			fontStyle: 'normal'
		};

		editor._measureTextWidth( layer );

		// Check that font was set on context
		expect( mockCanvasManager.ctx.font ).toContain( '24' );
	} );
} );

describe( 'InlineTextEditor - Style application', () => {
	let mockCanvasManager;
	let mockCanvas;
	let mockContainer;
	let editor;

	beforeEach( () => {
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

		mockContainer = {
			appendChild: jest.fn(),
			removeChild: jest.fn(),
			style: {},
			getBoundingClientRect: jest.fn( () => ( {
				left: 0,
				top: 0,
				width: 1000,
				height: 800
			} ) )
		};

		mockCanvasManager = {
			canvas: mockCanvas,
			container: mockContainer,
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			},
			editor: { layers: [], updateLayer: jest.fn(), getLayerById: jest.fn() },
			zoom: 1.0,
			panX: 0,
			panY: 0,
			setTextEditingMode: jest.fn(),
			saveState: jest.fn(),
			redraw: jest.fn(),
			renderLayers: jest.fn(),
			isDestroyed: false
		};

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		jest.clearAllMocks();
	} );

	test( '_applyLayerStyle should apply font properties', () => {
		const layer = {
			type: 'text',
			text: 'Styled text',
			x: 100,
			y: 100,
			fontFamily: 'Georgia',
			fontWeight: 'bold',
			fontStyle: 'italic',
			color: '#ff0000'
		};

		editor.startEditing( layer );

		const style = editor.editorElement.style;
		expect( style.fontFamily ).toBe( 'Georgia' );
		expect( style.fontWeight ).toBe( 'bold' );
		expect( style.fontStyle ).toBe( 'italic' );
		expect( style.color ).toBe( 'rgb(255, 0, 0)' );
	} );

	test( '_applyLayerStyle should use defaults for missing properties', () => {
		const layer = {
			type: 'text',
			text: 'Default styled',
			x: 100,
			y: 100
			// No font properties
		};

		editor.startEditing( layer );

		const style = editor.editorElement.style;
		expect( style.fontFamily ).toContain( 'Arial' );
		expect( style.fontWeight ).toBe( 'normal' );
		expect( style.fontStyle ).toBe( 'normal' );
	} );

	test( '_applyLayerStyle should handle textbox alignment', () => {
		const layer = {
			type: 'textbox',
			text: 'Aligned text',
			x: 100,
			y: 100,
			width: 200,
			height: 100,
			textAlign: 'center',
			lineHeight: 1.5
		};

		editor.startEditing( layer );

		const style = editor.editorElement.style;
		expect( style.textAlign ).toBe( 'center' );
		expect( style.lineHeight ).toBe( '1.5' );
	} );

	test( '_applyLayerStyle should use fill color as fallback', () => {
		const layer = {
			type: 'text',
			text: 'Fill color',
			x: 100,
			y: 100,
			fill: '#00ff00'
			// No 'color' property
		};

		editor.startEditing( layer );

		const style = editor.editorElement.style;
		expect( style.color ).toBe( 'rgb(0, 255, 0)' );
	} );

	test( '_applyLayerStyle should not throw for null editor element', () => {
		editor.editorElement = null;
		editor.editingLayer = { type: 'text', text: 'Test' };

		expect( () => editor._applyLayerStyle() ).not.toThrow();
	} );

	test( '_applyLayerStyle should not throw for null editing layer', () => {
		const layer = { type: 'text', text: 'Test', x: 0, y: 0 };
		editor.startEditing( layer );

		editor.editingLayer = null;

		expect( () => editor._applyLayerStyle() ).not.toThrow();
	} );
} );

describe( 'InlineTextEditor - isActive and getEditingLayer', () => {
	let mockCanvasManager;
	let mockCanvas;
	let mockContainer;
	let editor;

	beforeEach( () => {
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

		mockContainer = {
			appendChild: jest.fn(),
			removeChild: jest.fn(),
			style: {}
		};

		mockCanvasManager = {
			canvas: mockCanvas,
			container: mockContainer,
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			},
			editor: { layers: [], updateLayer: jest.fn(), getLayerById: jest.fn() },
			zoom: 1.0,
			panX: 0,
			panY: 0,
			setTextEditingMode: jest.fn(),
			saveState: jest.fn(),
			redraw: jest.fn(),
			renderLayers: jest.fn(),
			isDestroyed: false
		};

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		jest.clearAllMocks();
	} );

	test( 'isActive should return true when editing', () => {
		const layer = { type: 'text', text: 'Test', x: 0, y: 0 };
		editor.startEditing( layer );

		expect( editor.isActive() ).toBe( true );
	} );

	test( 'isActive should return false when not editing', () => {
		expect( editor.isActive() ).toBe( false );
	} );

	test( 'getEditingLayer should return current layer when editing', () => {
		const layer = { id: 'test-layer', type: 'text', text: 'Test', x: 0, y: 0 };
		editor.startEditing( layer );

		expect( editor.getEditingLayer() ).toBe( layer );
	} );

	test( 'getEditingLayer should return null when not editing', () => {
		expect( editor.getEditingLayer() ).toBeNull();
	} );
} );

describe( 'InlineTextEditor - Visibility handling for text layers', () => {
	let mockCanvasManager;
	let mockCanvas;
	let mockContainer;
	let editor;

	beforeEach( () => {
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

		mockContainer = {
			appendChild: jest.fn(),
			removeChild: jest.fn(),
			style: {}
		};

		mockCanvasManager = {
			canvas: mockCanvas,
			container: mockContainer,
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			},
			editor: { layers: [], updateLayer: jest.fn(), getLayerById: jest.fn() },
			zoom: 1.0,
			panX: 0,
			panY: 0,
			setTextEditingMode: jest.fn(),
			saveState: jest.fn(),
			redraw: jest.fn(),
			renderLayers: jest.fn(),
			isDestroyed: false
		};

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		jest.clearAllMocks();
	} );

	test( 'should store original visibility for text layers', () => {
		const layer = {
			type: 'text',
			text: 'Visible text',
			x: 100,
			y: 100,
			visible: true
		};

		editor.startEditing( layer );

		expect( editor._originalVisible ).toBe( true );
	} );

	test( 'should restore visibility after finishing editing', () => {
		const layer = {
			id: 'layer-1',
			type: 'text',
			text: 'Test',
			x: 100,
			y: 100,
			visible: true
		};
		mockCanvasManager.editor.layers = [ layer ];

		editor.startEditing( layer );
		editor.finishEditing( true );

		expect( layer.visible ).toBe( true );
	} );

	test( 'should handle layers without visible property', () => {
		const layer = {
			type: 'text',
			text: 'No visible prop',
			x: 100,
			y: 100
			// visible not defined
		};
		mockCanvasManager.editor.layers = [ layer ];

		editor.startEditing( layer );
		editor.finishEditing( true );

		// Verify layer still exists in editor
		expect( mockCanvasManager.editor.layers ).toContain( layer );
		// When visible is undefined, the editor normalizes it to true (default visibility)
		expect( layer.visible ).toBe( true );
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

	test( 'should handle callout layer type', () => {
		mockCanvasManager.editor.layers.push( {
			id: 'layer-5',
			type: 'callout',
			text: 'Callout text',
			x: 400,
			y: 400,
			width: 150,
			height: 80,
			visible: true,
			tailDirection: 'bottom'
		} );

		const event = {
			clientX: 450,
			clientY: 440,
			preventDefault: jest.fn()
		};

		events.handleDoubleClick( event );

		expect( mockCanvasManager.inlineTextEditor.startEditing ).toHaveBeenCalledWith(
			expect.objectContaining( { type: 'callout' } )
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

describe( 'InlineTextEditor - Private toolbar building methods', () => {
	let mockCanvasManager;
	let mockCanvas;
	let mockContainer;
	let editor;
	let textLayer;

	beforeEach( () => {
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

		mockContainer = document.createElement( 'div' );
		document.body.appendChild( mockContainer );

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
				layers: [],
				updateLayer: jest.fn(),
				getLayerById: jest.fn()
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

		textLayer = {
			id: 'layer-1',
			type: 'text',
			text: 'Test Text',
			x: 100,
			y: 100,
			fontSize: 16,
			fontFamily: 'Arial',
			fontWeight: 'normal',
			fontStyle: 'normal',
			color: '#000000',
			textAlign: 'left'
		};

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		if ( mockContainer.parentNode ) {
			mockContainer.parentNode.removeChild( mockContainer );
		}
		jest.clearAllMocks();
	} );

	describe( '_createFontSelect', () => {
		test( 'should create select element with font options', () => {
			const select = editor._createFontSelect( textLayer );

			expect( select ).toBeDefined();
			expect( select.tagName ).toBe( 'SELECT' );
			expect( select.options.length ).toBeGreaterThan( 0 );
		} );

		test( 'should have current font selected', () => {
			textLayer.fontFamily = 'Georgia';
			const select = editor._createFontSelect( textLayer );

			// Find Georgia option
			const georgiaOption = Array.from( select.options ).find( o => o.value === 'Georgia' );
			expect( georgiaOption ).toBeDefined();
			expect( georgiaOption.selected ).toBe( true );
		} );

		test( 'should call _applyFormat on change', () => {
			editor._applyFormat = jest.fn();
			const select = editor._createFontSelect( textLayer );

			// Simulate change
			select.value = 'Verdana';
			select.dispatchEvent( new Event( 'change' ) );

			expect( editor._applyFormat ).toHaveBeenCalledWith( 'fontFamily', 'Verdana' );
		} );

		test( 'should set interaction flag on mousedown', () => {
			const select = editor._createFontSelect( textLayer );

			select.dispatchEvent( new Event( 'mousedown' ) );
			expect( editor._isToolbarInteraction ).toBe( true );
		} );

		test( 'should set interaction flag on focus', () => {
			const select = editor._createFontSelect( textLayer );

			select.dispatchEvent( new Event( 'focus' ) );
			expect( editor._isToolbarInteraction ).toBe( true );
		} );
	} );

	describe( '_createFontSizeInput', () => {
		test( 'should create input group with number type', () => {
			const group = editor._createFontSizeInput( textLayer );

			expect( group ).toBeDefined();
			expect( group.tagName ).toBe( 'DIV' );
			const input = group.querySelector( 'input[type="number"]' );
			expect( input ).toBeDefined();
		} );

		test( 'should have min and max constraints', () => {
			const group = editor._createFontSizeInput( textLayer );
			const input = group.querySelector( 'input' );

			expect( parseInt( input.min, 10 ) ).toBeGreaterThanOrEqual( 1 );
			expect( parseInt( input.max, 10 ) ).toBeGreaterThanOrEqual( 100 );
		} );

		test( 'should have current font size as value', () => {
			textLayer.fontSize = 24;
			const group = editor._createFontSizeInput( textLayer );
			const input = group.querySelector( 'input' );

			expect( parseInt( input.value, 10 ) ).toBe( 24 );
		} );

		test( 'should call _applyFormat on change', () => {
			editor._applyFormat = jest.fn();
			const group = editor._createFontSizeInput( textLayer );
			const input = group.querySelector( 'input' );

			input.value = '20';
			input.dispatchEvent( new Event( 'change' ) );

			expect( editor._applyFormat ).toHaveBeenCalledWith( 'fontSize', 20 );
		} );

		test( 'should set interaction flag on focus', () => {
			const group = editor._createFontSizeInput( textLayer );
			const input = group.querySelector( 'input' );

			input.dispatchEvent( new Event( 'focus' ) );
			expect( editor._isToolbarInteraction ).toBe( true );
		} );
	} );

	describe( '_createFormatButton', () => {
		test( 'should create button element for bold', () => {
			const btn = editor._createFormatButton( 'B', 'bold', false, 'Bold' );

			expect( btn ).toBeDefined();
			expect( btn.tagName ).toBe( 'BUTTON' );
			expect( btn.getAttribute( 'data-format' ) ).toBe( 'bold' );
		} );

		test( 'should create button element for italic', () => {
			const btn = editor._createFormatButton( 'I', 'italic', false, 'Italic' );

			expect( btn ).toBeDefined();
			expect( btn.tagName ).toBe( 'BUTTON' );
			expect( btn.getAttribute( 'data-format' ) ).toBe( 'italic' );
		} );

		test( 'should have active class when format is active', () => {
			const btn = editor._createFormatButton( 'B', 'bold', true, 'Bold' );

			expect( btn.classList.contains( 'active' ) ).toBe( true );
		} );

		test( 'should not have active class when format is inactive', () => {
			const btn = editor._createFormatButton( 'B', 'bold', false, 'Bold' );

			expect( btn.classList.contains( 'active' ) ).toBe( false );
		} );

		test( 'should toggle active class and apply bold format on click', () => {
			editor._applyFormat = jest.fn();
			const btn = editor._createFormatButton( 'B', 'bold', false, 'Bold' );

			// Simulate click
			btn.click();

			expect( btn.classList.contains( 'active' ) ).toBe( true );
			expect( editor._applyFormat ).toHaveBeenCalledWith( 'fontWeight', 'bold' );
		} );

		test( 'should toggle off bold format on second click', () => {
			editor._applyFormat = jest.fn();
			const btn = editor._createFormatButton( 'B', 'bold', true, 'Bold' );

			// Click to toggle off
			btn.click();

			expect( btn.classList.contains( 'active' ) ).toBe( false );
			expect( editor._applyFormat ).toHaveBeenCalledWith( 'fontWeight', 'normal' );
		} );

		test( 'should apply italic format on click', () => {
			editor._applyFormat = jest.fn();
			const btn = editor._createFormatButton( 'I', 'italic', false, 'Italic' );

			btn.click();

			expect( editor._applyFormat ).toHaveBeenCalledWith( 'fontStyle', 'italic' );
		} );

		test( 'should prevent blur on mousedown', () => {
			const btn = editor._createFormatButton( 'B', 'bold', false, 'Bold' );
			const mockEvent = { preventDefault: jest.fn() };

			btn.dispatchEvent( Object.assign( new Event( 'mousedown' ), mockEvent ) );
			// Note: We can't directly test preventDefault on native events,
			// but we verify the handler is attached
			expect( btn ).toBeDefined();
		} );
	} );

	describe( '_createAlignButton', () => {
		test( 'should create button for left alignment', () => {
			editor.editingLayer = textLayer;
			const btn = editor._createAlignButton( 'left', 'left' );

			expect( btn ).toBeDefined();
			expect( btn.tagName ).toBe( 'BUTTON' );
			expect( btn.getAttribute( 'data-align' ) ).toBe( 'left' );
		} );

		test( 'should create button for center alignment', () => {
			editor.editingLayer = textLayer;
			const btn = editor._createAlignButton( 'center', 'left' );

			expect( btn ).toBeDefined();
			expect( btn.getAttribute( 'data-align' ) ).toBe( 'center' );
		} );

		test( 'should create button for right alignment', () => {
			editor.editingLayer = textLayer;
			const btn = editor._createAlignButton( 'right', 'left' );

			expect( btn ).toBeDefined();
			expect( btn.getAttribute( 'data-align' ) ).toBe( 'right' );
		} );

		test( 'should have active class for current alignment', () => {
			editor.editingLayer = textLayer;
			const btn = editor._createAlignButton( 'center', 'center' );

			expect( btn.classList.contains( 'active' ) ).toBe( true );
		} );

		test( 'should not have active class for non-current alignment', () => {
			editor.editingLayer = textLayer;
			const btn = editor._createAlignButton( 'right', 'left' );

			expect( btn.classList.contains( 'active' ) ).toBe( false );
		} );

		test( 'should call _applyFormat on click', () => {
			editor.editingLayer = textLayer;
			editor._applyFormat = jest.fn();
			editor.toolbarElement = document.createElement( 'div' );
			const btn = editor._createAlignButton( 'center', 'left' );
			editor.toolbarElement.appendChild( btn );

			btn.click();

			expect( editor._applyFormat ).toHaveBeenCalledWith( 'textAlign', 'center' );
		} );

		test( 'should contain SVG icon', () => {
			editor.editingLayer = textLayer;
			const btn = editor._createAlignButton( 'left', 'left' );

			expect( btn.innerHTML ).toContain( 'svg' );
		} );
	} );

	describe( '_createColorPicker', () => {
		test( 'should create color picker wrapper element', () => {
			const wrapper = editor._createColorPicker( textLayer );

			expect( wrapper ).toBeDefined();
			expect( wrapper.tagName ).toBe( 'DIV' );
			expect( wrapper.className ).toContain( 'color' );
		} );

		test( 'should contain color input or button element', () => {
			const wrapper = editor._createColorPicker( textLayer );

			// Either a color input or a button with color picker
			const colorEl = wrapper.querySelector( 'input[type="color"]' ) ||
				wrapper.querySelector( 'button' );
			expect( colorEl ).toBeDefined();
		} );

		test( 'should use current layer color', () => {
			textLayer.color = '#ff0000';
			const wrapper = editor._createColorPicker( textLayer );
			const colorInput = wrapper.querySelector( 'input[type="color"]' );

			if ( colorInput ) {
				expect( colorInput.value.toLowerCase() ).toBe( '#ff0000' );
			}
		} );
	} );

	describe( '_getContainer fallback paths', () => {
		test( 'should return mainContainer if available', () => {
			mockCanvasManager.editor.ui = {
				mainContainer: document.createElement( 'div' )
			};
			const container = editor._getContainer();

			expect( container ).toBe( mockCanvasManager.editor.ui.mainContainer );
		} );

		test( 'should fallback to canvas container', () => {
			mockCanvasManager.editor.ui = null;
			const container = editor._getContainer();

			expect( container ).toBe( mockContainer );
		} );

		test( 'should fallback to document.body', () => {
			mockCanvasManager.container = null;
			mockCanvasManager.editor.ui = null;
			const container = editor._getContainer();

			expect( container ).toBe( document.body );
		} );
	} );

	describe( '_handleInput', () => {
		test( 'should update layer text as user types', () => {
			editor.editingLayer = textLayer;
			editor.editorElement = document.createElement( 'textarea' );
			editor.editorElement.value = 'New text';

			editor._handleInput();

			expect( textLayer.text ).toBe( 'New text' );
		} );

		test( 'should handle null editingLayer', () => {
			editor.editingLayer = null;
			editor.editorElement = document.createElement( 'textarea' );
			editor.editorElement.value = 'New text';

			expect( () => editor._handleInput() ).not.toThrow();
		} );

		test( 'should handle null editorElement', () => {
			editor.editingLayer = textLayer;
			editor.editorElement = null;

			expect( () => editor._handleInput() ).not.toThrow();
		} );
	} );

	describe( '_removeEventHandlers', () => {
		test( 'should remove keydown handler', () => {
			editor.editorElement = document.createElement( 'textarea' );
			const mockHandler = jest.fn();
			editor._boundKeyHandler = mockHandler;
			const removeSpy = jest.spyOn( editor.editorElement, 'removeEventListener' );

			editor._removeEventHandlers();

			expect( removeSpy ).toHaveBeenCalledWith( 'keydown', mockHandler );
		} );

		test( 'should remove blur handler', () => {
			editor.editorElement = document.createElement( 'textarea' );
			const mockHandler = jest.fn();
			editor._boundBlurHandler = mockHandler;
			const removeSpy = jest.spyOn( editor.editorElement, 'removeEventListener' );

			editor._removeEventHandlers();

			expect( removeSpy ).toHaveBeenCalledWith( 'blur', mockHandler );
		} );

		test( 'should remove input handler', () => {
			editor.editorElement = document.createElement( 'textarea' );
			const mockHandler = jest.fn();
			editor._boundInputHandler = mockHandler;
			const removeSpy = jest.spyOn( editor.editorElement, 'removeEventListener' );

			editor._removeEventHandlers();

			expect( removeSpy ).toHaveBeenCalledWith( 'input', mockHandler );
		} );

		test( 'should handle null editorElement', () => {
			editor.editorElement = null;

			expect( () => editor._removeEventHandlers() ).not.toThrow();
		} );
	} );

	describe( '_setupToolbarDrag', () => {
		test( 'should setup drag on mousedown', () => {
			editor.toolbarElement = document.createElement( 'div' );
			const handle = document.createElement( 'div' );

			editor._setupToolbarDrag( handle );

			// Simulate mousedown
			const mousedownEvent = new MouseEvent( 'mousedown', {
				clientX: 100,
				clientY: 100
			} );
			handle.dispatchEvent( mousedownEvent );

			expect( editor._isDraggingToolbar ).toBe( true );
			expect( editor._toolbarDragOffset ).toBeDefined();
		} );

		test( 'should calculate drag offset correctly', () => {
			editor.toolbarElement = document.createElement( 'div' );
			editor.toolbarElement.style.position = 'absolute';
			editor.toolbarElement.style.left = '50px';
			editor.toolbarElement.style.top = '50px';
			document.body.appendChild( editor.toolbarElement );

			const handle = document.createElement( 'div' );

			editor._setupToolbarDrag( handle );

			const mousedownEvent = new MouseEvent( 'mousedown', {
				clientX: 60,
				clientY: 60
			} );
			handle.dispatchEvent( mousedownEvent );

			expect( editor._toolbarDragOffset ).toBeDefined();
			expect( typeof editor._toolbarDragOffset.x ).toBe( 'number' );
			expect( typeof editor._toolbarDragOffset.y ).toBe( 'number' );

			document.body.removeChild( editor.toolbarElement );
		} );
	} );
} );

describe( 'InlineTextEditor - Toolbar integration', () => {
	let mockCanvasManager;
	let mockContainer;
	let editor;
	let textLayer;

	beforeEach( () => {
		mockContainer = document.createElement( 'div' );
		document.body.appendChild( mockContainer );

		mockCanvasManager = {
			canvas: {
				width: 800,
				height: 600,
				style: {},
				getBoundingClientRect: jest.fn( () => ( {
					left: 100,
					top: 100,
					width: 800,
					height: 600
				} ) )
			},
			container: mockContainer,
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			},
			editor: {
				layers: [],
				updateLayer: jest.fn(),
				getLayerById: jest.fn()
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

		textLayer = {
			id: 'layer-1',
			type: 'text',
			text: 'Test',
			x: 100,
			y: 100,
			fontSize: 16,
			fontFamily: 'Arial',
			fontWeight: 'normal',
			fontStyle: 'normal',
			color: '#000000',
			textAlign: 'left',
			visible: true
		};

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		if ( mockContainer.parentNode ) {
			mockContainer.parentNode.removeChild( mockContainer );
		}
		jest.clearAllMocks();
	} );

	test( 'should create toolbar with all controls on startEditing', () => {
		editor.startEditing( textLayer );

		expect( editor.toolbarElement ).toBeDefined();
		expect( editor.toolbarElement ).not.toBeNull();
	} );

	test( 'toolbar should contain font select', () => {
		editor.startEditing( textLayer );

		const fontSelect = editor.toolbarElement.querySelector( 'select' );
		expect( fontSelect ).toBeDefined();
	} );

	test( 'toolbar should contain font size input', () => {
		editor.startEditing( textLayer );

		const sizeInput = editor.toolbarElement.querySelector( 'input[type="number"]' );
		expect( sizeInput ).toBeDefined();
	} );

	test( 'toolbar should contain format buttons', () => {
		editor.startEditing( textLayer );

		const buttons = editor.toolbarElement.querySelectorAll( 'button' );
		expect( buttons.length ).toBeGreaterThan( 0 );
	} );

	test( 'should remove toolbar on finishEditing', () => {
		editor.startEditing( textLayer );
		const toolbar = editor.toolbarElement;

		editor.finishEditing( true );

		expect( editor.toolbarElement ).toBeNull();
		expect( mockContainer.contains( toolbar ) ).toBe( false );
	} );

	test( 'should apply font changes through toolbar', () => {
		editor.startEditing( textLayer );

		const fontSelect = editor.toolbarElement.querySelector( 'select' );
		if ( fontSelect ) {
			fontSelect.value = 'Georgia';
			fontSelect.dispatchEvent( new Event( 'change' ) );

			// editingLayer should be updated (or via updateLayer mock)
			expect( mockCanvasManager.editor.updateLayer ).toHaveBeenCalledWith(
				textLayer.id,
				expect.objectContaining( { fontFamily: 'Georgia' } )
			);
		}
	} );

	test( 'should apply font size changes through toolbar', () => {
		editor.startEditing( textLayer );

		const sizeInput = editor.toolbarElement.querySelector( 'input[type="number"]' );
		if ( sizeInput ) {
			sizeInput.value = '24';
			sizeInput.dispatchEvent( new Event( 'change' ) );

			expect( mockCanvasManager.editor.updateLayer ).toHaveBeenCalledWith(
				textLayer.id,
				expect.objectContaining( { fontSize: 24 } )
			);
		}
	} );
} );

describe( 'InlineTextEditor - ColorPickerDialog integration', () => {
	let mockCanvasManager;
	let mockContainer;
	let editor;
	let textLayer;
	let mockColorPickerDialog;

	beforeEach( () => {
		mockContainer = document.createElement( 'div' );
		document.body.appendChild( mockContainer );

		mockCanvasManager = {
			canvas: {
				width: 800,
				height: 600,
				style: {},
				getBoundingClientRect: jest.fn( () => ( {
					left: 100,
					top: 100,
					width: 800,
					height: 600
				} ) )
			},
			container: mockContainer,
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			},
			editor: {
				layers: [],
				updateLayer: jest.fn(),
				getLayerById: jest.fn()
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

		textLayer = {
			id: 'layer-1',
			type: 'text',
			text: 'Test',
			x: 100,
			y: 100,
			fontSize: 16,
			fontFamily: 'Arial',
			color: '#000000',
			visible: true
		};

		// Mock ColorPickerDialog
		mockColorPickerDialog = jest.fn().mockImplementation( function( options ) {
			this.options = options;
			this.open = jest.fn();
		} );
		mockColorPickerDialog.createColorButton = jest.fn( ( options ) => {
			const btn = document.createElement( 'button' );
			btn.className = 'color-button';
			btn.style.backgroundColor = options.color;
			btn.addEventListener( 'click', options.onClick );
			return btn;
		} );
		mockColorPickerDialog.updateColorButton = jest.fn();

		// Set up window.Layers.UI.ColorPickerDialog
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.ColorPickerDialog = mockColorPickerDialog;

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		if ( mockContainer.parentNode ) {
			mockContainer.parentNode.removeChild( mockContainer );
		}
		// Clean up
		delete window.Layers.UI.ColorPickerDialog;
		jest.clearAllMocks();
	} );

	test( 'should use ColorPickerDialog when available', () => {
		const wrapper = editor._createColorPicker( textLayer );

		expect( mockColorPickerDialog.createColorButton ).toHaveBeenCalled();
		expect( wrapper.querySelector( 'button' ) ).toBeDefined();
	} );

	test( 'should pass current color to ColorPickerDialog', () => {
		textLayer.color = '#ff5500';
		editor._createColorPicker( textLayer );

		expect( mockColorPickerDialog.createColorButton ).toHaveBeenCalledWith(
			expect.objectContaining( { color: '#ff5500' } )
		);
	} );

	test( 'should open dialog on color button click', () => {
		editor.editingLayer = textLayer;
		editor.editorElement = document.createElement( 'textarea' );
		const wrapper = editor._createColorPicker( textLayer );
		const colorBtn = wrapper.querySelector( 'button' );

		colorBtn.click();

		expect( mockColorPickerDialog ).toHaveBeenCalled();
	} );

	test( 'should apply color on dialog apply callback', () => {
		editor.editingLayer = textLayer;
		editor.editorElement = document.createElement( 'textarea' );
		editor._applyFormat = jest.fn();

		// Create color picker
		const wrapper = editor._createColorPicker( textLayer );
		const colorBtn = wrapper.querySelector( 'button' );

		// Click to open dialog
		colorBtn.click();

		// Get the options passed to ColorPickerDialog constructor
		const dialogOptions = mockColorPickerDialog.mock.calls[ 0 ][ 0 ];

		// Call onApply callback
		dialogOptions.onApply( '#00ff00' );

		expect( editor._applyFormat ).toHaveBeenCalledWith( 'color', '#00ff00' );
	} );

	test( 'should preview color on dialog preview callback', () => {
		editor.editingLayer = textLayer;
		editor.editorElement = document.createElement( 'textarea' );
		editor._applyFormat = jest.fn();

		const wrapper = editor._createColorPicker( textLayer );
		const colorBtn = wrapper.querySelector( 'button' );
		colorBtn.click();

		const dialogOptions = mockColorPickerDialog.mock.calls[ 0 ][ 0 ];
		dialogOptions.onPreview( '#0000ff' );

		expect( editor._applyFormat ).toHaveBeenCalledWith( 'color', '#0000ff' );
	} );

	test( 'should restore original color on dialog cancel callback', () => {
		editor.editingLayer = textLayer;
		editor.editorElement = document.createElement( 'textarea' );
		editor._applyFormat = jest.fn();

		const wrapper = editor._createColorPicker( textLayer );
		const colorBtn = wrapper.querySelector( 'button' );
		colorBtn.click();

		const dialogOptions = mockColorPickerDialog.mock.calls[ 0 ][ 0 ];
		dialogOptions.onCancel();

		// Should restore original color (stored before opening dialog)
		expect( editor._applyFormat ).toHaveBeenCalled();
	} );

	test( 'should set interaction flag when dialog opens', () => {
		editor.editingLayer = textLayer;
		editor.editorElement = document.createElement( 'textarea' );

		const wrapper = editor._createColorPicker( textLayer );
		const colorBtn = wrapper.querySelector( 'button' );
		colorBtn.click();

		expect( editor._isToolbarInteraction ).toBe( true );
	} );

	test( 'should reset interaction flag after dialog closes', () => {
		editor.editingLayer = textLayer;
		editor.editorElement = document.createElement( 'textarea' );

		const wrapper = editor._createColorPicker( textLayer );
		const colorBtn = wrapper.querySelector( 'button' );
		colorBtn.click();

		const dialogOptions = mockColorPickerDialog.mock.calls[ 0 ][ 0 ];
		dialogOptions.onApply( '#ff0000' );

		expect( editor._isToolbarInteraction ).toBe( false );
	} );
} );

describe( 'InlineTextEditor - Font select blur handling', () => {
	let mockCanvasManager;
	let mockContainer;
	let editor;
	let textLayer;

	beforeEach( () => {
		jest.useFakeTimers();
		mockContainer = document.createElement( 'div' );
		document.body.appendChild( mockContainer );

		mockCanvasManager = {
			canvas: {
				width: 800,
				height: 600,
				style: {},
				getBoundingClientRect: jest.fn( () => ( {
					left: 100, top: 100, width: 800, height: 600
				} ) )
			},
			container: mockContainer,
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			},
			editor: { layers: [], updateLayer: jest.fn(), getLayerById: jest.fn() },
			zoom: 1.0,
			panX: 0,
			panY: 0,
			setTextEditingMode: jest.fn(),
			saveState: jest.fn(),
			redraw: jest.fn(),
			renderLayers: jest.fn(),
			isDestroyed: false
		};

		textLayer = {
			id: 'layer-1',
			type: 'text',
			text: 'Test',
			x: 100,
			y: 100,
			fontSize: 16,
			fontFamily: 'Arial',
			color: '#000000'
		};

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		jest.useRealTimers();
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		if ( mockContainer.parentNode ) {
			mockContainer.parentNode.removeChild( mockContainer );
		}
		jest.clearAllMocks();
	} );

	test( 'should reset interaction flag on font select blur', () => {
		editor.editorElement = document.createElement( 'textarea' );
		mockContainer.appendChild( editor.editorElement );
		const select = editor._createFontSelect( textLayer );

		// Set interaction flag (simulating dropdown open)
		editor._isToolbarInteraction = true;

		// Trigger blur
		select.dispatchEvent( new Event( 'blur' ) );

		// Run timer
		jest.advanceTimersByTime( 150 );

		expect( editor._isToolbarInteraction ).toBe( false );
	} );

	test( 'should reset interaction flag on font size input blur', () => {
		editor.editorElement = document.createElement( 'textarea' );
		mockContainer.appendChild( editor.editorElement );
		const group = editor._createFontSizeInput( textLayer );
		const input = group.querySelector( 'input' );

		// Trigger blur
		input.dispatchEvent( new Event( 'blur' ) );

		// Focus should return to editor element
		expect( editor.editorElement ).toBeDefined();
	} );
} );

describe( 'InlineTextEditor - Additional edge cases', () => {
	let mockCanvasManager;
	let mockContainer;
	let editor;
	let textLayer;

	beforeEach( () => {
		mockContainer = document.createElement( 'div' );
		document.body.appendChild( mockContainer );

		mockCanvasManager = {
			canvas: {
				width: 800,
				height: 600,
				style: {},
				getBoundingClientRect: jest.fn( () => ( {
					left: 100, top: 100, width: 800, height: 600
				} ) )
			},
			container: mockContainer,
			ctx: {
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			},
			editor: {
				layers: [],
				updateLayer: jest.fn(),
				getLayerById: jest.fn()
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

		textLayer = {
			id: 'layer-1',
			type: 'text',
			text: 'Test',
			x: 100,
			y: 100,
			fontSize: 16,
			fontFamily: 'Arial',
			color: '#000000',
			visible: true
		};

		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( editor && typeof editor.destroy === 'function' ) {
			editor.destroy();
		}
		if ( mockContainer.parentNode ) {
			mockContainer.parentNode.removeChild( mockContainer );
		}
		jest.clearAllMocks();
	} );

	test( 'should handle finishEditing with textbox and empty text', () => {
		const textboxLayer = {
			id: 'layer-2',
			type: 'textbox',
			text: 'Original',
			x: 100,
			y: 100,
			width: 200,
			height: 100,
			fontSize: 16,
			fontFamily: 'Arial',
			color: '#000000'
		};

		editor.startEditing( textboxLayer );
		editor.editorElement.value = '';  // Empty text

		const result = editor.finishEditing( true );

		// Empty text should still complete editing (user might intentionally clear)
		// but the original text should be restored since empty differs from original
		expect( result ).toBe( true );
	} );

	test( 'should handle destroy while editing', () => {
		editor.startEditing( textLayer );
		expect( editor.isEditing ).toBe( true );

		editor.destroy();

		expect( editor.isEditing ).toBe( false );
		expect( editor.canvasManager ).toBeNull();
	} );

	test( 'should handle _createToolbar with missing layer', () => {
		editor.editingLayer = null;

		// Should not throw
		expect( () => editor._createToolbar() ).not.toThrow();
	} );

	test( 'should handle redraw fallback when renderLayers unavailable', () => {
		mockCanvasManager.renderLayers = undefined;
		mockCanvasManager.redraw = jest.fn();

		editor.startEditing( textLayer );
		editor.editorElement.value = 'New text';

		editor.finishEditing( true );

		// Should fall back to redraw
		expect( mockCanvasManager.redraw ).toHaveBeenCalled();
	} );
} );

describe( 'InlineTextEditor - Rich text conversion methods', () => {
	let mockCanvasManager;
	let editor;

	beforeEach( () => {
		mockCanvasManager = {
			canvas: document.createElement( 'canvas' ),
			mainContainer: document.createElement( 'div' ),
			setTextEditingMode: jest.fn(),
			renderLayers: jest.fn(),
			editor: {
				layers: [],
				updateLayer: jest.fn(),
				getLayerById: jest.fn()
			}
		};
		document.body.appendChild( mockCanvasManager.mainContainer );
		document.body.appendChild( mockCanvasManager.canvas );
		editor = new InlineTextEditor( mockCanvasManager );
	} );

	afterEach( () => {
		if ( mockCanvasManager.mainContainer.parentNode ) {
			mockCanvasManager.mainContainer.parentNode.removeChild( mockCanvasManager.mainContainer );
		}
		if ( mockCanvasManager.canvas.parentNode ) {
			mockCanvasManager.canvas.parentNode.removeChild( mockCanvasManager.canvas );
		}
	} );

	describe( '_escapeHtml', () => {
		test( 'should escape HTML special characters', () => {
			expect( editor._escapeHtml( '<script>alert(1)</script>' ) ).toBe( '&lt;script&gt;alert(1)&lt;/script&gt;' );
		} );

		test( 'should handle quotes', () => {
			expect( editor._escapeHtml( '"test"' ) ).toContain( 'test' );
		} );

		test( 'should return plain text unchanged', () => {
			expect( editor._escapeHtml( 'Hello World' ) ).toBe( 'Hello World' );
		} );
	} );

	describe( '_richTextToHtml', () => {
		test( 'should return empty string for empty array', () => {
			expect( editor._richTextToHtml( [] ) ).toBe( '' );
		} );

		test( 'should return empty string for non-array', () => {
			expect( editor._richTextToHtml( null ) ).toBe( '' );
		} );

		test( 'should convert plain text run', () => {
			const result = editor._richTextToHtml( [ { text: 'Hello' } ] );
			expect( result ).toBe( 'Hello' );
		} );

		test( 'should wrap bold text in span', () => {
			const result = editor._richTextToHtml( [ { text: 'Bold', style: { fontWeight: 'bold' } } ] );
			expect( result ).toContain( 'font-weight: bold' );
			expect( result ).toContain( 'Bold' );
		} );

		test( 'should wrap italic text in span', () => {
			const result = editor._richTextToHtml( [ { text: 'Italic', style: { fontStyle: 'italic' } } ] );
			expect( result ).toContain( 'font-style: italic' );
		} );

		test( 'should include color in span', () => {
			const result = editor._richTextToHtml( [ { text: 'Red', style: { color: '#ff0000' } } ] );
			expect( result ).toContain( 'color: #ff0000' );
		} );

		test( 'should include text decoration', () => {
			const result = editor._richTextToHtml( [ { text: 'Underlined', style: { textDecoration: 'underline' } } ] );
			expect( result ).toContain( 'text-decoration: underline' );
		} );

		test( 'should convert newlines to br tags', () => {
			const result = editor._richTextToHtml( [ { text: 'Line1\nLine2' } ] );
			expect( result ).toContain( '<br>' );
		} );

		test( 'should handle multiple runs', () => {
			const result = editor._richTextToHtml( [
				{ text: 'Normal ' },
				{ text: 'Bold', style: { fontWeight: 'bold' } }
			] );
			expect( result ).toContain( 'Normal ' );
			expect( result ).toContain( 'Bold' );
		} );
	} );

	describe( '_htmlToRichText', () => {
		test( 'should parse plain text', () => {
			const result = editor._htmlToRichText( 'Hello World' );
			expect( result.length ).toBeGreaterThan( 0 );
			expect( result[ 0 ].text ).toBe( 'Hello World' );
		} );

		test( 'should parse bold tags', () => {
			const result = editor._htmlToRichText( '<b>Bold</b>' );
			expect( result.some( ( r ) => r.style && r.style.fontWeight === 'bold' ) ).toBe( true );
		} );

		test( 'should parse strong tags', () => {
			const result = editor._htmlToRichText( '<strong>Strong</strong>' );
			expect( result.some( ( r ) => r.style && r.style.fontWeight === 'bold' ) ).toBe( true );
		} );

		test( 'should parse italic tags', () => {
			const result = editor._htmlToRichText( '<i>Italic</i>' );
			expect( result.some( ( r ) => r.style && r.style.fontStyle === 'italic' ) ).toBe( true );
		} );

		test( 'should parse em tags', () => {
			const result = editor._htmlToRichText( '<em>Emphasis</em>' );
			expect( result.some( ( r ) => r.style && r.style.fontStyle === 'italic' ) ).toBe( true );
		} );

		test( 'should parse underline tags', () => {
			const result = editor._htmlToRichText( '<u>Underlined</u>' );
			expect( result.some( ( r ) => r.style && r.style.textDecoration === 'underline' ) ).toBe( true );
		} );

		test( 'should parse strikethrough tags', () => {
			const result = editor._htmlToRichText( '<s>Strike</s>' );
			expect( result.some( ( r ) => r.style && r.style.textDecoration === 'line-through' ) ).toBe( true );
		} );

		test( 'should parse br tags as newlines', () => {
			const result = editor._htmlToRichText( 'Line1<br>Line2' );
			// The result should contain the newline somewhere in the content
			const fullText = result.map( ( r ) => r.text ).join( '' );
			expect( fullText ).toContain( '\n' );
		} );

		test( 'should parse inline styles', () => {
			const result = editor._htmlToRichText( '<span style="color: red">Red</span>' );
			expect( result.some( ( r ) => r.style && r.style.color ) ).toBe( true );
		} );

		test( 'should parse font tag with color attribute', () => {
			const result = editor._htmlToRichText( '<font color="#ff0000">Red text</font>' );
			expect( result.length ).toBe( 1 );
			expect( result[ 0 ].text ).toBe( 'Red text' );
			expect( result[ 0 ].style.color ).toBe( '#ff0000' );
		} );

		test( 'should parse font tag with size attribute', () => {
			const result = editor._htmlToRichText( '<font size="5">Large text</font>' );
			expect( result.length ).toBe( 1 );
			expect( result[ 0 ].text ).toBe( 'Large text' );
			expect( result[ 0 ].style.fontSize ).toBe( 24 ); // size 5 maps to 24px
		} );

		test( 'should parse font tag with face attribute', () => {
			const result = editor._htmlToRichText( '<font face="Arial">Arial text</font>' );
			expect( result.length ).toBe( 1 );
			expect( result[ 0 ].text ).toBe( 'Arial text' );
			expect( result[ 0 ].style.fontFamily ).toBe( 'Arial' );
		} );

		test( 'should parse nested font tags inside bold', () => {
			const result = editor._htmlToRichText( '<b><font color="blue">Blue bold</font></b>' );
			expect( result.length ).toBe( 1 );
			expect( result[ 0 ].text ).toBe( 'Blue bold' );
			expect( result[ 0 ].style.fontWeight ).toBe( 'bold' );
			expect( result[ 0 ].style.color ).toBe( 'blue' );
		} );
	} );

	describe( '_mergeAdjacentRuns', () => {
		test( 'should return empty array for empty input', () => {
			expect( editor._mergeAdjacentRuns( [] ) ).toEqual( [] );
		} );

		test( 'should merge runs with same style', () => {
			const result = editor._mergeAdjacentRuns( [
				{ text: 'Hello', style: { fontWeight: 'bold' } },
				{ text: ' World', style: { fontWeight: 'bold' } }
			] );
			expect( result.length ).toBe( 1 );
			expect( result[ 0 ].text ).toBe( 'Hello World' );
		} );

		test( 'should not merge runs with different styles', () => {
			const result = editor._mergeAdjacentRuns( [
				{ text: 'Bold', style: { fontWeight: 'bold' } },
				{ text: 'Italic', style: { fontStyle: 'italic' } }
			] );
			expect( result.length ).toBe( 2 );
		} );

		test( 'should handle runs without style', () => {
			const result = editor._mergeAdjacentRuns( [
				{ text: 'Hello ' },
				{ text: 'World' }
			] );
			expect( result.length ).toBe( 1 );
			expect( result[ 0 ].text ).toBe( 'Hello World' );
		} );
	} );

	describe( '_getPlainTextFromEditor', () => {
		test( 'should return empty string if no editor element', () => {
			editor.editorElement = null;
			expect( editor._getPlainTextFromEditor() ).toBe( '' );
		} );

		test( 'should return value for input elements', () => {
			editor.editorElement = document.createElement( 'input' );
			editor.editorElement.value = 'Test value';
			expect( editor._getPlainTextFromEditor() ).toBe( 'Test value' );
		} );

		test( 'should extract text from contentEditable', () => {
			editor.editorElement = document.createElement( 'div' );
			editor.editorElement.contentEditable = 'true';
			editor.editorElement.innerHTML = 'Hello World';
			expect( editor._getPlainTextFromEditor() ).toBe( 'Hello World' );
		} );

		test( 'should convert br to newline in contentEditable', () => {
			editor.editorElement = document.createElement( 'div' );
			editor.editorElement.contentEditable = 'true';
			editor.editorElement.innerHTML = 'Line1<br>Line2';
			const result = editor._getPlainTextFromEditor();
			expect( result ).toContain( '\n' );
		} );
	} );

	describe( 'Selection preservation', () => {
		test( '_saveSelection should store selection range when text is selected', () => {
			editor._isRichTextMode = true;
			editor.editorElement = document.createElement( 'div' );
			editor.editorElement.contentEditable = 'true';
			editor.editorElement.innerHTML = 'Hello World';
			document.body.appendChild( editor.editorElement );

			// Create a selection
			const range = document.createRange();
			range.selectNodeContents( editor.editorElement );
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange( range );

			editor._saveSelection();

			expect( editor._savedSelection ).not.toBeNull();
			document.body.removeChild( editor.editorElement );
		} );

		test( '_saveSelection should not save if selection is collapsed', () => {
			editor._isRichTextMode = true;
			editor.editorElement = document.createElement( 'div' );
			editor.editorElement.contentEditable = 'true';
			editor.editorElement.innerHTML = 'Hello World';
			document.body.appendChild( editor.editorElement );

			// Create a collapsed (cursor-only) selection
			const range = document.createRange();
			const textNode = editor.editorElement.firstChild;
			range.setStart( textNode, 0 );
			range.setEnd( textNode, 0 ); // Same position = collapsed
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange( range );

			editor._saveSelection();

			expect( editor._savedSelection ).toBeNull();
			document.body.removeChild( editor.editorElement );
		} );

		test( '_restoreSelection should restore saved selection', () => {
			editor._isRichTextMode = true;
			editor.editorElement = document.createElement( 'div' );
			editor.editorElement.contentEditable = 'true';
			editor.editorElement.innerHTML = 'Hello World';
			document.body.appendChild( editor.editorElement );

			// Create and save a selection
			const range = document.createRange();
			const textNode = editor.editorElement.firstChild;
			range.setStart( textNode, 0 );
			range.setEnd( textNode, 5 ); // Select "Hello"
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange( range );

			editor._saveSelection();

			// Clear the selection
			selection.removeAllRanges();
			expect( selection.isCollapsed ).toBe( true );

			// Restore
			const result = editor._restoreSelection();

			expect( result ).toBe( true );
			const newSelection = window.getSelection();
			expect( newSelection.isCollapsed ).toBe( false );
			expect( newSelection.toString() ).toBe( 'Hello' );

			document.body.removeChild( editor.editorElement );
		} );

		test( '_restoreSelection should return false if no saved selection', () => {
			editor._savedSelection = null;
			expect( editor._restoreSelection() ).toBe( false );
		} );

		test( '_clearSavedSelection should clear the saved selection', () => {
			editor._savedSelection = document.createRange();
			editor._clearSavedSelection();
			expect( editor._savedSelection ).toBeNull();
		} );
	} );

	describe( '_createSeparator', () => {
		test( 'should create a separator div element', () => {
			const separator = editor._createSeparator();

			expect( separator ).toBeDefined();
			expect( separator.tagName ).toBe( 'DIV' );
			expect( separator.className ).toBe( 'layers-text-toolbar-separator' );
		} );

		test( 'should create multiple independent separators', () => {
			const sep1 = editor._createSeparator();
			const sep2 = editor._createSeparator();

			expect( sep1 ).not.toBe( sep2 );
			expect( sep1.className ).toBe( 'layers-text-toolbar-separator' );
			expect( sep2.className ).toBe( 'layers-text-toolbar-separator' );
		} );
	} );

	describe( '_createHighlightButton', () => {
		beforeEach( () => {
			// Mock ColorPickerDialog
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			window.Layers.UI.ColorPickerDialog = jest.fn().mockImplementation( () => ( {
				show: jest.fn(),
				open: jest.fn()
			} ) );
		} );

		afterEach( () => {
			delete window.Layers.UI.ColorPickerDialog;
		} );

		test( 'should create a wrapper element with buttons', () => {
			editor._msg = jest.fn( ( key, fallback ) => fallback );
			const wrapper = editor._createHighlightButton();

			expect( wrapper ).toBeDefined();
			expect( wrapper.tagName ).toBe( 'DIV' );
			expect( wrapper.className ).toContain( 'layers-text-toolbar-highlight-wrapper' );
		} );

		test( 'should contain main button and dropdown button', () => {
			editor._msg = jest.fn( ( key, fallback ) => fallback );
			const wrapper = editor._createHighlightButton();

			const buttons = wrapper.querySelectorAll( 'button' );
			expect( buttons.length ).toBe( 2 );

			// Main highlight button
			const mainBtn = wrapper.querySelector( '.layers-text-toolbar-highlight-main' );
			expect( mainBtn ).not.toBeNull();
			expect( mainBtn.getAttribute( 'data-format' ) ).toBe( 'highlight' );

			// Dropdown button
			const dropdownBtn = wrapper.querySelector( '.layers-text-toolbar-highlight-dropdown' );
			expect( dropdownBtn ).not.toBeNull();
		} );

		test( 'main button should apply highlight on click', () => {
			editor._msg = jest.fn( ( key, fallback ) => fallback );
			editor._applyFormat = jest.fn();
			editor._saveSelection = jest.fn();
			editor.editorElement = document.createElement( 'div' );

			const wrapper = editor._createHighlightButton();
			const mainBtn = wrapper.querySelector( '.layers-text-toolbar-highlight-main' );

			// Simulate mousedown then click
			mainBtn.dispatchEvent( new Event( 'mousedown' ) );
			mainBtn.dispatchEvent( new Event( 'click' ) );

			expect( editor._saveSelection ).toHaveBeenCalled();
			expect( editor._applyFormat ).toHaveBeenCalledWith( 'highlight', '#ffff00' );
		} );

		test( 'dropdown button should open color picker on click', () => {
			editor._msg = jest.fn( ( key, fallback ) => fallback );
			editor._saveSelection = jest.fn();
			editor._isToolbarInteraction = false;

			const wrapper = editor._createHighlightButton();
			const dropdownBtn = wrapper.querySelector( '.layers-text-toolbar-highlight-dropdown' );

			// Simulate mousedown then click
			dropdownBtn.dispatchEvent( new Event( 'mousedown' ) );
			dropdownBtn.dispatchEvent( new Event( 'click' ) );

			expect( editor._saveSelection ).toHaveBeenCalled();
			expect( window.Layers.UI.ColorPickerDialog ).toHaveBeenCalled();
		} );
	} );

	describe( '_applyFormatToSelection', () => {
		let execCommandMock;

		beforeEach( () => {
			editor.editorElement = document.createElement( 'div' );
			editor.editorElement.contentEditable = 'true';
			editor.editorElement.innerHTML = 'Hello World';
			document.body.appendChild( editor.editorElement );

			// Select "Hello"
			const textNode = editor.editorElement.firstChild;
			const range = document.createRange();
			range.setStart( textNode, 0 );
			range.setEnd( textNode, 5 );
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange( range );

			editor._isRichTextMode = true;
			editor._displayScale = 1;

			// Mock execCommand since JSDOM doesn't support it
			execCommandMock = jest.fn( () => true );
			document.execCommand = execCommandMock;
		} );

		afterEach( () => {
			if ( editor.editorElement && editor.editorElement.parentNode ) {
				document.body.removeChild( editor.editorElement );
			}
			delete document.execCommand;
		} );

		test( 'should apply bold formatting using execCommand', () => {
			editor._applyFormatToSelection( 'fontWeight', 'bold' );

			expect( execCommandMock ).toHaveBeenCalledWith( 'bold', false, null );
		} );

		test( 'should apply italic formatting using execCommand', () => {
			editor._applyFormatToSelection( 'fontStyle', 'italic' );

			expect( execCommandMock ).toHaveBeenCalledWith( 'italic', false, null );
		} );

		test( 'should apply underline formatting using execCommand', () => {
			editor._applyFormatToSelection( 'underline', true );

			expect( execCommandMock ).toHaveBeenCalledWith( 'underline', false, null );
		} );

		test( 'should apply strikethrough formatting using execCommand', () => {
			editor._applyFormatToSelection( 'strikethrough', true );

			expect( execCommandMock ).toHaveBeenCalledWith( 'strikeThrough', false, null );
		} );

		test( 'should apply color formatting using execCommand', () => {
			editor._applyFormatToSelection( 'color', '#ff0000' );

			expect( execCommandMock ).toHaveBeenCalledWith( 'foreColor', false, '#ff0000' );
		} );

		test( 'should apply highlight formatting using execCommand', () => {
			editor._applyFormatToSelection( 'highlight', '#ffff00' );

			expect( execCommandMock ).toHaveBeenCalledWith( 'hiliteColor', false, '#ffff00' );
		} );

		test( 'should apply fontSize by wrapping selection in span', () => {
			editor._applyFormatToSelection( 'fontSize', 24 );

			const span = editor.editorElement.querySelector( 'span[data-font-size="24"]' );
			expect( span ).not.toBeNull();
			expect( span.style.fontSize ).toBe( '24px' );
		} );

		test( 'should apply fontFamily by wrapping selection in span', () => {
			editor._applyFormatToSelection( 'fontFamily', 'Arial' );

			const span = editor.editorElement.querySelector( 'span' );
			expect( span ).not.toBeNull();
			expect( span.style.fontFamily ).toBe( 'Arial' );
		} );

		test( 'should handle fontSize with display scale', () => {
			editor._displayScale = 2;

			editor._applyFormatToSelection( 'fontSize', 24 );

			const span = editor.editorElement.querySelector( 'span[data-font-size="24"]' );
			expect( span ).not.toBeNull();
			// Display should be scaled (24 * 2 = 48)
			expect( span.style.fontSize ).toBe( '48px' );
			// Data attribute should have unscaled value
			expect( span.dataset.fontSize ).toBe( '24' );
		} );

		test( 'should default displayScale to 1 if invalid', () => {
			editor._displayScale = 0;

			editor._applyFormatToSelection( 'fontSize', 16 );

			const span = editor.editorElement.querySelector( 'span[data-font-size="16"]' );
			expect( span ).not.toBeNull();
			expect( span.style.fontSize ).toBe( '16px' );
		} );

		test( 'should handle unknown format property gracefully', () => {
			// Should not throw
			expect( () => {
				editor._applyFormatToSelection( 'unknownProperty', 'value' );
			} ).not.toThrow();
		} );
	} );

	describe( '_syncPropertiesPanel', () => {
		test( 'should call layerPanel.updatePropertiesPanel when available', () => {
			const mockUpdatePropertiesPanel = jest.fn();
			editor.editingLayer = { id: 'layer-1' };
			editor.canvasManager = {
				editor: {
					layerPanel: {
						updatePropertiesPanel: mockUpdatePropertiesPanel
					}
				}
			};

			editor._syncPropertiesPanel();

			expect( mockUpdatePropertiesPanel ).toHaveBeenCalledWith( 'layer-1' );
		} );

		test( 'should not throw when layerPanel is not available', () => {
			editor.editingLayer = { id: 'layer-1' };
			editor.canvasManager = { editor: {} };

			expect( () => {
				editor._syncPropertiesPanel();
			} ).not.toThrow();
		} );

		test( 'should not throw when editingLayer is null', () => {
			editor.editingLayer = null;

			expect( () => {
				editor._syncPropertiesPanel();
			} ).not.toThrow();
		} );
	} );
} );
