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
			// updateLayer should have been called
			expect( mockCanvasManager.editor.updateLayer ).toHaveBeenCalledWith( 'layer-1', { fontSize: 24 } );
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

			// Verify updateLayer was called with the font change
			expect( mockCanvasManager.editor.updateLayer ).toHaveBeenCalledWith( 'layer-1', { fontFamily: 'Times New Roman' } );
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
			expect( editor._isDraggingToolbar ).toBeFalsy();
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

		// Should not throw
		expect( true ).toBe( true );
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
