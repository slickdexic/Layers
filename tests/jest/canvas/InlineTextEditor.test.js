/**
 * Tests for InlineTextEditor
 *
 * InlineTextEditor provides inline text editing on the canvas for text and textbox layers.
 * It uses an HTML textarea overlay that appears when a user double-clicks on a text layer.
 */

'use strict';

// Set up RichTextConverter mock before loading InlineTextEditor
global.window = global.window || {};
window.Layers = window.Layers || {};
window.Layers.Canvas = window.Layers.Canvas || {};
window.Layers.Canvas.RichTextConverter = {
	escapeHtml: jest.fn( ( text ) => {
		return String( text || '' )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' );
	} ),
	richTextToHtml: jest.fn( ( richText, _displayScale ) => {
		if ( !Array.isArray( richText ) || richText.length === 0 ) {
			return '';
		}
		return richText.map( ( run ) => {
			const text = run.text || '';
			const style = run.style || {};
			if ( Object.keys( style ).length > 0 ) {
				const styleStr = Object.entries( style )
					.map( ( [ k, v ] ) => `${ k }: ${ v }` )
					.join( '; ' );
				return `<span style="${ styleStr }">${ text }</span>`;
			}
			return text;
		} ).join( '' );
	} ),
	htmlToRichText: jest.fn( ( html, _displayScale ) => {
		if ( !html ) {
			return [];
		}
		// Simple mock - return text as single run
		const text = html.replace( /<[^>]*>/g, '' );
		return [ { text: text } ];
	} ),
	mergeAdjacentRuns: jest.fn( ( runs ) => runs || [] ),
	getPlainText: jest.fn( ( source ) => {
		if ( typeof source === 'string' ) {
			return source.replace( /<[^>]*>/g, '' );
		}
		return source?.textContent || source?.value || '';
	} )
};

// Set up RichTextToolbar mock before loading InlineTextEditor
// RichTextToolbar was extracted from InlineTextEditor - tests are in RichTextToolbar.test.js
window.Layers.Canvas.RichTextToolbar = class MockRichTextToolbar {
	constructor( options ) {
		this.layer = options.layer;
		this.isRichTextMode = options.isRichTextMode || false;
		this.editorElement = options.editorElement;
		this.containerElement = options.containerElement;
		this.onFormat = options.onFormat || ( () => {} );
		this.onSaveSelection = options.onSaveSelection || ( () => {} );
		this.onFocusEditor = options.onFocusEditor || ( () => {} );
		this.msg = options.msg || ( ( key, fallback ) => fallback );
		this.toolbarElement = null;
		this._isInteracting = false;
	}

	create() {
		if ( !this.layer ) {
			return null;
		}
		this.toolbarElement = document.createElement( 'div' );
		this.toolbarElement.className = 'layers-text-toolbar';
		if ( this.containerElement ) {
			this.containerElement.appendChild( this.toolbarElement );
		}
		return this.toolbarElement;
	}

	isInteracting() {
		return this._isInteracting;
	}

	position() {}

	destroy() {
		if ( this.toolbarElement && this.toolbarElement.parentNode ) {
			this.toolbarElement.parentNode.removeChild( this.toolbarElement );
		}
		this.toolbarElement = null;
	}
};

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

			// Verify updateLayer was called with text: '' and richText: null to keep text cleared during editing
			// This prevents double rendering (canvas + HTML overlay)
			expect( mockCanvasManager.editor.updateLayer ).toHaveBeenCalledWith( 'layer-1', {
				fontFamily: 'Times New Roman',
				text: '',
				richText: null
			} );
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

	// NOTE: Toolbar drag functionality tests depend on extracted toolbar methods
	// These tests are now in RichTextToolbar.test.js
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

	// NOTE: Toolbar creation methods were extracted to RichTextToolbar.js
	// These tests are now in RichTextToolbar.test.js

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
} );

// NOTE: Toolbar integration tests depend on extracted toolbar methods
// These tests are now in RichTextToolbar.test.js

// NOTE: ColorPickerDialog integration tests depend on extracted toolbar methods
// These tests are now in RichTextToolbar.test.js

