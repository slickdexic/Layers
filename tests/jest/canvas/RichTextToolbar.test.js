/**
 * Tests for RichTextToolbar - floating formatting toolbar for inline text editing
 *
 * Extracted from InlineTextEditor as part of the God Class Reduction Initiative.
 */

'use strict';

// Import the module
const RichTextToolbar = require( '../../../resources/ext.layers.editor/canvas/RichTextToolbar.js' );

describe( 'RichTextToolbar', () => {
	let toolbar;
	let mockLayer;
	let mockEditorElement;
	let mockContainerElement;
	let mockOnFormat;
	let mockOnSaveSelection;
	let mockOnFocusEditor;
	let mockMsg;

	beforeEach( () => {
		// Setup mock layer
		mockLayer = {
			id: 'layer-1',
			type: 'textbox',
			fontFamily: 'Arial',
			fontSize: 16,
			fontWeight: 'normal',
			fontStyle: 'normal',
			color: '#000000',
			textAlign: 'left'
		};

		// Setup mock DOM elements
		mockEditorElement = document.createElement( 'div' );
		mockEditorElement.contentEditable = 'true';
		mockEditorElement.getBoundingClientRect = jest.fn( () => ( {
			left: 100,
			top: 200,
			right: 300,
			bottom: 250,
			width: 200,
			height: 50
		} ) );
		document.body.appendChild( mockEditorElement );

		mockContainerElement = document.createElement( 'div' );
		mockContainerElement.getBoundingClientRect = jest.fn( () => ( {
			left: 0,
			top: 0,
			right: 800,
			bottom: 600,
			width: 800,
			height: 600
		} ) );
		document.body.appendChild( mockContainerElement );

		// Setup mock callbacks
		mockOnFormat = jest.fn();
		mockOnSaveSelection = jest.fn();
		mockOnFocusEditor = jest.fn();
		mockMsg = jest.fn( ( key, fallback ) => fallback );

		// Setup global namespace
		window.Layers = window.Layers || {};
		window.Layers.FontConfig = {
			getFonts: jest.fn( () => [ 'Arial', 'Times New Roman', 'Courier New' ] ),
			findMatchingFont: jest.fn( ( font ) => font )
		};
	} );

	afterEach( () => {
		if ( toolbar ) {
			toolbar.destroy();
		}
		if ( mockEditorElement.parentNode ) {
			mockEditorElement.parentNode.removeChild( mockEditorElement );
		}
		if ( mockContainerElement.parentNode ) {
			mockContainerElement.parentNode.removeChild( mockContainerElement );
		}
	} );

	describe( 'constructor', () => {
		it( 'should create instance with options', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onSaveSelection: mockOnSaveSelection,
				onFocusEditor: mockOnFocusEditor,
				msg: mockMsg
			} );

			expect( toolbar ).toBeDefined();
			expect( toolbar.layer ).toBe( mockLayer );
			expect( toolbar.isRichTextMode ).toBe( true );
		} );

		it( 'should use default callbacks when not provided', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer
			} );

			// Should not throw when callbacks are called
			expect( () => toolbar.onFormat( 'fontWeight', 'bold' ) ).not.toThrow();
			expect( () => toolbar.onSaveSelection() ).not.toThrow();
			expect( () => toolbar.onFocusEditor() ).not.toThrow();
		} );

		it( 'should default isRichTextMode to false', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer
			} );

			expect( toolbar.isRichTextMode ).toBe( false );
		} );
	} );

	describe( 'create()', () => {
		it( 'should return null if layer is not provided', () => {
			toolbar = new RichTextToolbar( {} );
			const element = toolbar.create();
			expect( element ).toBeNull();
		} );

		it( 'should create toolbar DOM element', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			const element = toolbar.create();

			expect( element ).not.toBeNull();
			expect( element.className ).toBe( 'layers-text-toolbar' );
		} );

		it( 'should append toolbar to container', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			expect( mockContainerElement.contains( toolbar.toolbarElement ) ).toBe( true );
		} );

		it( 'should include drag handle', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const handle = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-handle' );
			expect( handle ).not.toBeNull();
		} );

		it( 'should include font select dropdown', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const fontSelect = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-font' );
			expect( fontSelect ).not.toBeNull();
			expect( fontSelect.tagName ).toBe( 'SELECT' );
		} );

		it( 'should include font size input', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );
			expect( sizeInput ).not.toBeNull();
			expect( sizeInput.type ).toBe( 'number' );
			expect( sizeInput.value ).toBe( '16' );
		} );

		it( 'should include bold and italic buttons', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const boldBtn = toolbar.toolbarElement.querySelector( '[data-format="bold"]' );
			const italicBtn = toolbar.toolbarElement.querySelector( '[data-format="italic"]' );

			expect( boldBtn ).not.toBeNull();
			expect( italicBtn ).not.toBeNull();
		} );

		it( 'should include underline and strikethrough in rich text mode', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const underlineBtn = toolbar.toolbarElement.querySelector( '[data-format="underline"]' );
			const strikeBtn = toolbar.toolbarElement.querySelector( '[data-format="strikethrough"]' );

			expect( underlineBtn ).not.toBeNull();
			expect( strikeBtn ).not.toBeNull();
		} );

		it( 'should NOT include underline and strikethrough when not in rich text mode', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: false,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const underlineBtn = toolbar.toolbarElement.querySelector( '[data-format="underline"]' );
			const strikeBtn = toolbar.toolbarElement.querySelector( '[data-format="strikethrough"]' );

			expect( underlineBtn ).toBeNull();
			expect( strikeBtn ).toBeNull();
		} );

		it( 'should include alignment buttons', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const alignLeft = toolbar.toolbarElement.querySelector( '[data-align="left"]' );
			const alignCenter = toolbar.toolbarElement.querySelector( '[data-align="center"]' );
			const alignRight = toolbar.toolbarElement.querySelector( '[data-align="right"]' );

			expect( alignLeft ).not.toBeNull();
			expect( alignCenter ).not.toBeNull();
			expect( alignRight ).not.toBeNull();
		} );

		it( 'should mark current alignment as active', () => {
			mockLayer.textAlign = 'center';

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const alignCenter = toolbar.toolbarElement.querySelector( '[data-align="center"]' );
			expect( alignCenter.classList.contains( 'active' ) ).toBe( true );
		} );
	} );

	describe( 'isInteracting()', () => {
		it( 'should return false initially', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			expect( toolbar.isInteracting() ).toBe( false );
		} );
	} );

	describe( 'position()', () => {
		it( 'should position toolbar above editor', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const style = toolbar.toolbarElement.style;
			expect( style.left ).toBeDefined();
			expect( style.top ).toBeDefined();
		} );

		it( 'should not throw if elements are missing', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer
			} );

			toolbar.toolbarElement = document.createElement( 'div' );
			expect( () => toolbar.position() ).not.toThrow();
		} );
	} );

	describe( 'destroy()', () => {
		it( 'should remove toolbar from DOM', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();
			expect( mockContainerElement.contains( toolbar.toolbarElement ) ).toBe( true );

			toolbar.destroy();
			expect( toolbar.toolbarElement ).toBeNull();
		} );

		it( 'should not throw if called multiple times', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();
			expect( () => {
				toolbar.destroy();
				toolbar.destroy();
			} ).not.toThrow();
		} );
	} );

	describe( 'format button interactions', () => {
		it( 'should call onFormat when bold button clicked', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat
			} );

			toolbar.create();

			const boldBtn = toolbar.toolbarElement.querySelector( '[data-format="bold"]' );
			boldBtn.click();

			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontWeight', 'bold' );
		} );

		it( 'should toggle bold button state', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat
			} );

			toolbar.create();

			const boldBtn = toolbar.toolbarElement.querySelector( '[data-format="bold"]' );

			// First click - activate
			boldBtn.click();
			expect( boldBtn.classList.contains( 'active' ) ).toBe( true );
			expect( mockOnFormat ).toHaveBeenLastCalledWith( 'fontWeight', 'bold' );

			// Second click - deactivate
			boldBtn.click();
			expect( boldBtn.classList.contains( 'active' ) ).toBe( false );
			expect( mockOnFormat ).toHaveBeenLastCalledWith( 'fontWeight', 'normal' );
		} );

		it( 'should call onFormat when italic button clicked', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat
			} );

			toolbar.create();

			const italicBtn = toolbar.toolbarElement.querySelector( '[data-format="italic"]' );
			italicBtn.click();

			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontStyle', 'italic' );
		} );

		it( 'should call onFormat when alignment button clicked', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat
			} );

			toolbar.create();

			const centerBtn = toolbar.toolbarElement.querySelector( '[data-align="center"]' );
			centerBtn.click();

			expect( mockOnFormat ).toHaveBeenCalledWith( 'textAlign', 'center' );
		} );

		it( 'should deactivate other alignment buttons when one is clicked', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const leftBtn = toolbar.toolbarElement.querySelector( '[data-align="left"]' );
			const centerBtn = toolbar.toolbarElement.querySelector( '[data-align="center"]' );

			// Initially left is active (default)
			expect( leftBtn.classList.contains( 'active' ) ).toBe( true );

			// Click center
			centerBtn.click();

			expect( centerBtn.classList.contains( 'active' ) ).toBe( true );
			expect( leftBtn.classList.contains( 'active' ) ).toBe( false );
		} );
	} );

	describe( 'font select interactions', () => {
		it( 'should call onFormat when font changed', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onFocusEditor: mockOnFocusEditor
			} );

			toolbar.create();

			const fontSelect = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-font' );
			fontSelect.value = 'Times New Roman';
			fontSelect.dispatchEvent( new Event( 'change' ) );

			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontFamily', 'Times New Roman' );
			expect( mockOnFocusEditor ).toHaveBeenCalled();
		} );

		it( 'should call onSaveSelection on mousedown', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onSaveSelection: mockOnSaveSelection
			} );

			toolbar.create();

			const fontSelect = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-font' );
			fontSelect.dispatchEvent( new Event( 'mousedown' ) );

			expect( mockOnSaveSelection ).toHaveBeenCalled();
		} );
	} );

	describe( 'font size interactions', () => {
		it( 'should call onFormat when font size changed', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onFocusEditor: mockOnFocusEditor
			} );

			toolbar.create();

			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );
			sizeInput.value = '24';
			sizeInput.dispatchEvent( new Event( 'change' ) );

			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontSize', 24 );
			expect( mockOnFocusEditor ).toHaveBeenCalled();
		} );

		it( 'should clamp font size to valid range', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat
			} );

			toolbar.create();

			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );

			// Test below minimum
			sizeInput.value = '4';
			sizeInput.dispatchEvent( new Event( 'change' ) );
			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontSize', 8 );
			expect( sizeInput.value ).toBe( '8' );

			// Test above maximum
			sizeInput.value = '300';
			sizeInput.dispatchEvent( new Event( 'change' ) );
			expect( mockOnFormat ).toHaveBeenCalledWith( 'fontSize', 200 );
			expect( sizeInput.value ).toBe( '200' );
		} );
	} );

	describe( 'drag functionality', () => {
		it( 'should have drag handle that responds to mousedown', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const handle = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-handle' );

			// Simulate mousedown to start drag
			const event = new MouseEvent( 'mousedown', {
				clientX: 50,
				clientY: 50,
				bubbles: true
			} );
			handle.dispatchEvent( event );

			expect( toolbar._isDragging ).toBe( true );
		} );

		it( 'should stop drag on mouseup', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const handle = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-handle' );

			// Start drag
			handle.dispatchEvent( new MouseEvent( 'mousedown', {
				clientX: 50,
				clientY: 50
			} ) );
			expect( toolbar._isDragging ).toBe( true );

			// Trigger mouseup on document
			document.dispatchEvent( new MouseEvent( 'mouseup' ) );
			expect( toolbar._isDragging ).toBe( false );
		} );
	} );

	describe( 'i18n support', () => {
		it( 'should use msg callback for tooltips', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				msg: mockMsg
			} );

			toolbar.create();

			expect( mockMsg ).toHaveBeenCalledWith( 'layers-text-toolbar-drag', 'Drag to move' );
			expect( mockMsg ).toHaveBeenCalledWith( 'layers-text-toolbar-bold', 'Bold' );
			expect( mockMsg ).toHaveBeenCalledWith( 'layers-text-toolbar-italic', 'Italic' );
		} );
	} );

	describe( 'highlight button', () => {
		it( 'should include highlight button in rich text mode', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const highlightBtn = toolbar.toolbarElement.querySelector( '[data-format="highlight"]' );
			expect( highlightBtn ).not.toBeNull();
		} );

		it( 'should call onFormat with default yellow when highlight clicked', () => {
			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				isRichTextMode: true,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement,
				onFormat: mockOnFormat,
				onFocusEditor: mockOnFocusEditor
			} );

			toolbar.create();

			const highlightBtn = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-highlight-main' );
			highlightBtn.click();

			expect( mockOnFormat ).toHaveBeenCalledWith( 'highlight', '#ffff00' );
		} );
	} );

	describe( 'layer initial state', () => {
		it( 'should mark bold button active if layer has bold weight', () => {
			mockLayer.fontWeight = 'bold';

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const boldBtn = toolbar.toolbarElement.querySelector( '[data-format="bold"]' );
			expect( boldBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		it( 'should mark italic button active if layer has italic style', () => {
			mockLayer.fontStyle = 'italic';

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const italicBtn = toolbar.toolbarElement.querySelector( '[data-format="italic"]' );
			expect( italicBtn.classList.contains( 'active' ) ).toBe( true );
		} );

		it( 'should use layer font size in input', () => {
			mockLayer.fontSize = 32;

			toolbar = new RichTextToolbar( {
				layer: mockLayer,
				editorElement: mockEditorElement,
				containerElement: mockContainerElement
			} );

			toolbar.create();

			const sizeInput = toolbar.toolbarElement.querySelector( '.layers-text-toolbar-size' );
			expect( sizeInput.value ).toBe( '32' );
		} );
	} );
} );