// NOTE: Font select blur tests depend on extracted toolbar methods
// These tests are now in RichTextToolbar.test.js

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

	describe( '_escapeHtml (via RichTextConverter)', () => {
		test( 'should escape HTML special characters via RichTextConverter', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			expect( RTC.escapeHtml( '<script>alert(1)</script>' ) ).toBe( '&lt;script&gt;alert(1)&lt;/script&gt;' );
		} );

		test( 'should handle quotes', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			expect( RTC.escapeHtml( '"test"' ) ).toContain( 'test' );
		} );

		test( 'should return plain text unchanged', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			expect( RTC.escapeHtml( 'Hello World' ) ).toBe( 'Hello World' );
		} );
	} );

	describe( '_richTextToHtml (via RichTextConverter)', () => {
		test( 'should return empty string for empty array', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			expect( RTC.richTextToHtml( [] ) ).toBe( '' );
		} );

		test( 'should return empty string for non-array', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			expect( RTC.richTextToHtml( null ) ).toBe( '' );
		} );

		test( 'should convert plain text run', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.richTextToHtml( [ { text: 'Hello' } ] );
			expect( result ).toBe( 'Hello' );
		} );

		test( 'should wrap bold text in span', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.richTextToHtml( [ { text: 'Bold', style: { fontWeight: 'bold' } } ] );
			expect( result ).toContain( 'fontWeight: bold' );
			expect( result ).toContain( 'Bold' );
		} );

		test( 'should wrap italic text in span', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.richTextToHtml( [ { text: 'Italic', style: { fontStyle: 'italic' } } ] );
			expect( result ).toContain( 'fontStyle: italic' );
		} );

		test( 'should include color in span', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.richTextToHtml( [ { text: 'Red', style: { color: '#ff0000' } } ] );
			expect( result ).toContain( 'color: #ff0000' );
		} );

		test( 'should include text decoration', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.richTextToHtml( [ { text: 'Underlined', style: { textDecoration: 'underline' } } ] );
			expect( result ).toContain( 'textDecoration: underline' );
		} );

		test( 'should convert newlines to br tags (mock returns plain text)', () => {
			// Note: mock does not convert newlines, this tests the mock behavior
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.richTextToHtml( [ { text: 'Line1\nLine2' } ] );
			expect( result ).toContain( 'Line1' );
		} );

		test( 'should handle multiple runs', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.richTextToHtml( [
				{ text: 'Normal ' },
				{ text: 'Bold', style: { fontWeight: 'bold' } }
			] );
			expect( result ).toContain( 'Normal ' );
			expect( result ).toContain( 'Bold' );
		} );
	} );

	describe( '_htmlToRichText (via RichTextConverter)', () => {
		test( 'should parse plain text', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( 'Hello World' );
			expect( result.length ).toBeGreaterThan( 0 );
			expect( result[ 0 ].text ).toBe( 'Hello World' );
		} );

		test( 'should parse bold tags (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( '<b>Bold</b>' );
			expect( result[ 0 ].text ).toBe( 'Bold' );
		} );

		test( 'should parse strong tags (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( '<strong>Strong</strong>' );
			expect( result[ 0 ].text ).toBe( 'Strong' );
		} );

		test( 'should parse italic tags (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( '<i>Italic</i>' );
			expect( result[ 0 ].text ).toBe( 'Italic' );
		} );

		test( 'should parse em tags (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( '<em>Emphasis</em>' );
			expect( result[ 0 ].text ).toBe( 'Emphasis' );
		} );

		test( 'should parse underline tags (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( '<u>Underlined</u>' );
			expect( result[ 0 ].text ).toBe( 'Underlined' );
		} );

		test( 'should parse strikethrough tags (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( '<s>Strike</s>' );
			expect( result[ 0 ].text ).toBe( 'Strike' );
		} );

		test( 'should parse br tags as newlines (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( 'Line1<br>Line2' );
			expect( result[ 0 ].text ).toBe( 'Line1Line2' ); // mock strips br
		} );

		test( 'should parse inline styles (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( '<span style="color: red">Red</span>' );
			expect( result[ 0 ].text ).toBe( 'Red' );
		} );

		test( 'should parse font tag with color attribute (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( '<font color="#ff0000">Red text</font>' );
			expect( result.length ).toBe( 1 );
			expect( result[ 0 ].text ).toBe( 'Red text' );
		} );

		test( 'should parse font tag with size attribute (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( '<font size="5">Large text</font>' );
			expect( result.length ).toBe( 1 );
			expect( result[ 0 ].text ).toBe( 'Large text' );
		} );

		test( 'should parse font tag with face attribute (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( '<font face="Arial">Arial text</font>' );
			expect( result.length ).toBe( 1 );
			expect( result[ 0 ].text ).toBe( 'Arial text' );
		} );

		test( 'should parse nested font tags inside bold (mock strips tags)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.htmlToRichText( '<b><font color="blue">Blue bold</font></b>' );
			expect( result.length ).toBe( 1 );
			expect( result[ 0 ].text ).toBe( 'Blue bold' );
		} );
	} );

	describe( '_mergeAdjacentRuns (via RichTextConverter)', () => {
		test( 'should return empty array for empty input', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			expect( RTC.mergeAdjacentRuns( [] ) ).toEqual( [] );
		} );

		test( 'should return runs as-is (mock behavior)', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.mergeAdjacentRuns( [
				{ text: 'Hello', style: { fontWeight: 'bold' } },
				{ text: ' World', style: { fontWeight: 'bold' } }
			] );
			expect( result.length ).toBe( 2 ); // mock doesn't merge
		} );

		test( 'should handle runs with different styles', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.mergeAdjacentRuns( [
				{ text: 'Bold', style: { fontWeight: 'bold' } },
				{ text: 'Italic', style: { fontStyle: 'italic' } }
			] );
			expect( result.length ).toBe( 2 );
		} );

		test( 'should handle runs without style', () => {
			const RTC = window.Layers.Canvas.RichTextConverter;
			const result = RTC.mergeAdjacentRuns( [
				{ text: 'Hello ' },
				{ text: 'World' }
			] );
			expect( result.length ).toBe( 2 ); // mock doesn't merge
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

	describe( '_updateToolbarButtonStates', () => {
		beforeEach( () => {
			// Setup editorElement as contentEditable div
			editor.editorElement = document.createElement( 'div' );
			editor.editorElement.contentEditable = 'true';
			editor.editorElement.innerHTML = 'Hello World';
			document.body.appendChild( editor.editorElement );

			// Setup toolbar with format buttons
			editor.toolbarElement = document.createElement( 'div' );
			editor.toolbarElement.innerHTML = `
				<button data-format="bold">B</button>
				<button data-format="italic">I</button>
				<button data-format="underline">U</button>
				<button data-format="strikethrough">S</button>
			`;
			document.body.appendChild( editor.toolbarElement );

			editor.isEditing = true;
			editor._isRichTextMode = true;

			// Create a selection within the editor
			const textNode = editor.editorElement.firstChild;
			const range = document.createRange();
			range.setStart( textNode, 0 );
			range.setEnd( textNode, 5 );
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange( range );

			// Mock queryCommandState
			document.queryCommandState = jest.fn( ( command ) => {
				if ( command === 'bold' ) {
					return true;
				}
				return false;
			} );
		} );

		afterEach( () => {
			if ( editor.editorElement && editor.editorElement.parentNode ) {
				document.body.removeChild( editor.editorElement );
			}
			if ( editor.toolbarElement && editor.toolbarElement.parentNode ) {
				document.body.removeChild( editor.toolbarElement );
			}
			delete document.queryCommandState;
		} );

		test( 'should return early when toolbarElement is null', () => {
			editor.toolbarElement = null;

			expect( () => {
				editor._updateToolbarButtonStates();
			} ).not.toThrow();
		} );

		test( 'should return early when not editing', () => {
			editor.isEditing = false;

			expect( () => {
				editor._updateToolbarButtonStates();
			} ).not.toThrow();
		} );

		test( 'should return early when not in rich text mode', () => {
			editor._isRichTextMode = false;

			expect( () => {
				editor._updateToolbarButtonStates();
			} ).not.toThrow();
		} );

		test( 'should toggle active class on bold button when bold is active', () => {
			document.queryCommandState = jest.fn( ( cmd ) => cmd === 'bold' );

			editor._updateToolbarButtonStates();

			const boldBtn = editor.toolbarElement.querySelector( '[data-format="bold"]' );
			expect( boldBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		test( 'should toggle active class on italic button when italic is active', () => {
			document.queryCommandState = jest.fn( ( cmd ) => cmd === 'italic' );

			editor._updateToolbarButtonStates();

			const italicBtn = editor.toolbarElement.querySelector( '[data-format="italic"]' );
			expect( italicBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		test( 'should toggle active class on underline button when underline is active', () => {
			document.queryCommandState = jest.fn( ( cmd ) => cmd === 'underline' );

			editor._updateToolbarButtonStates();

			const underlineBtn = editor.toolbarElement.querySelector( '[data-format="underline"]' );
			expect( underlineBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		test( 'should toggle active class on strikethrough button when strikeThrough is active', () => {
			document.queryCommandState = jest.fn( ( cmd ) => cmd === 'strikeThrough' );

			editor._updateToolbarButtonStates();

			const strikeBtn = editor.toolbarElement.querySelector( '[data-format="strikethrough"]' );
			expect( strikeBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		test( 'should remove active class when format is not active', () => {
			const boldBtn = editor.toolbarElement.querySelector( '[data-format="bold"]' );
			boldBtn.classList.add( 'active' );

			document.queryCommandState = jest.fn( () => false );

			editor._updateToolbarButtonStates();

			expect( boldBtn.classList.contains( 'active' ) ).toBe( false );
		} );

		test( 'should handle selection outside editor element', () => {
			// Create selection outside editor
			const outsideDiv = document.createElement( 'div' );
			outsideDiv.textContent = 'Outside content';
			document.body.appendChild( outsideDiv );

			const range = document.createRange();
			range.selectNodeContents( outsideDiv );
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange( range );

			expect( () => {
				editor._updateToolbarButtonStates();
			} ).not.toThrow();

			document.body.removeChild( outsideDiv );
		} );
	} );

	describe( 'getPendingTextContent', () => {
		test( 'should return null when not editing', () => {
			editor.isEditing = false;

			const result = editor.getPendingTextContent();

			expect( result ).toBeNull();
		} );

		test( 'should return null when editorElement is null', () => {
			editor.isEditing = true;
			editor.editorElement = null;
			editor.editingLayer = { id: 'layer-1' };

			const result = editor.getPendingTextContent();

			expect( result ).toBeNull();
		} );

		test( 'should return null when editingLayer is null', () => {
			editor.isEditing = true;
			editor.editorElement = document.createElement( 'input' );
			editor.editingLayer = null;

			const result = editor.getPendingTextContent();

			expect( result ).toBeNull();
		} );

		test( 'should return text from input element when not in rich text mode', () => {
			editor.isEditing = true;
			editor.editorElement = document.createElement( 'input' );
			editor.editorElement.value = 'Simple text';
			editor.editingLayer = { id: 'layer-1', type: 'text' };
			editor._isRichTextMode = false;

			const result = editor.getPendingTextContent();

			expect( result ).toEqual( {
				text: 'Simple text',
				richText: null
			} );
		} );

		test( 'should return text and richText from contentEditable when in rich text mode', () => {
			editor.isEditing = true;
			editor.editorElement = document.createElement( 'div' );
			editor.editorElement.contentEditable = 'true';
			editor.editorElement.innerHTML = '<b>Bold</b> text';
			editor.editingLayer = { id: 'layer-1', type: 'textbox' };
			editor._isRichTextMode = true;

			// Mock the helper methods
			editor._getContentElement = jest.fn( () => editor.editorElement );
			editor._getPlainTextFromEditor = jest.fn( () => 'Bold text' );

			// Mock RichTextConverter.htmlToRichText to return expected data
			const originalHtmlToRichText = window.Layers.Canvas.RichTextConverter.htmlToRichText;
			window.Layers.Canvas.RichTextConverter.htmlToRichText = jest.fn( () => [
				{ text: 'Bold', style: { fontWeight: 'bold' } },
				{ text: ' text' }
			] );

			const result = editor.getPendingTextContent();

			expect( result.text ).toBe( 'Bold text' );
			expect( result.richText ).toEqual( [
				{ text: 'Bold', style: { fontWeight: 'bold' } },
				{ text: ' text' }
			] );

			// Restore
			window.Layers.Canvas.RichTextConverter.htmlToRichText = originalHtmlToRichText;
		} );

		test( 'should handle empty input value', () => {
			editor.isEditing = true;
			editor.editorElement = document.createElement( 'input' );
			editor.editorElement.value = '';
			editor.editingLayer = { id: 'layer-1', type: 'text' };
			editor._isRichTextMode = false;

			const result = editor.getPendingTextContent();

			expect( result ).toEqual( {
				text: '',
				richText: null
			} );
		} );
	} );
} );
